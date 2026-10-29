export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión como administrador.' });

  const base = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!base || !anon || !service || !apiKey) {
    return res.status(503).json({ error: 'Faltan variables privadas en Vercel. Revisa CONFIGURACION.md y confirma GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.' });
  }

  try {
    // Comprobar que la petición viene de una sesión de administrador de Supabase.
    const userResponse = await fetch(base + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + token }
    });
    if (!userResponse.ok) return res.status(401).json({ error: 'La sesión venció. Cierra sesión y vuelve a entrar.' });
    const user = await userResponse.json();
    const profileResponse = await fetch(base + '/rest/v1/profiles?select=role&id=eq.' + encodeURIComponent(user.id), {
      headers: { apikey: service, Authorization: 'Bearer ' + service }
    });
    const profiles = await profileResponse.json();
    if (!profileResponse.ok || profiles[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Solo el administrador autorizado puede usar el asistente periodístico.' });
    }

    const input = req.body || {};
    const title = String(input.title || '').trim();
    const summary = String(input.summary || '').trim();
    const body = String(input.body || '').trim();
    const region = String(input.region || 'Nacional').trim();
    const category = String(input.category || 'Actualidad').trim();
    const location = String(input.location || 'Córdoba, Colombia').trim();
    const suppliedSources = Array.isArray(input.sources)
      ? input.sources.map(String).join('\n')
      : String(input.sources || '').trim();
    const topic = [title, summary, body].filter(Boolean).join('\n');
    if (!topic) return res.status(400).json({ error: 'Escribe unas palabras clave o un tema en el campo Titular. Ejemplo: lluvias en Córdoba, obras en Montería, elecciones Colombia.' });

    const prompt = `Actúas como periodista y editor de una sala de redacción profesional colombiana llamada Pulso 247 Noticias. Investiga el tema usando la herramienta de búsqueda de Google habilitada en esta solicitud y redacta un borrador periodístico en español claro, preciso, neutral y natural.

INSTRUCCIONES EDITORIALES:
- El usuario puede darte solo unas pocas palabras clave. Interprétalas como un tema a investigar, no exijas que ya exista una noticia redactada.
- Busca información actual y relevante. Prioriza fuentes oficiales, autoridades, entidades públicas, comunicados originales y medios reconocidos. Contrasta cuando sea posible.
- No inventes hechos, fechas, nombres, cifras, declaraciones ni enlaces. Distingue claramente lo confirmado de lo que sigue sin confirmar.
- Si no encuentras fuentes útiles, dilo con honestidad y entrega una propuesta de enfoque marcada como pendiente de verificación; no presentes el hecho como confirmado.
- Escribe un titular informativo, un resumen de 1 a 2 frases y una noticia desarrollada de aproximadamente 350 a 600 palabras, con entrada periodística y párrafos ordenados. Evita frases grandilocuentes, repetición, opinión y sensacionalismo.
- Añade contexto solo cuando las fuentes lo respalden. No inventes citas textuales. Si una fuente no confirma una afirmación importante, no la atribuyas.
- En sources incluye las URLs reales y títulos de las páginas encontradas. Si la búsqueda no proporciona URLs verificables, deja la lista vacía y explica los datos pendientes al final del cuerpo.
- El texto es un BORRADOR para revisión humana. No afirmes que la noticia ya fue verificada por Pulso 247 ni que está publicada.
- Devuelve exclusivamente un objeto JSON válido con estas cuatro propiedades exactas: title (string), summary (string), body (string), sources (array de strings). No uses Markdown ni bloques de código alrededor del JSON.

DATOS DE LA SOLICITUD:
Cobertura: ${region}
Categoría: ${category}
Lugar o área de interés: ${location}
Palabras clave, titular o material aportado por el editor:
${topic}
Fuentes aportadas por el editor:
${suppliedSources || '(ninguna)'}

Recuerda: busca primero, redacta después, cita las fuentes reales y no rellenes vacíos con suposiciones.`;

    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
    const geminiResponse = await fetch(
      https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)},
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4
          }
        })
      }
    );

    const data = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      const apiMessage = data.error?.message || '';
      if (geminiResponse.status === 400 && /google_search|tool|schema|responseMimeType/i.test(apiMessage)) {
        return res.status(502).json({ error: 'Google rechazó la configuración de búsqueda o el formato de respuesta para el modelo ' + model + '. En Vercel revisa GEMINI_TEXT_MODEL y usa un modelo Gemini compatible con Google Search grounding, como gemini-3.1-flash-lite. Detalle: ' + apiMessage });
      }
      if (geminiResponse.status === 403 || geminiResponse.status === 429) {
        return res.status(502).json({ error: 'Google Gemini no autorizó la solicitud o alcanzó una cuota. Revisa la clave, la API habilitada, la facturación/cuota de búsqueda y los límites del modelo en Google AI Studio. Detalle: ' + apiMessage });
      }
      return res.status(502).json({ error: 'Falló Google Gemini. Revisa el modelo y la configuración. Detalle: ' + (apiMessage || 'respuesta HTTP ' + geminiResponse.status) });
    }

    const candidate = data.candidates?.[0];
    const rawText = candidate?.content?.parts?.map(part => part.text || '').join('').trim() || '';
    if (!rawText) {
      const reason = candidate?.finishReason ? ' Motivo: ' + candidate.finishReason + '.' : '';
      return res.status(502).json({ error: 'Google Gemini no devolvió el texto de la noticia.' + reason + ' Comprueba los límites de uso y vuelve a intentarlo.' });
    }

    // Acepta JSON normal, JSON dentro de bloques Markdown o JSON precedido por texto accidental.
    let article;
    try {
      article = JSON.parse(rawText);
    } catch {
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try { article = JSON.parse(rawText.slice(start, end + 1)); } catch { /* respuesta no parseable */ }
      }
    }
    if (!article || typeof article !== 'object') {
      return res.status(502).json({ error: 'La IA investigó, pero su respuesta llegó en un formato inesperado. Intenta de nuevo o reduce las palabras clave.' });
    }

    // Adjuntar también las fuentes que Google devuelve como metadatos de búsqueda.
    const grounded = candidate?.groundingMetadata?.groundingChunks || [];
    const verifiedLinks = grounded
      .map(chunk => chunk.web)
      .filter(web => web?.uri && /^https?:\/\//i.test(web.uri))
      .map(web => (web.title ? web.title + ' — ' : '') + web.uri);
    const modelSources = Array.isArray(article.sources) ? article.sources.map(String) : [];
    const uniqueSources = [...new Set([...modelSources, ...verifiedLinks])];

    const result = {
      title: String(article.title || title || 'Noticia pendiente de titular'),
      summary: String(article.summary || ''),
      body: String(article.body || ''),
      sources: uniqueSources
    };
    if (!result.body.trim()) return res.status(502).json({ error: 'La IA no produjo el cuerpo de la noticia. Prueba con palabras clave más concretas.' });
    if (!result.sources.length) {
      result.body += '\n\nNOTA EDITORIAL: La búsqueda no entregó enlaces verificables en esta respuesta. Confirmar los hechos y añadir fuentes antes de aprobar o publicar.';
    }
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del asistente periodístico: ' + (error?.message || 'error desconocido') });
  }
}
