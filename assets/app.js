(() => {
  const cfg = window.PULSO_CONFIG || {};
  const grid = document.getElementById('newsGrid'), empty = document.getElementById('emptyState');
  let articles = [], activeCategory = 'Todas';
  document.getElementById('year').textContent = new Date().getFullYear();
  function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function dateFmt(d){try{return new Intl.DateTimeFormat('es-CO',{dateStyle:'medium'}).format(new Date(d));}catch{return '';}}
  function render(){
    const q=(document.getElementById('search').value||'').trim().toLowerCase();
    const list=articles.filter(a=>(activeCategory==='Todas'||a.region===activeCategory||a.category===activeCategory)&&(!q||`${a.title} ${a.summary||''} ${a.body||''} ${a.location||''}`.toLowerCase().includes(q)));
    grid.innerHTML=list.map(a=>`<article class="news-card">${a.image_url?`<img class="news-image" src="${esc(a.image_url)}" alt="${esc(a.title)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;news-image-placeholder&quot;>P247</div>'">`:`<div class="news-image-placeholder">P247</div>`}<div class="news-content"><div class="news-meta"><span class="news-tag">${esc(a.region||a.category||'Actualidad')}</span><span>${esc(dateFmt(a.published_at||a.created_at))}</span>${a.location?`<span>· ${esc(a.location)}</span>`:''}</div><h3>${esc(a.title)}</h3><p>${esc(a.summary||String(a.body||'').slice(0,145))}</p><a class="read-more" href="/noticia.html?id=${encodeURIComponent(a.id)}">Leer noticia →</a></div></article>`).join('');
    empty.classList.toggle('hidden',list.length>0); if(!list.length) grid.innerHTML='';
  }
  async function load(){
    if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_URL.includes('TU-PROYECTO')){
      grid.innerHTML='<div class="loading-card"><b>Portal preparado para conectar.</b><p>Configura las credenciales públicas de Supabase en <code>config.js</code> y ejecuta <code>supabase/schema.sql</code>. Consulta CONFIGURACION.md.</p></div>'; return;
    }
    try{
      const url=cfg.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/articles?select=id,title,summary,body,region,category,location,image_url,created_at,published_at&status=eq.published&order=published_at.desc.nullslast&limit=60';
      const r=await fetch(url,{headers:{apikey:cfg.SUPABASE_ANON_KEY,Authorization:'Bearer '+cfg.SUPABASE_ANON_KEY}});
      if(!r.ok) throw new Error('No se pudieron cargar las noticias ('+r.status+').');
      articles=await r.json(); render();
    }catch(e){grid.innerHTML=`<div class="loading-card"><b>No se pudo conectar con las noticias.</b><p>${esc(e.message)} Verifica Supabase y la conexión a internet.</p></div>`;}
  }
  document.getElementById('filters').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;activeCategory=b.dataset.category;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));render();});
  document.getElementById('search').addEventListener('input',render);document.getElementById('searchBtn').addEventListener('click',render);
  document.querySelectorAll('[data-jump]').forEach(a=>a.addEventListener('click',()=>{activeCategory=a.dataset.jump;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x.dataset.category===activeCategory));render();}));
  async function loadStream(){
    if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_URL.includes('TU-PROYECTO'))return;
    try{const r=await fetch(cfg.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/site_settings?select=key,value',{headers:{apikey:cfg.SUPABASE_ANON_KEY,Authorization:'Bearer '+cfg.SUPABASE_ANON_KEY}});if(!r.ok)return;const rows=await r.json(),s={};rows.forEach(x=>s[x.key]=x.value);
      if(s.stream_title)document.getElementById('streamTitle').textContent=s.stream_title;
      if(s.stream_description)document.getElementById('streamDescription').textContent=s.stream_description;
      if(s.audio_url){const a=document.getElementById('audioPlayer');a.src=s.audio_url;a.classList.remove('hidden');}
      if(s.video_url){const v=document.getElementById('videoPlayer');v.src=s.video_url;v.classList.remove('hidden');}
      if(s.stream_link){const l=document.getElementById('streamLink');l.href=s.stream_link;l.classList.remove('hidden');}
    }catch{}
  }
  load();loadStream();
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
})();