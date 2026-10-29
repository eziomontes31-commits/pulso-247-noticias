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
    // 1. Validar administrador en Supabase
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
      return res.status(403).json({ error: 'Solo el administrador autorizado puede usar el asistente.' });
    }

    // 2. Extraer datos del formulario
    const input = req.body || {};
    const title = String(input.title || '').trim();
    const summary = String(input.summary || '').trim();
    const bodyText = String(input.body || '').trim();
    const region = String(input.region || 'Nacional').trim();
    const category = String(input.category || 'Actualidad').trim();
    const location = String(input.location || 'Córdoba, Colombia').trim();

    const topic = [title, summary, bodyText].filter(Boolean).join('\n');
    if (!topic) {
      return res.status(400).json({ error: 'Escribe un titular o palabras clave para investigar.' });
    }

    // 3. Crear Prompt optimizado para búsqueda web
    const prompt = `Actúas como periodista y editor de Pulso 247.
Busca información actual en internet sobre el siguiente tema:

INFORMACIÓN DE LA SOLICITUD:
- Cobertura: ${region}
- Categoría: ${category}
- Lugar: ${location}
- Tema / Palabras clave: ${topic}

INSTRUCCIONES EDITORIALES:
1. Busca información real en la web.
2. Redacta la noticia completa en formato JSON.
3. Devuelve únicamente el objeto JSON con la siguiente estructura:
{
  "title": "Titular de la noticia",
  "summary": "Resumen breve de 1 a 2 frases",
  "body": "Cuerpo completo de la noticia desarrollado en varios párrafos",
  "sources": ["Nombre o URL de la fuente 1", "Nombre o URL de la fuente 2"]
}`;

    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

    // 4. Llamada a Gemini usando Búsqueda Web sin responseSchema (evita el error 500)
    const geminiResponse = await fetch(
      https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)},
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.4
          }
        })
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return res.status(502).json({ error: data.error?.message || 'Error en la respuesta de Google Gemini.' });
    }

    const candidate = data.candidates?.[0];
    const rawText = candidate?.content?.parts?.map(part => part.text || '').join('').trim() || '';

    if (!rawText) {
      return res.status(502).json({ error: 'La IA investigó pero no devolvió texto.' });
    }

    // 5. Parsear la respuesta JSON de forma segura
    let article;
    try {
      article = JSON.parse(rawText);
    } catch (e) {
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          article = JSON.parse(rawText.slice(start, end + 1));
        } catch (err) {}
      }
    }

    if (!article || typeof article !== 'object') {
      return res.status(502).json({ error: 'No se pudo estructurar el JSON de la noticia.' });
    }

    // 6. Extraer fuentes web detectadas por Google
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
    const verifiedLinks = groundingChunks
      .map(chunk => chunk.web?.uri)
      .filter(Boolean);

    const modelSources = Array.isArray(article.sources) ? article.sources.map(String) : [];
    const uniqueSources = [...new Set([...modelSources, ...verifiedLinks])];

    const result = {
      title: String(article.title || title || 'Noticia sin título'),
      summary: String(article.summary || summary || ''),
      body: String(article.body || ''),
      sources: uniqueSources
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('Error en api/generate:', error);
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
}
