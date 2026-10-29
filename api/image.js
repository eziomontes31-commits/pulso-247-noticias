function escXml(s=''){return String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&apos;'}[c]));}
async function saveIllustration(base,service,title,category,region){
 const safeTitle=escXml(String(title||'Pulso 247 Noticias').slice(0,100));
 const safeCat=escXml(String(category||'Actualidad').slice(0,40));
 const safeRegion=escXml(String(region||'Colombia').slice(0,40));
 // Caricatura editorial original creada por SVG: no requiere IA ni coste de generación.
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="Caricatura editorial ilustrativa de Pulso 247">
 <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b1730"/><stop offset="1" stop-color="#263f63"/></linearGradient><linearGradient id="shirt" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d91e36"/><stop offset="1" stop-color="#8e1427"/></linearGradient></defs>
 <rect width="1200" height="675" fill="url(#bg)"/><circle cx="950" cy="130" r="230" fill="#d91e36" opacity=".16"/><path d="M0 560L210 430 370 510 560 380 760 530 970 390 1200 500V675H0Z" fill="#152945"/>
 <g opacity=".3" stroke="#8ea5c5" stroke-width="3"><path d="M60 120h280M60 145h210M900 250h210M900 275h160"/></g>
 <rect x="58" y="50" width="196" height="50" rx="9" fill="#d91e36"/><text x="78" y="83" fill="#fff" font-family="Arial,sans-serif" font-weight="700" font-size="28">PULSO 247</text>
 <!-- personaje caricaturesco ficticio: periodista con cabeza expresiva, micrófono y cámara -->
 <g transform="translate(600 105)"><path d="M-150 470Q-190 345-135 260L-80 225H80L135 260Q190 345 150 470Z" fill="url(#shirt)" stroke="#081326" stroke-width="10"/><path d="M-70 235L0 315 70 235" fill="#fff" stroke="#081326" stroke-width="8"/><path d="M-38 312L0 355 38 312" fill="#d9e4f2"/>
 <path d="M-135 115Q-160 10-80-35Q0-90 82-35Q160 10 135 115L118 190Q80 250 0 255Q-80 250-118 190Z" fill="#f1bd8c" stroke="#081326" stroke-width="10"/>
 <path d="M-145 95Q-170 10-100-48Q-20-100 55-65Q130-45 145 45L110 20Q70-15 30 5Q-30 35-85 10L-125 85Z" fill="#253047" stroke="#081326" stroke-width="10"/>
 <ellipse cx="-52" cy="112" rx="19" ry="25" fill="#fff" stroke="#081326" stroke-width="7"/><ellipse cx="53" cy="112" rx="19" ry="25" fill="#fff" stroke="#081326" stroke-width="7"/><circle cx="-48" cy="115" r="9" fill="#17243b"/><circle cx="57" cy="115" r="9" fill="#17243b"/><path d="M-76 82Q-50 62-25 80M28 80Q55 60 80 82" fill="none" stroke="#17243b" stroke-width="10" stroke-linecap="round"/><path d="M-20 155L-2 145 16 155" fill="none" stroke="#b87953" stroke-width="7" stroke-linecap="round"/><path d="M-40 190Q0 218 42 188" fill="#fff" stroke="#081326" stroke-width="8"/><path d="M-26 193Q0 200 27 192" fill="none" stroke="#d91e36" stroke-width="7"/>
 <path d="M-120 295L-185 355  -158 395 -95 345" fill="#f1bd8c" stroke="#081326" stroke-width="9"/><g transform="translate(-185 350) rotate(-18)"><rect x="-18" y="-42" width="38" height="90" rx="10" fill="#111827" stroke="#fff" stroke-width="4"/><rect x="-26" y="-54" width="54" height="24" rx="8" fill="#d91e36"/><text x="-18" y="-37" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="#fff">247</text></g>
 <path d="M118 300L180 360 150 398 95 346" fill="#f1bd8c" stroke="#081326" stroke-width="9"/><g transform="translate(183 355) rotate(12)"><rect x="-45" y="-32" width="90" height="64" rx="12" fill="#17243b" stroke="#fff" stroke-width="5"/><circle cx="8" cy="0" r="21" fill="#8ca7c8" stroke="#fff" stroke-width="5"/><circle cx="8" cy="0" r="10" fill="#152945"/><rect x="-28" y="-44" width="35" height="14" rx="4" fill="#d91e36"/></g>
 </g>
 <g transform="translate(58 180)"><text x="0" y="0" fill="#f4f7fb" font-family="Arial,sans-serif" font-weight="700" font-size="26">CARICATURA EDITORIAL</text><text x="0" y="42" fill="#c7d5e8" font-family="Arial,sans-serif" font-size="20">${safeCat.toUpperCase()} · ${safeRegion.toUpperCase()}</text><path d="M0 65H300" stroke="#d91e36" stroke-width="7" stroke-linecap="round"/><foreignObject x="0" y="92" width="360" height="250"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:28px;font-weight:700;line-height:1.18;color:#fff;overflow:hidden;max-height:250px">${safeTitle}</div></foreignObject></g>
 <text x="58" y="625" fill="#fff" opacity=".86" font-family="Arial,sans-serif" font-size="19">ILUSTRACIÓN FICTICIA CREADA POR REGLAS · NO REPRESENTA UNA PERSONA REAL NI DOCUMENTA EL HECHO</text></svg>`;
 const objectName='illustrations/cartoon-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.svg';
 const upload=await fetch(base+'/storage/v1/object/pulso-media/'+objectName,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'image/svg+xml','x-upsert':'false'},body:svg});
 if(!upload.ok){const detail=await upload.text();throw new Error('No se pudo guardar la caricatura gratuita en Supabase Storage. '+detail.slice(0,120));}
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
  return res.status(200).json({url,kind:'editorial-cartoon',fallback:true,message:'Gemini no estaba disponible; se creó una caricatura editorial ficticia gratuita mediante SVG. No representa a una persona real ni es una fotografía del hecho.'});
 }catch(e){return res.status(500).json({error:'Error interno al generar la imagen.'});}
}
