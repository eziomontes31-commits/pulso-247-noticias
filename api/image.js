function escXml(s=''){return String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&apos;'}[c]));}
async function saveIllustration(base,service,title,category,region){
 const safeTitle=escXml(String(title||'Pulso 247 Noticias').slice(0,100));const safeCat=escXml(String(category||'Actualidad').slice(0,40));const safeRegion=escXml(String(region||'Colombia').slice(0,40));
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101d33"/><stop offset="1" stop-color="#263e60"/></linearGradient></defs><rect width="1200" height="675" fill="url(#g)"/><circle cx="1000" cy="140" r="230" fill="#d91e36" opacity=".20"/><circle cx="1080" cy="500" r="190" fill="#ffffff" opacity=".06"/><path d="M0 560 L260 350 L430 480 L660 280 L890 510 L1200 300 L1200 675 L0 675Z" fill="#d91e36" opacity=".55"/><rect x="64" y="64" width="180" height="48" rx="8" fill="#d91e36"/><text x="84" y="96" fill="#fff" font-family="Arial,sans-serif" font-weight="700" font-size="26">PULSO 247</text><text x="64" y="190" fill="#fff" font-family="Arial,sans-serif" font-weight="700" font-size="24" opacity=".85">${safeCat.toUpperCase()} · ${safeRegion.toUpperCase()}</text><foreignObject x="64" y="225" width="1020" height="220"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:54px;font-weight:700;line-height:1.12;color:#fff;overflow:hidden;max-height:220px">${safeTitle}</div></foreignObject><text x="64" y="620" fill="#fff" opacity=".82" font-family="Arial,sans-serif" font-size="22">ILUSTRACIÓN EDITORIAL · NO ES UNA FOTOGRAFÍA DEL HECHO</text></svg>`;
 const objectName='illustrations/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.svg';
 const upload=await fetch(base+'/storage/v1/object/pulso-media/'+objectName,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'image/svg+xml','x-upsert':'false'},body:svg});
 if(!upload.ok){const detail=await upload.text();throw new Error('No se pudo guardar la ilustración gratuita en Supabase Storage. '+detail.slice(0,120));}
 return base+'/storage/v1/object/public/pulso-media/'+objectName;
}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
 const auth=req.headers.authorization||'',token=auth.startsWith('Bearer ')?auth.slice(7):'';
 if(!token)return res.status(401).json({error:'Debes iniciar sesión como administrador.'});
 const base=(process.env.SUPABASE_URL||'').replace(/\/$/,'');const anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY,apiKey=process.env.GEMINI_API_KEY;
 if(!base||!anon||!service)return res.status(503).json({error:'Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en Vercel.'});
 try{
  const u=await fetch(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token}});if(!u.ok)return res.status(401).json({error:'Sesión no válida.'});const user=await u.json();
  const pr=await fetch(base+'/rest/v1/profiles?select=role&id=eq.'+encodeURIComponent(user.id),{headers:{apikey:service,Authorization:'Bearer '+service}});const roles=await pr.json();if(!pr.ok||roles[0]?.role!=='admin')return res.status(403).json({error:'Solo el administrador puede generar imágenes.'});
  const {title='',summary='',region='Nacional',category='Actualidad',location=''}=req.body||{};
  const prompt=`Crea una ilustración editorial original para acompañar una noticia de un medio informativo colombiano. Tema: ${title}. Contexto disponible: ${summary}. Región: ${region}. Categoría: ${category}. Lugar: ${location}. Estilo documental editorial sobrio, profesional, composición limpia, sin texto, sin logotipos, sin representar personas reales identificables ni simular una fotografía auténtica de un suceso real. La imagen es ilustrativa.`;
  if(apiKey){
   try{
    const model=process.env.GEMINI_IMAGE_MODEL||'gemini-3.1-flash-image';
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseModalities:['TEXT','IMAGE']}}),signal:AbortSignal.timeout(45000)});
    const d=await r.json();if(r.ok){const parts=d.candidates?.[0]?.content?.parts||[];const imagePart=parts.find(p=>p.inlineData?.data);if(imagePart){const mime=imagePart.inlineData.mimeType||'image/png';const ext=mime.includes('jpeg')?'jpg':mime.includes('webp')?'webp':'png';const bytes=Buffer.from(imagePart.inlineData.data,'base64');const objectName='ai/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+ext;const upload=await fetch(base+'/storage/v1/object/pulso-media/'+objectName,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':mime,'x-upsert':'false'},body:bytes});if(upload.ok)return res.status(200).json({url:base+'/storage/v1/object/public/pulso-media/'+objectName,kind:'ai-image',message:'Imagen generada por Gemini.'});}}
   }catch(e){console.warn('[Pulso image] Gemini no disponible; se usará ilustración gratuita:',e.message);}
  }
  const url=await saveIllustration(base,service,title,category,region);
  return res.status(200).json({url,kind:'editorial-illustration',fallback:true,message:'Se creó una ilustración editorial gratuita. No es una fotografía real ni una imagen generada por IA; para generar imágenes fotorrealistas, configura un modelo de imagen compatible.'});
 }catch(e){return res.status(500).json({error:'Error interno al generar la imagen.'});}
}
