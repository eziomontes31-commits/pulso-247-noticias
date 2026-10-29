// Diagnóstico básico de despliegue. No devuelve claves ni valores secretos.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    ok: true,
    service: 'Pulso 247 Noticias API',
    apiRouteDeployed: true,
    configured: {
      supabaseUrl: Boolean(process.env.SUPABASE_URL),
      supabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
      supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      geminiApiKey: Boolean(process.env.GEMINI_API_KEY)
    },
    nextStep: 'Si alguna propiedad configured es false, configura esa variable en Vercel y vuelve a desplegar. No compartas claves secretas.'
  });
}
