-- Pulso 247 Noticias — ejecutar en Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('admin','editor')),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  body text not null,
  region text not null default 'Nacional' check (region in ('Local','Regional','Nacional','Internacional')),
  category text not null default 'Actualidad',
  location text,
  author text,
  image_url text,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','review','published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  social_results jsonb not null default '{}'::jsonb,
  social_published_at timestamptz
);

-- Migración segura para instalaciones existentes.
alter table public.articles add column if not exists social_results jsonb not null default '{}'::jsonb;
alter table public.articles add column if not exists social_published_at timestamptz;
create index if not exists articles_published_idx on public.articles(status,published_at desc);
create index if not exists articles_region_idx on public.articles(region,category);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.site_settings(key,value) values
 ('stream_title','Pulso 247 · Señal en vivo'),
 ('stream_description','Boletines y programas especiales'),
 ('audio_url',''),('video_url',''),('stream_link',''),
 ('social_facebook',''),('social_instagram',''),('social_x',''),('social_tiktok',''),('social_youtube',''),('social_linkedin',''),('social_telegram','')
on conflict(key) do nothing;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at before update on public.articles for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.articles enable row level security;
alter table public.site_settings enable row level security;

-- El público solo puede leer artículos publicados. No hay acceso anónimo a borradores.
drop policy if exists "Public can read published articles" on public.articles;
create policy "Public can read published articles" on public.articles for select to anon, authenticated using (status='published');
drop policy if exists "Admins read all articles" on public.articles;
create policy "Admins read all articles" on public.articles for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "Admins insert articles" on public.articles;
create policy "Admins insert articles" on public.articles for insert to authenticated with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "Admins update articles" on public.articles;
create policy "Admins update articles" on public.articles for update to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "Admins delete articles" on public.articles;
create policy "Admins delete articles" on public.articles for delete to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

-- Perfil: cada usuario autenticado solo puede leer su propio rol.
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated using (id=auth.uid());
-- El público puede leer únicamente ajustes públicos de transmisión.
drop policy if exists "Public read site settings" on public.site_settings;
create policy "Public read site settings" on public.site_settings for select to anon, authenticated using (key in ('stream_title','stream_description','audio_url','video_url','stream_link','social_facebook','social_instagram','social_x','social_tiktok','social_youtube','social_linkedin','social_telegram'));

-- Habilitar eventos de noticias en Supabase Realtime (si la publicación estándar existe).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.articles;
  end if;
exception when duplicate_object then null;
end $$;
drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings" on public.site_settings for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

-- IMPORTANTE: crea primero el usuario desde Supabase Authentication > Users.
-- Luego sustituye el correo de abajo y ejecuta el bloque para darle rol de admin:
-- insert into public.profiles(id, role, display_name)
-- select id, 'admin', 'Administrador Pulso 247' from auth.users where email='eziomontes31@gmail.com'
-- on conflict(id) do update set role='admin';

-- Almacenamiento público de imágenes editoriales. La subida se hace desde el endpoint privado usando service_role.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('pulso-media','pulso-media',true,10485760,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true, file_size_limit=10485760, allowed_mime_types=array['image/png','image/jpeg','image/webp'];
