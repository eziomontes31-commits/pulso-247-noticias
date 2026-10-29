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

    // Configuración del modelo con instrucciones periodísticas
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: `Eres un redactor y periodista experimentado para el portal de noticias "Pulso 247". 
Tu objetivo es redactar noticias claras, objetivas, bien estructuradas y atractivas.
Si el usuario te da una idea general, titular o notas rápidas, desarrolla la noticia completa con un estilo informativo, neutral y fluido. 
Evita decir "no tengo información" o "requiere insumos". En su lugar, redacta una nota periodística completa usando tu conocimiento general o ampliando la premisa dada por el usuario.`,
      },
    });

    return res.status(200).json({ text: response.text });
  } catch (error) {
    console.error('Error en servicio de IA Gemini:', error);
    return res.status(500).json({ error: error.message });
  }
}
