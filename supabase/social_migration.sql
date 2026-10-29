-- Ejecuta este archivo en Supabase SQL Editor si la base de datos de Pulso 247 ya existía.
alter table public.articles add column if not exists social_results jsonb not null default '{}'::jsonb;
alter table public.articles add column if not exists social_published_at timestamptz;

insert into public.site_settings(key,value) values
 ('social_facebook',''),('social_instagram',''),('social_x',''),('social_tiktok',''),
 ('social_youtube',''),('social_linkedin',''),('social_telegram','')
on conflict(key) do nothing;

drop policy if exists "Public read site settings" on public.site_settings;
create policy "Public read site settings" on public.site_settings for select to anon, authenticated
using (key in ('stream_title','stream_description','audio_url','video_url','stream_link',
'social_facebook','social_instagram','social_x','social_tiktok','social_youtube','social_linkedin','social_telegram'));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.articles;
  end if;
exception when duplicate_object then null;
end $$;
