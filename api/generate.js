export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
 const auth=req.headers.authorization||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';
 if(!token)return res.status(401).json({error:'Debes iniciar sesión como administrador.'});
 const base=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY,apiKey=process.env.OPENAI_API_KEY;
 if(!base||!anon||!service||!apiKey)return res.status(503).json({error:'Faltan variables privadas de entorno en Vercel. Consulta CONFIGURACION.md.'});
 try{
  const u=await fetch(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token}});
  if(!u.ok)return res.status(401).json({error:'Sesión no válida.'});const user=await u.json();
  const pr=await fetch(base+'/rest/v1/profiles?select=role&id=eq.'+encodeURIComponent(user.id),{headers:{apikey:service,Authorization:'Bearer '+service}});
  const roles=await pr.json();if(!pr.ok||roles[0]?.role!=='admin')return res.status(403).json({error:'Solo el administrador autorizado puede usar esta función.'});
  const {title='',summary='',body='',region='Nacional',category='Actualidad',location='',sources=''}=req.body||{};
  const prompt=`Eres asistente editorial de un medio colombiano. Crea un BORRADOR periodístico en español; nunca inventes hechos, cifras, citas ni fuentes. Si falta información, indícalo explícitamente dentro del texto como [DATO POR VERIFICAR]. No afirmes que consultaste internet. Usa solamente los datos proporcionados y las fuentes suministradas. Devuelve JSON con title, summary, body, sources (array de strings). Incluye una sección de datos pendientes de confirmar cuando corresponda. Región: ${region}; categoría: ${category}; lugar: ${location}; tema/titular: ${title}; resumen existente: ${summary}; material disponible: ${body}; fuentes suministradas: ${sources}.`;
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_TEXT_MODEL||'gpt-4.1-mini',messages:[{role:'system',content:'Responde con JSON válido únicamente.'},{role:'user',content:prompt}],response_format:{type:'json_object'},temperature:0.4})});
  const d=await r.json();if(!r.ok)return res.status(502).json({error:d.error?.message||'Falló el servicio de IA.'});
  const content=d.choices?.[0]?.message?.content;if(!content)return res.status(502).json({error:'La IA no devolvió contenido.'});
  return res.status(200).json(JSON.parse(content));
 }catch(e){return res.status(500).json({error:'Error interno al generar el borrador.'});}
}