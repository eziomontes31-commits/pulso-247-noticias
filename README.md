# Pulso 247 Noticias

Portal editorial en español, con portal público, panel administrativo separado, base de datos Supabase, endpoints de IA opcionales y PWA instalable.

## Contenido
- `index.html`: portal público.
- `noticia.html`: detalle de noticia.
- `admin.html`: panel privado de redacción y revisión.
- `assets/`: estilos, scripts e icono.
- `config.js`: URL de Supabase y clave pública del navegador.
- `supabase/schema.sql`: tablas, índices y políticas RLS.
- `api/generate.js`: generación de borradores con IA (opcional).
- `api/image.js`: generación de ilustración (opcional).
- `manifest.webmanifest` y `sw.js`: soporte PWA/caché.
- `CONFIGURACION.md`: guía de puesta en marcha.

## Requisitos para producción
Cuenta Supabase, cuenta Vercel y, para funciones de IA, una clave API del proveedor. La generación de imágenes devuelve una imagen temporal en formato data URL; para producción conviene conectar almacenamiento permanente (Supabase Storage o Cloudinary). El streaming requiere un proveedor externo y una URL compatible.
