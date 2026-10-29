export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'El prompt es requerido' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'La API Key de Gemini no está configurada en Vercel' });
    }

    const response = await fetch(
      https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey},
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          systemInstruction: {
            parts: [
              {
                text: `Eres un redactor y periodista experimentado para el portal "Pulso 247".
Tu objetivo es redactar noticias completas, claras y bien estructuradas en formato JSON.
Debes devolver un objeto JSON estricto con la siguiente estructura exacta:
{
  "titular": "Título atractivo de la noticia",
  "subtitulo": "Resumen breve o bajada",
  "texto": "Cuerpo completo de la noticia desarrollado en varios párrafos",
  "categoria": "Actualidad",
  "cobertura": "Nacional"
}`
              }
            ]
          },
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Error en la respuesta de Gemini');
    }

    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const jsonContent = JSON.parse(textResponse);

    return res.status(200).json(jsonContent);
  } catch (error) {
    console.error('Error en api/generate:', error);
    return res.status(500).json({ error: error.message });
  }
}
