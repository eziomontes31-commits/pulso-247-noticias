# Pulso 247 Noticias

Portal editorial en español, con portal público, panel administrativo separado, base de datos Supabase, endpoints de IA opcionales y PWA instalable.

## Contenido
- `index.html`: portal público.
- `noticia.html`: detalle de noticia.
- `admin.html`: panel privado de redacción y revisión.
- `assets/`: estilos, scripts e icono.
- `config.js`: URL de Supabase y clave pública del navegador.
- `supabase/schema.sql`: tablas, índices y políticas RLS.
- `api/generate.js`: asistente periodístico con búsqueda web de Google, modelos alternativos, salida JSON validada y errores explicativos (requiere `GEMINI_API_KEY`).
- `api/health.js`: diagnóstico básico para confirmar que Vercel desplegó las rutas API y ver si faltan variables, sin revelar sus valores.
- `api/image.js`: generación de ilustración (opcional).
- `manifest.webmanifest` y `sw.js`: soporte PWA/caché.
- `CONFIGURACION.md`: guía de puesta en marcha.

## Requisitos para producción
Cuenta Supabase, cuenta Vercel y, para funciones de IA, una clave API del proveedor. La generación de imágenes devuelve una imagen temporal en formato data URL; para producción conviene conectar almacenamiento permanente (Supabase Storage o Cloudinary). El streaming requiere un proveedor externo y una URL compatible.


## Inteligencia artificial de Google
La redacción de borradores utiliza Google Gemini mediante `GEMINI_API_KEY` en Vercel y habilita Google Search grounding para investigar temas a partir de palabras clave. La respuesta JSON se valida, se intenta más de un modelo compatible si hay fallos y los enlaces devueltos por Google se añaden a las fuentes. La generación de imágenes usa el modelo Gemini de imágenes configurado en `GEMINI_IMAGE_MODEL`; puede requerir facturación y no debe asumirse gratuita. La búsqueda puede consumir cuota gratuita o generar cargos según el uso y las condiciones de Google. Consulta `CONFIGURACION.md`.
