-- Ejecutar en Supabase SQL Editor para permitir guardar imágenes SVG de ilustración/caricatura.
update storage.buckets set allowed_mime_types=array['image/png','image/jpeg','image/webp','image/svg+xml'] where id='pulso-media';
