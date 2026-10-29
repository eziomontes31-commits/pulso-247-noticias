// Pulso 247 Noticias — asistente periodístico robusto para Vercel.
// Requiere GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.
const JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    summary: { type: 'STRING' },
    body: { type: 'STRING' },
    sources: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['title', 'summary', 'body', 'sources']
};

function sendError(res, status, message, code) {
  return res.status(status).json({ ok: false, error: message, code });
}
function safeJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}
async function readJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { _nonJson: text.slice(0, 600) }; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return sendError(res, 405, 'Método no permitido. Usa POST.', 'METHOD_NOT_ALLOWED');

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return sendError(res, 401, 'Inicia sesión como administrador antes de usar el periodista IA.', 'AUTH_REQUIRED');

  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.GEMINI_API_KEY;
  const missing = [];
  if (!base) missing.push('SUPABASE_URL');
  if (!anon) missing.push('SUPABASE_ANON_KEY');
  if (!service) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey) missing.push('GEMINI_API_KEY');
  if (missing.length) return sendError(res, 503, 'Faltan variables privadas en Vercel: ' + missing.join(', ') + '. Agrégalas en Settings → Environment Variables y vuelve a desplegar.', 'ENV_MISSING');

  try {
    // Validate Supabase session.
    let userResponse;
    try {
      userResponse = await fetch(base + '/auth/v1/user', {
        headers: { apikey: anon, Authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(12000)
      });
    } catch (e) {
      return sendError(res, 502, 'No se pudo conectar con Supabase para validar la sesión. Comprueba SUPABASE_URL y la conexión. Detalle: ' + (e.message || 'error de red'), 'SUPABASE_UNREACHABLE');
    }
    const user = await readJson(userResponse);
    if (!userResponse.ok || !user.id) return sendError(res, 401, 'La sesión no es válida o venció. Cierra sesión y vuelve a entrar.', 'SESSION_INVALID');

    const profileResponse = await fetch(base + '/rest/v1/profiles?select=role&id=eq.' + encodeURIComponent(user.id), {
      headers: { apikey: service, Authorization: 'Bearer ' + service },
      signal: AbortSignal.timeout(12000)
    });
    const profiles = await readJson(profileResponse);
    if (!profileResponse.ok || !Array.isArray(profiles) || profiles[0]?.role !== 'admin') {
      return sendError(res, 403, 'La cuenta debe tener role=admin en la tabla profiles de Supabase.', 'ADMIN_REQUIRED');
    }

    const input = req.body && typeof req.body === 'object' ? req.body : {};
    const title = String(input.title || '').trim();
    const summary = String(input.summary || '').trim();
    const body = String(input.body || '').trim();
    const region = String(input.region || 'Nacional').trim();
    const category = String(input.category || 'Actualidad').trim();
    const location = String(input.location || 'Córdoba, Colombia').trim();
    const suppliedSources = Array.isArray(input.sources) ? input.sources.map(String).join('\n') : String(input.sources || '').trim();
    const topic = [title, summary, body].filter(Boolean).join('\n').slice(0, 10000);
    if (!topic) return sendError(res, 400, 'Escribe unas palabras clave en “Tema o palabras clave”. Ejemplo: lluvias en Córdoba, obras en Montería, empleo en Colombia.', 'TOPIC_REQUIRED');

    const prompt = `Eres el periodista de investigación y editor de Pulso 247 Noticias, un medio colombiano profesional. Tu tarea es INVESTIGAR en la web con Google Search y luego redactar un BORRADOR periodístico útil a partir incluso de 2 o 3 palabras clave.

PROCESO OBLIGATORIO:
1. Busca en la web información reciente y relacionada con el tema. Prioriza entidades oficiales, comunicados originales, documentos y medios periodísticos reconocidos. Busca al menos dos fuentes cuando existan.
2. Compara lo encontrado; diferencia hechos confirmados, declaraciones atribuidas y asuntos no confirmados. Usa fechas exactas cuando estén disponibles.
3. Redacta en español colombiano claro, con estilo periodístico sobrio, titular informativo, resumen de 1-2 frases y cuerpo aproximado de 350-600 palabras, con entrada noticiosa y párrafos organizados.
4. Incluye en sources títulos y URLs reales que procedan de los resultados de búsqueda. No inventes URLs, citas, nombres, cifras, lugares ni declaraciones.
5. Si no hay resultados útiles, NO inventes una noticia. Devuelve una propuesta de enfoque y explica en el cuerpo qué falta verificar.
6. Nunca publiques automáticamente: es un borrador para revisión humana.
7. Devuelve únicamente un objeto JSON con las propiedades title, summary, body y sources. sources debe ser un arreglo de cadenas. No uses Markdown ni cercas de código.

Cobertura: ${region}
Categoría: ${category}
Área de interés: ${location}
Tema / palabras clave / material del editor:
${topic}
Fuentes proporcionadas por el editor:
${suppliedSources || '(ninguna)'}

Recuerda: investigar primero; escribir después; mantener precisión y transparencia.`;

    const configuredModel = String(process.env.GEMINI_TEXT_MODEL || '').trim();
    // Fallbacks protect against a typo or a model unavailable to the user's API project.
    const models = ['gemini-2.5-flash-lite']; // Modelo fijo para priorizar la cuota gratuita; no hace fallback a modelos potencialmente facturables.
    let article = null;
    let lastFailure = '';
    let usedModel = '';
    let finalCandidate = null;

    for (const model of models) {
      // Gemini 3 supports structured output with Google Search. For older fallback models,
      // use plain text plus a strict JSON prompt to avoid incompatible tool/schema settings.
      const isGemini3 = /^gemini-3\./i.test(model) || /^gemini-3-/i.test(model);
      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 8192 }
      };
      if (isGemini3) {
        payload.generationConfig.responseMimeType = 'application/json';
        payload.generationConfig.responseSchema = JSON_SCHEMA;
      }
      let response;
      let data;
      try {
        response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(55000)
        });
        data = await readJson(response);
      } catch (e) {
        lastFailure = 'No se pudo conectar con Google Gemini (' + model + '): ' + (e.message || 'error de red');
        continue;
      }
      if (!response.ok) {
        const apiMessage = data?.error?.message || data?._nonJson || ('HTTP ' + response.status);
        lastFailure = model + ': ' + apiMessage;
        // Retry other known models when model/feature availability differs by project.
        continue;
      }
      const candidate = data.candidates?.[0];
      const rawText = candidate?.content?.parts?.map(part => part.text || '').join('').trim() || '';
      const parsed = safeJson(rawText);
      if (!parsed || typeof parsed !== 'object' || !String(parsed.body || '').trim()) {
        lastFailure = model + ': Google respondió, pero no entregó un artículo JSON completo. ' + (candidate?.finishReason ? 'Motivo: ' + candidate.finishReason : '');
        continue;
      }
      article = parsed;
      finalCandidate = candidate;
      usedModel = model;
      break;
    }

    if (!article) {
      const lower = lastFailure.toLowerCase();
      let suggestion = 'Revisa Vercel → Settings → Environment Variables y confirma GEMINI_API_KEY. Luego revisa Deployments → Functions/Logs.';
      if (lower.includes('api key') || lower.includes('permission') || lower.includes('403') || lower.includes('unauthorized')) suggestion = 'La clave de Google no está autorizada o la API no está habilitada. Crea/verifica la clave en Google AI Studio y vuelve a desplegar.';
      else if (lower.includes('quota') || lower.includes('429') || lower.includes('rate')) suggestion = 'Se agotó la cuota o el límite de Google. Revisa el uso/cuota del proyecto o inténtalo más tarde.';
      else if (lower.includes('not found') || lower.includes('404') || lower.includes('model')) suggestion = 'El modelo no está disponible para esta clave. Elimina GEMINI_TEXT_MODEL en Vercel para que use gemini-2.5-flash-lite, compatible con la opción de cuota gratuita cuando esté habilitada en tu proyecto.';
      return sendError(res, 502, 'El asistente no pudo completar la investigación. Último detalle: ' + (lastFailure || 'sin detalle del proveedor') + ' ' + suggestion, 'GEMINI_FAILED');
    }

    const grounded = finalCandidate?.groundingMetadata?.groundingChunks || [];
    const searchSources = grounded.map(chunk => chunk.web).filter(w => w?.uri && /^https?:\/\//i.test(w.uri)).map(w => (w.title ? w.title + ' — ' : '') + w.uri);
    const modelSources = Array.isArray(article.sources) ? article.sources.map(s => String(s).trim()).filter(Boolean) : [];
    const sources = [...new Set([...modelSources, ...searchSources])];
    const result = {
      ok: true,
      title: String(article.title || title || 'Borrador periodístico'),
      summary: String(article.summary || ''),
      body: String(article.body || ''),
      sources,
      meta: { model: usedModel, searchedWeb: searchSources.length > 0, needsEditorialReview: true }
    };
    if (!result.body.trim()) return sendError(res, 502, 'La IA no generó el cuerpo de la noticia. Intenta con un tema más concreto.', 'EMPTY_ARTICLE');
    if (!result.sources.length) result.body += '\n\nNOTA EDITORIAL: Esta respuesta no incluyó enlaces verificables. Comprueba los hechos y agrega fuentes antes de aprobar o publicar.';
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Pulso247 generate]', error?.stack || error);
    return sendError(res, 500, 'Error interno del asistente periodístico. Revisa los registros de la función api/generate en Vercel. Detalle: ' + (error?.message || 'error desconocido'), 'INTERNAL_ERROR');
  }
}
