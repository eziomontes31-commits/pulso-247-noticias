export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
 const auth=req.headers.authorization||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';
 if(!token)return res.status(401).json({error:'Debes iniciar sesión como administrador.'});
 const base=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY,apiKey=process.env.GEMINI_API_KEY;
 if(!base||!anon||!service||!apiKey)return res.status(503).json({error:'Faltan variables privadas en Vercel. Consulta CONFIGURACION.md.'});
 try{
  const u=await fetch(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token}});
  if(!u.ok)return res.status(401).json({error:'Sesión no válida.'});const user=await u.json();
  const pr=await fetch(base+'/rest/v1/profiles?select=role&id=eq.'+encodeURIComponent(user.id),{headers:{apikey:service,Authorization:'Bearer '+service}});
  const roles=await pr.json();if(!pr.ok||roles[0]?.role!=='admin')return res.status(403).json({error:'Solo el administrador autorizado puede usar esta función.'});
  const {title='',summary='',body='',region='Nacional',category='Actualidad',location='',sources=''}=req.body||{};
  const prompt=`Eres asistente editorial de un medio colombiano. Crea un BORRADOR periodístico en español; nunca inventes hechos, cifras, citas ni fuentes. Si falta información, indícalo explícitamente dentro del texto como [DATO POR VERIFICAR]. No afirmes que consultaste internet. Usa solamente los datos proporcionados y las fuentes suministradas. Devuelve JSON válido con title, summary, body, sources (array de strings). Incluye una sección de datos pendientes de confirmar cuando corresponda. Región: ${region}; categoría: ${category}; lugar: ${location}; tema/titular: ${title}; resumen existente: ${summary}; material disponible: ${body}; fuentes suministradas: ${sources}.`;
  const model=process.env.GEMINI_TEXT_MODEL||'gemini-3.1-flash-lite';
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0.4}})});
  const d=await r.json();if(!r.ok)return res.status(502).json({error:d.error?.message||'Falló Google Gemini. Revisa el modelo, la clave y los límites de uso.'});
  const content=d.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();if(!content)return res.status(502).json({error:'Google Gemini no devolvió contenido. Puede que la respuesta haya sido bloqueada.'});
  try{return res.status(200).json(JSON.parse(content));}catch{return res.status(502).json({error:'Google Gemini devolvió una respuesta que no se pudo leer como JSON.'});}
 }catch(e){return res.status(500).json({error:'Error interno al generar el borrador.'});}
}
