const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
const META_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || '{}');
}
async function supabase(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text.slice(0, 500) }; }
  if (!response.ok) throw new Error(data?.message || data?.hint || `Supabase HTTP ${response.status}`);
  return data;
}
async function postForm(url, values) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values) });
  const raw = await r.text(); let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw.slice(0, 300) }; }
  if (!r.ok || data.error) throw new Error(data.error?.message || data.error_description || data.error || `HTTP ${r.status}`);
  return data;
}
async function postJson(url, headers, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const raw = await r.text(); let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw.slice(0, 300) }; }
  if (!r.ok) throw new Error(data.message || data.error?.message || data.error_description || `HTTP ${r.status}`);
  return data;
}
function articleUrl(id) {
  const base = SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (!base) throw new Error('Configura SITE_URL en Vercel para generar enlaces públicos de noticias.');
  return `${base}/noticia.html?id=${encodeURIComponent(id)}`;
}
function caption(a, link) {
  const summary = (a.summary || a.body || '').replace(/\s+/g, ' ').trim();
  return `${a.title}\n\n${summary.slice(0, 500)}\n\nLee la noticia completa: ${link}\n\nPulso 247 Noticias`;
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido.' });
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) return send(res, 503, { error: 'Falta configurar SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en Vercel.' });
  const auth = String(req.headers.authorization || '');
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!accessToken) return send(res, 401, { error: 'Sesión de administrador requerida.' });
  try {
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` } });
    if (!authResponse.ok) return send(res, 401, { error: 'La sesión expiró. Vuelve a ingresar al administrador.' });
    const authUser = await authResponse.json();
    const profile = await supabase(`/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(authUser.id)}&limit=1`);
    if (!profile?.[0] || profile[0].role !== 'admin') return send(res, 403, { error: 'Solo el administrador puede distribuir noticias a las redes.' });
    const body = await readJson(req);
    const id = String(body.articleId || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { error: 'Identificador de noticia no válido.' });
    const found = await supabase(`/rest/v1/articles?select=*&id=eq.${encodeURIComponent(id)}&status=eq.published&limit=1`);
    const article = found?.[0];
    if (!article) return send(res, 404, { error: 'La noticia no existe o no está publicada en Pulso 247.' });
    const link = articleUrl(article.id);
    const text = caption(article, link);
    const prior = article.social_results && typeof article.social_results === 'object' ? article.social_results : {};
    const results = [];
    const run = async (platform, configured, action) => {
      if (!configured) { results.push({ platform, ok: false, skipped: true, message: 'No configurada en Vercel' }); return; }
      if (prior[platform]?.ok) { results.push({ platform, ok: true, skipped: true, message: 'Ya publicada anteriormente' }); return; }
      try { const response = await action(); results.push({ platform, ok: true, id: response?.id || response?.post_id || response?.result?.id || null, message: 'Publicado correctamente' }); }
      catch (e) { results.push({ platform, ok: false, message: String(e.message || e).slice(0, 300) }); }
    };

    await run('facebook', !!(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN), async () => postForm(`https://graph.facebook.com/${META_VERSION}/${process.env.FACEBOOK_PAGE_ID}/feed`, { message: text, link, access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN }));

    await run('instagram', !!(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN), async () => {
      if (!article.image_url || !/^https:\/\//i.test(article.image_url)) throw new Error('Instagram necesita una imagen pública HTTPS en la noticia.');
      const container = await postForm(`https://graph.facebook.com/${META_VERSION}/${process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`, { image_url: article.image_url, caption: text.slice(0, 2100), access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN });
      if (!container.id) throw new Error('Meta no devolvió el identificador del contenedor de imagen.');
      return postForm(`https://graph.facebook.com/${META_VERSION}/${process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`, { creation_id: container.id, access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN });
    });

    await run('telegram', !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID), async () => {
      const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: text.slice(0, 3900), disable_web_page_preview: false }) });
      const d = await r.json(); if (!r.ok || !d.ok) throw new Error(d.description || `Telegram HTTP ${r.status}`); return { id: d.result?.message_id };
    });

    await run('x', !!process.env.X_USER_ACCESS_TOKEN, async () => postJson('https://api.x.com/2/tweets', { Authorization: `Bearer ${process.env.X_USER_ACCESS_TOKEN}` }, { text: `${aShort(article.title, 190)} ${link}`.slice(0, 280) }));

    await run('linkedin', !!(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN), async () => postJson('https://api.linkedin.com/rest/posts', { Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`, 'Linkedin-Version': process.env.LINKEDIN_VERSION || '202610', 'X-Restli-Protocol-Version': '2.0.0' }, { author: process.env.LINKEDIN_AUTHOR_URN, commentary: `${article.title}\n\n${(article.summary || '').slice(0, 700)}\n\n${link}`, visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false }));

    const merged = { ...prior };
    for (const result of results) if (result.ok && !result.skipped) merged[result.platform] = result;
    try {
      await supabase(`/rest/v1/articles?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ social_results: merged, social_published_at: Object.values(merged).some(x => x?.ok) ? new Date().toISOString() : null }) });
    } catch (e) {
      // This migration is included in schema.sql; publishing still reports platform results if the DB has not yet been migrated.
      results.push({ platform: 'registro', ok: false, message: 'Las redes respondieron, pero no se pudo guardar el historial. Ejecuta la migración SQL incluida: ' + String(e.message || e).slice(0, 160) });
    }
    return send(res, 200, { ok: true, articleId: id, articleUrl: link, results });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e).slice(0, 500) });
  }
}
function aShort(s, max) { const v = String(s || '').trim(); return v.length > max ? v.slice(0, max - 1).trimEnd() + '…' : v; }
