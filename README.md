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
- `api/bot-run.js`: genera borradores con IA opcional y búsqueda RSS autónoma de respaldo; requiere `CRON_SECRET` para Cron y crea borradores, no publica automáticamente.
- `supabase/bot_migration.sql`: configura el bot en una base de datos existente.
- `api/health.js`: diagnóstico básico para confirmar que Vercel desplegó las rutas API y ver si faltan variables, sin revelar sus valores.
- `api/image.js`: generación de ilustración (opcional).
- `manifest.webmanifest` y `sw.js`: soporte PWA/caché.
- `CONFIGURACION.md`: guía de puesta en marcha.

## Requisitos para producción
Cuenta Supabase, cuenta Vercel y, para funciones de IA, una clave API del proveedor. La generación de imágenes devuelve una imagen temporal en formato data URL; para producción conviene conectar almacenamiento permanente (Supabase Storage o Cloudinary). El streaming requiere un proveedor externo y una URL compatible.


## Inteligencia artificial de Google
La redacción de borradores utiliza Google Gemini mediante `GEMINI_API_KEY` en Vercel y habilita Google Search grounding para investigar temas a partir de palabras clave. La respuesta JSON se valida, se intenta más de un modelo compatible si hay fallos y los enlaces devueltos por Google se añaden a las fuentes. La generación de imágenes intenta Gemini si está configurado; si no está disponible, crea una ilustración editorial SVG gratuita con etiqueta explícita (no una fotografía ni una imagen generativa real). La búsqueda puede consumir cuota gratuita o generar cargos según el uso y las condiciones de Google. Consulta `CONFIGURACION.md`.

## Integración social

- Los lectores pueden compartir noticias en WhatsApp, Facebook, X, Telegram, LinkedIn y copiar el enlace.
- El administrador gestiona los enlaces públicos oficiales desde **Transmisión y redes**.
- La publicación automática tras aprobar requiere credenciales oficiales de cada red configuradas como variables de entorno en Vercel. Consulte `CONFIGURACION.md`.
- La portada utiliza Supabase Realtime con actualización periódica de respaldo.


## Bot periodístico diario

Desde el panel administrativo se eligen cantidad (máximo 5 por ejecución), cobertura, categorías, territorio y temas. El cron de Vercel se ejecuta a las 11:00 UTC cada día, aproximadamente a las 06:00 en Colombia. La ejecución diaria requiere `CRON_SECRET` y la configuración de Supabase; Gemini es opcional. Todos los resultados quedan como borradores para revisión editorial.


## Modo autónomo y memoria operativa

`api/bot-run.js` no requiere `GEMINI_API_KEY`: si Gemini no está configurado, responde con error o devuelve un resultado inválido, el bot intenta una búsqueda Google News RSS y crea un borrador etiquetado como `Bot autónomo Pulso 247 (RSS)`. Ese borrador solo contiene metadatos disponibles en el feed y una advertencia explícita de que no se ha verificado independientemente; no inventa una noticia cuando no encuentra resultados. Las URLs procesadas se guardan en `site_settings.bot_memory` para reducir duplicados y registrar temas/fuentes por ejecución. Esto es memoria operativa, no entrenamiento automático de un modelo.

`api/image.js` intenta Gemini si está configurado; si falla, crea una caricatura editorial SVG gratuita con un personaje ficticio, titular y categoría. La caricatura no es una foto ni representa a una persona real. Ejecuta `supabase/illustration_migration.sql` en bases existentes para permitir SVG en el bucket `pulso-media`.

Limitación de seguridad editorial: RSS sirve para descubrir enlaces y redactar un borrador preliminar, no para demostrar por sí solo que una noticia es verdadera. El administrador debe abrir la fuente original y contrastar antes de publicar.
