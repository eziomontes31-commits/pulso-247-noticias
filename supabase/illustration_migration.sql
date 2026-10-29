-- Medios editoriales: fotos, caricaturas SVG y videos breves.
update storage.buckets
set public = true,
    file_size_limit = 83886080,
    allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml','video/mp4','video/webm','video/ogg']
where id = 'pulso-media';

-- Permite leer los ajustes visuales desde el portal público sin exponer datos privados.
drop policy if exists "Public read site settings" on public.site_settings;
create policy "Public read site settings" on public.site_settings
for select to anon, authenticated
using (key in (
  'stream_title','stream_description','audio_url','video_url','stream_link',
  'social_facebook','social_instagram','social_x','social_tiktok','social_youtube','social_linkedin','social_telegram',
  'design_primary','design_accent','design_name','design_logo','design_hero_image'
));

-- Solo usuarios autenticados con perfil admin pueden subir o cambiar archivos editoriales.
drop policy if exists "Pulso admins upload media" on storage.objects;
create policy "Pulso admins upload media" on storage.objects
for insert to authenticated
with check (bucket_id = 'pulso-media' and exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
));

drop policy if exists "Pulso admins update media" on storage.objects;
create policy "Pulso admins update media" on storage.objects
for update to authenticated
using (bucket_id = 'pulso-media' and exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
))
with check (bucket_id = 'pulso-media' and exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
));

drop policy if exists "Pulso admins delete media" on storage.objects;
create policy "Pulso admins delete media" on storage.objects
for delete to authenticated
using (bucket_id = 'pulso-media' and exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
));
