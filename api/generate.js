export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Debes iniciar sesión como administrador.' });
  }

  const base = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!base || !anon || !service || !apiKey) {
    return res.status(503).json({ error: 'Faltan variables privadas en Vercel.' });
  }

  try {
    // 1. Validar autenticación de administrador con Supabase
    const userResponse = await fetch(base + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + token }
    });
    if (!userResponse.ok) return res.status(401).json({ error: 'La sesión venció. Vuelve a iniciar sesión.' });
    const user = await userResponse.json();

    const profileResponse = await fetch(base + '/rest/v1/profiles?select=role&id=eq.' + encodeURIComponent(user.id), {
      headers: { apikey: service, Authorization: 'Bearer ' + service }
    });
    const profiles = await profileResponse.json();
    if (!profileResponse.ok || profiles[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso no autorizado.' });
    }

    // 2. Extraer datos del formulario
    const input = req.body || {};
    const title = String(input.title || '').trim();
    const summary = String(input.summary || '').trim();
    const bodyText = String(input.body || '').trim();
    const region = String(input.region || 'Nacional').trim();
    const category = String(input.category || 'Actualidad').trim();
    const location = String(input.location || 'Colombia').trim();

    const topic = [title, summary, bodyText].filter(Boolean).join('\n');
    if (!topic) {
      return res.status(400).json({ error: 'Escribe un titular o tema para la noticia.' });
    }

    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

    const promptText = `Actúas como periodista y editor de Pulso 247.
Redacta una nota periodística completa, clara y bien desarrollada sobre:

DETALLES:
- Cobertura: ${region}
- Categoría: ${category}
- Lugar: ${location}
- Tema o Palabras clave: ${topic}

INSTRUCCIONES DE FORMATO:
Devuelve ÚNICAMENTE un objeto JSON estricto sin bloques de formato Markdown adicionales, con esta estructura exacta:
{
  "title": "Titular de la noticia",
  "summary": "Resumen o subtítulo breve",
  "body": "Cuerpo completo de la noticia desarrollado en varios párrafos",
  "sources": "Pulso 247 / Reportes de actualidad"
}`;

    let rawText = '';
    let fetchedWebSources = [];

    // Intentar primero con la herramienta de búsqueda web (Google Search Grounding)
    try {
      const webSearchRes = await fetch(
        https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)},
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            tools: [{ google_search: {} }]
          })
        }
      );

      const webData = await webSearchRes.json();
      if (webSearchRes.ok && webData.candidates?.[0]?.content?.parts?.[0]?.text) {
        rawText = webData.candidates[0].content.parts[0].text.trim();
        const groundingChunks = webData.candidates[0].groundingMetadata?.groundingChunks || [];
        fetchedWebSources = groundingChunks.map(c => c.web?.uri).filter(Boolean);
      }
    } catch (e) {
      console.log('Fallo en búsqueda web, recurriendo a generación directa');
    }

    // Respaldo (Fallback): Generación directa si la búsqueda web falla o fue rechazada por cuotas
    if (!rawText) {
      const directRes = await fetch(
        https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)},
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            generationConfig: {
              responseMimeType: 'application/json'
            }
          })
        }
      );

      const directData = await directRes.json();
      if (!directRes.ok) {
        return res.status(502).json({ error: directData.error?.message || 'Error en respuesta de Google Gemini.' });
      }
      rawText = directData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }

    if (!rawText) {
      return res.status(502).json({ error: 'La IA no devolvió texto en la respuesta.' });
    }

    // 3. Extraer y limpiar el JSON devuelto
    let article;
    try {
      article = JSON.parse(rawText);
    } catch (e) {
      const cleanJson = rawText.replace(/json/g, '').replace(//g, '').trim();
      const start = cleanJson.indexOf('{');
      const end = cleanJson.lastIndexOf('}');
      if (start >= 0 && end > start) {
        article = JSON.parse(cleanJson.slice(start, end + 1));
      }
    }

    if (!article || typeof article !== 'object') {
      return res.status(502).json({ error: 'La respuesta de la IA no se pudo convertir a JSON.' });
    }

    // 4. Formatear la respuesta final para el panel web
    let sourcesList = [];
    if (Array.isArray(article.sources)) {
      sourcesList = article.sources.map(String);
    } else if (typeof article.sources === 'string' && article.sources) {
      sourcesList = [article.sources];
    }
    const finalSources = [...new Set([...sourcesList, ...fetchedWebSources])];

    return res.status(200).json({
      title: String(article.title || title || 'Titular redactado con IA'),
      summary: String(article.summary || summary || ''),
      body: String(article.body || ''),
      sources: finalSources
    });

  } catch (error) {
    console.error('Error en api/generate:', error);
    return res.status(500).json({ error: 'Error del servidor: ' + error.message });
  }
}
