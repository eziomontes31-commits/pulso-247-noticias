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
    // 1. Validar sesión de administrador en Supabase
    const userResponse = await fetch(base + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + token }
    });
    if (!userResponse.ok) return res.status(401).json({ error: 'La sesión venció. Inicia sesión de nuevo.' });
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
      return res.status(400).json({ error: 'Escribe un titular o tema para generar la noticia.' });
    }

    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

    const promptText = `Actúas como periodista y editor del portal de noticias "Pulso 247".
A partir de la siguiente información, redacta una nota periodística profesional y completa:

- Cobertura: ${region}
- Categoría: ${category}
- Lugar: ${location}
- Tema o notas del editor: ${topic}

Devuelve exclusivamente un objeto JSON válido con exactamente estas cuatro propiedades de texto:
{
  "title": "Un titular atractivo y periodístico",
  "summary": "Un resumen o subtítulo breve de 1 a 2 frases",
  "body": "El cuerpo completo de la noticia desarrollado en varios párrafos",
  "sources": ["Pulso 247", "Redacción local"]
}`;

    // 3. Llamada directa a la API de Gemini con formato JSON estricto
    const response = await fetch(
      https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)},
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: data.error?.message || 'Error en la respuesta de Google Gemini.' });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) {
      return res.status(502).json({ error: 'La IA no devolvió contenido.' });
    }

    // 4. Parsear la respuesta JSON de forma limpia
    let article;
    try {
      article = JSON.parse(rawText);
    } catch (e) {
      const clean = rawText.replace(/json/g, '').replace(//g, '').trim();
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      article = JSON.parse(clean.slice(start, end + 1));
    }

    return res.status(200).json({
      title: String(article.title || title || ''),
      summary: String(article.summary || summary || ''),
      body: String(article.body || ''),
      sources: Array.isArray(article.sources) ? article.sources : ['Pulso 247']
    });

  } catch (error) {
    console.error('Error en api/generate:', error);
    return res.status(500).json({ error: 'Error del servidor: ' + error.message });
  }
}
