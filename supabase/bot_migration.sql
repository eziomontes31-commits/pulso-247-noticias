-- Ejecutar en Supabase SQL Editor para instalaciones existentes.
-- La configuración del bot contiene solo preferencias editoriales, nunca tokens secretos.
insert into public.site_settings(key,value) values (
  'bot_config', '{"enabled":true,"dailyCount":3,"location":"Córdoba, Colombia","topics":["lluvias","movilidad","gobernación y alcaldías","educación","salud","seguridad","empleo"],"regions":["Local","Regional","Nacional"],"categories":["Actualidad","Política","Economía","Comunidad"]}'
) on conflict(key) do nothing;
