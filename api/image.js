export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
 const auth=req.headers.authorization||'',token=auth.startsWith('Bearer ')?auth.slice(7):'';
 if(!token)return res.status(401).json({error:'Debes iniciar sesión como administrador.'});
 const base=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY,apiKey=process.env.OPENAI_API_KEY;
 if(!base||!anon||!service||!apiKey)return res.status(503).json({error:'Faltan variables privadas de entorno en Vercel.'});
 try{
  const u=await fetch(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token}});if(!u.ok)return res.status(401).json({error:'Sesión no válida.'});const user=await u.json();
  const pr=await fetch(base+'/rest/v1/profiles?select=role&id=eq.'+encodeURIComponent(user.id),{headers:{apikey:service,Authorization:'Bearer '+service}});const roles=await pr.json();if(!pr.ok||roles[0]?.role!=='admin')return res.status(403).json({error:'Solo el administrador puede generar imágenes.'});
  const {title='',summary='',region='Nacional',category='Actualidad',location=''}=req.body||{};
  const prompt=`Crea una ilustración editorial original para acompañar una noticia de un medio informativo colombiano. Tema: ${title}. Contexto disponible: ${summary}. Región: ${region}. Categoría: ${category}. Lugar: ${location}. Estilo documental editorial sobrio, profesional, composición limpia, sin texto, sin logotipos, sin representar personas reales identificables ni simular una fotografía auténtica de un suceso real. La imagen es ilustrativa.`;
  const r=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-1',prompt,size:'1024x1024'})});const d=await r.json();if(!r.ok)return res.status(502).json({error:d.error?.message||'Falló la generación de imagen.'});
  const b64=d.data?.[0]?.b64_json;if(!b64)return res.status(502).json({error:'El proveedor no devolvió una imagen en formato esperado.'});
  const bytes=Buffer.from(b64,'base64');const objectName='ai/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.png';
  const upload=await fetch(base+'/storage/v1/object/pulso-media/'+objectName,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'image/png','x-upsert':'false'},body:bytes});
  if(!upload.ok){const detail=await upload.text();return res.status(502).json({error:'No se pudo guardar la imagen en Supabase Storage. Ejecuta el SQL de configuración de almacenamiento. '+detail.slice(0,180)});}
  return res.status(200).json({url:base+'/storage/v1/object/public/pulso-media/'+objectName});
 }catch(e){return res.status(500).json({error:'Error interno al generar la imagen.'});}
}