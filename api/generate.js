import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'El prompt es requerido' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: `Eres un redactor y periodista experimentado para el portal "Pulso 247".
Tu objetivo es redactar noticias completas, claras y bien estructuradas en formato JSON.
Debes devolver un objeto JSON estricto con la siguiente estructura:
{
  "titular": "Título atractivo de la noticia",
  "subtitulo": "Resumen breve o bajada",
  "texto": "Cuerpo completo de la noticia desarrollado en varios párrafos",
  "categoria": "Actualidad | Deportes | Cultura | Economía | Tecnología",
  "cobertura": "Local | Nacional | Internacional"
}
Si el tema es general o faltan detalles, desarrolla la nota periodística de forma verosímil y profesional sin rechazar la solicitud.`,
        responseMimeType: 'application/json'
      },
    });

    // Envía la respuesta JSON directamente al frontend
    const content = JSON.parse(response.text);
    return res.status(200).json(content);
  } catch (error) {
    console.error('Error en servicio de IA Gemini:', error);
    return res.status(500).json({ error: error.message });
  }
}
