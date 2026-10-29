# Configuración de Pulso 247 Noticias (Windows 11, Vercel y Supabase)

## 1. Crear la base de datos
1. Entra en tu proyecto Supabase.
2. Abre **SQL Editor → New query**.
3. Copia y ejecuta el contenido completo de `supabase/schema.sql`.
4. En **Authentication → Users**, crea tu usuario de administrador con tu correo y una contraseña segura.
5. Copia el UUID de ese usuario.
6. En SQL Editor ejecuta este bloque, cambiando el correo por el tuyo:
```sql
insert into public.profiles(id, role, display_name)
select id, 'admin', 'Administrador Pulso 247'
from auth.users
where email='TU_CORREO_ADMIN'
on conflict(id) do update set role='admin';
```
7. En **Project Settings → API** copia Project URL y la clave pública `anon` o `publishable`. No uses la clave `service_role` en el navegador.

## 2. Configurar el sitio
1. Abre `config.js` y reemplaza `https://TU-PROYECTO.supabase.co` por la URL real de tu proyecto.
2. Reemplaza `TU_CLAVE_PUBLICA_SUPABASE` por la clave pública.
3. Guarda el archivo.
4. Nunca publiques claves privadas, service_role ni claves de IA en `config.js`.

## 3. Publicar en Vercel
1. Descomprime el ZIP.
2. En Vercel crea un proyecto nuevo e importa el repositorio Git que contenga estos archivos, o usa la opción de despliegue que tengas disponible.
3. Framework preset: **Other**; no hace falta comando de build para los archivos estáticos.
4. Configura las variables de entorno privadas si usarás IA:
   - `SUPABASE_URL` = URL del proyecto Supabase
   - `SUPABASE_ANON_KEY` = clave pública anon/publishable
   - `SUPABASE_SERVICE_ROLE_KEY` = clave secreta service_role (solo en Environment Variables de Vercel; jamás en el navegador)
   - `GEMINI_API_KEY` = clave API de Google AI Studio (solo en variables privadas de Vercel; no en HTML ni `config.js`). Puedes crearla en https://aistudio.google.com/apikey.
   - Opcional: `GEMINI_TEXT_MODEL` = `gemini-3.5-flash-lite` (opcional; si falla, el servidor intenta modelos alternativos compatibles). También puedes borrar esta variable para usar la selección automática.
   - Opcional: `GEMINI_IMAGE_MODEL` = `gemini-3.1-flash-image`.

   **Importante sobre los costos:** el asistente periodístico usa Google Search grounding para investigar noticias actuales. Google publica una cuota gratuita mensual para las solicitudes de búsqueda en Gemini 3, pero los límites, la disponibilidad y las condiciones pueden cambiar; el uso por encima de la cuota puede generar cobros. Revisa https://ai.google.dev/gemini-api/docs/google-search y https://ai.google.dev/gemini-api/docs/pricing. La generación de imágenes mediante API puede requerir facturación por separado.
5. Despliega. Vuelve a desplegar si cambias variables de entorno.

## 4. Diagnóstico del servidor de IA
- Después del despliegue, abre `https://TU-DOMINIO.vercel.app/api/health` en el navegador. Debe devolver JSON con `"ok": true` y el estado de configuración (solo verdadero/falso; nunca muestra claves).
- Si devuelve una página HTML de error o 404, la carpeta `api/` no quedó desplegada en la raíz del proyecto Vercel o el último despliegue falló.
- Si `geminiApiKey` aparece `false`, añade `GEMINI_API_KEY` en Vercel y vuelve a desplegar. Revisa de igual forma las cuatro variables indicadas arriba.
- Si la ruta responde correctamente pero la redacción falla, revisa el detalle de `api/generate` en **Deployments → Functions/Logs**. La función ahora intenta modelos de respaldo y devuelve mensajes de error legibles.

## 5. Probar
- Abre el dominio Vercel y confirma que aparece la portada.
- Entra a `/admin.html` e inicia sesión con el usuario creado.
- Crea una noticia de prueba con texto propio, guárdala como borrador, luego pulsa **Aprobar y publicar** en Borradores y revisión.
- Vuelve a la portada; debe aparecer la noticia. Comprueba también su enlace de detalle.
- Prueba los filtros y el buscador.
- Para probar la IA, configura todas las variables privadas indicadas y verifica que la cuenta tenga rol admin. En **Redactar noticia**, escribe palabras clave en “Tema o palabras clave para investigar” y pulsa **Buscar y redactar con IA**. El sistema buscará en Google, preparará el borrador e incorporará los enlaces que devuelva la búsqueda. Revisa manualmente cada fuente antes de aprobar.

## 6. Transmisión de audio/video
En el administrador abre **Transmisión y configuración** y coloca URLs HTTPS compatibles con el reproductor del navegador:
- Audio: URL directa de un flujo compatible (por ejemplo, Icecast/Shoutcast con configuración CORS adecuada).
- Video: URL directa HLS/MP4 compatible; algunos formatos HLS pueden requerir un reproductor específico.
- Enlace externo: URL de una página de emisión.
No se crea una señal de radio automáticamente: necesitas una fuente de emisión y permisos del proveedor.

## 7. Redes sociales
Añade enlaces a perfiles oficiales desde el contenido o el portal. La publicación automatizada requiere registrar aplicaciones, permisos y tokens oficiales por red social. No pegues tokens en páginas HTML ni en campos públicos.

## 8. Instalar como aplicación
El sitio necesita HTTPS. En Android, abre el dominio en Chrome y usa **Instalar aplicación** o **Añadir a pantalla principal**. En iPhone, abre el dominio en Safari → Compartir → **Añadir a pantalla de inicio**. En PC, usa el icono de instalar del navegador cuando esté disponible.

## 9. Seguridad y limitaciones conocidas
- El rol `admin` es obligatorio para usar el panel. No compartas el usuario.
- Las políticas RLS separan borradores de noticias públicas.
- La clave `service_role` es un secreto crítico: guárdala solo en variables privadas de Vercel.
- La IA produce borradores usando búsqueda web de Google cuando está disponible; revisa fuentes, fechas, hechos y derechos de imágenes antes de publicar. Si no llegan enlaces verificables, el borrador incluirá una advertencia editorial.
- Las imágenes generadas se guardan en el bucket público `pulso-media` de Supabase Storage (el endpoint de servidor usa la clave secreta); no publiques la clave secreta.
- Este paquete no incluye un proveedor de streaming ni publica automáticamente en redes sociales. Son integraciones externas que deben configurarse.
- Antes de un lanzamiento público, realiza pruebas de seguridad, respaldo/restauración, accesibilidad y carga.

## Redes sociales y publicación automática

### 1. Enlaces visibles para lectores

Entra en `admin.html` → **Transmisión y redes** y completa las URL públicas de Facebook, Instagram, X, TikTok, YouTube, LinkedIn y Telegram. Pulsa **Guardar enlaces oficiales**. Los enlaces públicos aparecerán en el pie de la portada; cada noticia tendrá botones para compartir por WhatsApp, Facebook, X, Telegram, LinkedIn y copiar el enlace. En móviles también aparece la opción de compartir del sistema.

### 2. Publicación automática al aprobar una noticia

La publicación automática ocurre cuando un administrador pulsa **Aprobar y publicar** en la lista de noticias. El código de esta versión publica por API en Facebook Pages, Instagram profesional (con imagen), Telegram, X y LinkedIn cuando sus credenciales están autorizadas. TikTok y YouTube aparecen como enlaces públicos, pero la publicación automática allí requiere flujos de video y permisos específicos que no se activan solo con un enlace de perfil. No se ejecuta al guardar un borrador. Para activar una red, configura únicamente en **Vercel → Settings → Environment Variables** las variables que correspondan:

- `SITE_URL`: dominio público completo, por ejemplo `https://tu-proyecto.vercel.app`.
- Facebook Pages: `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`.
- Instagram profesional: `INSTAGRAM_BUSINESS_ACCOUNT_ID` y `FACEBOOK_PAGE_ACCESS_TOKEN`. La cuenta profesional debe estar vinculada a la página de Meta y la noticia debe tener una imagen pública HTTPS.
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Añade el bot como administrador del canal o dale permiso para publicar.
- X: `X_USER_ACCESS_TOKEN` con autorización OAuth de usuario y permiso de escritura (`tweet.write`).
- LinkedIn: `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN` (por ejemplo, URN de la organización autorizada) y opcional `LINKEDIN_VERSION` (por defecto `202610`).
- Meta opcional: `META_GRAPH_VERSION` (por defecto `v23.0`; cambia a una versión activa si Meta la retira).

No pongas tokens ni claves privadas en `config.js`, HTML, mensajes públicos o el formulario de enlaces. Estas integraciones requieren crear aplicaciones en las plataformas, aceptar sus condiciones y conceder los permisos de publicación. Si una red no está configurada, el portal la marcará como omitida; si la API rechaza la publicación, el administrador verá el motivo.

### 3. Base de datos

Si es una instalación nueva, ejecuta `supabase/schema.sql` en Supabase SQL Editor. Si ya tenías Pulso 247 instalado, ejecuta `supabase/social_migration.sql` para añadir `social_results`, `social_published_at`, los enlaces públicos y habilitar Realtime. Si el SQL informa que la tabla ya está en la publicación Realtime, no es un error importante.

### 4. Actualización de noticias

La portada se suscribe a Supabase Realtime para refrescarse cuando cambien artículos y usa una consulta periódica de respaldo. La distribución social se intenta inmediatamente después de la aprobación editorial. Una red externa puede tardar unos segundos o rechazar una publicación por permisos, cuotas, imagen no accesible o token vencido; por eso el panel muestra el resultado por red.


## Bot periodístico diario (nuevo)

1. Ejecuta `supabase/bot_migration.sql` en SQL Editor si ya instalaste la base de datos. En una instalación nueva, `schema.sql` ya incluye `bot_config`.
2. En Vercel → Settings → Environment Variables agrega `CRON_SECRET` con un valor aleatorio largo (mínimo 16 caracteres), además de las variables de Supabase. `GEMINI_API_KEY` es opcional para el modo autónomo. No lo compartas.
3. Despliega de nuevo. `vercel.json` registra un cron diario a las 11:00 UTC (aprox. 06:00 hora de Colombia; en plan Hobby puede ejecutarse en cualquier minuto de esa hora).
4. En `/admin.html` → Transmisión y redes → Bot periodístico diario, elige hasta 5 borradores por ejecución, coberturas, categorías, territorio y temas. Pulsa Guardar configuración del bot. Usa Ejecutar bot ahora para probar manualmente.
5. El bot crea borradores en Supabase y no los publica automáticamente. Revisa fuentes, fechas y afirmaciones y aprueba manualmente. Las funciones Cron y las funciones serverless están sujetas a límites de duración y cuota del plan Vercel.

### Imágenes, narración y avatar

La función de imágenes intenta generar con Gemini si está configurado; si no hay clave, la API falla o el modelo no devuelve imagen, crea una ilustración SVG editorial gratuita y la etiqueta claramente. Esa alternativa es una composición gráfica, no una imagen generativa ni una fotografía del hecho. Para Gemini, la disponibilidad y el costo dependen del modelo y de la cuenta. Para narración gratuita se puede usar la voz integrada del navegador, pero eso no clona una voz ni crea un avatar de vídeo profesional. La clonación de voz/rostro requiere archivos de la persona con su consentimiento explícito y normalmente un proveedor especializado; no se ha activado en esta entrega para evitar simular una integración que aún no está configurada.


## Bot autónomo cuando la IA no está disponible

El bot diario funciona aunque no exista `GEMINI_API_KEY`. Primero intenta Gemini cuando la clave está configurada; si no está disponible, recurre a Google News RSS sin clave y prepara un borrador preliminar con la URL, titular y metadatos disponibles. Los borradores del modo RSS quedan expresamente marcados para verificación humana y no se publican solos. `GEMINI_API_KEY` solo es necesaria para redacción avanzada e imágenes generativas. El bot guarda memoria operativa en `site_settings` (enlaces procesados y estadísticas de temas/fuentes) para reducir duplicados; no implica que un modelo se entrene automáticamente.

Para caricaturas, el botón de imagen intenta Gemini y, si falla, crea una caricatura editorial SVG gratuita. Ejecuta `supabase/illustration_migration.sql` en SQL Editor para habilitar SVG, fotos y videos de hasta 80 MB, permisos de carga solo para administradores y lectura pública de la configuración visual.


## Editor visual, medios y copias de seguridad

- En **Redactar noticia**, selecciona una foto o video del equipo. Se muestra una vista previa local y, al guardar, el archivo se sube a `pulso-media` en Supabase Storage. Se aceptan imágenes PNG/JPEG/WebP/SVG y videos MP4/WebM/OGG de hasta 80 MB; para una carga rápida, comprime los videos antes de subirlos.
- Pulsa **Vista previa antes de publicar** para revisar la noticia en formato computadora o celular. La vista previa no publica por sí sola. Los borradores que contienen notas internas de verificación no se pueden aprobar desde esa ventana.
- En **Diseño del portal** se pueden configurar colores, nombre, logotipo y una imagen de portada. Los cambios visuales se guardan en `site_settings` y se aplican en el portal público.
- En **Almacenamiento**, Supabase es el almacenamiento compartido principal. Disco duro y USB son útiles para seleccionar archivos o guardar una copia exportada. Google Drive, OneDrive y Dropbox necesitan una integración OAuth/API adicional; seleccionar la opción no crea una conexión por sí solo.
- Ejecuta la migración `supabase/illustration_migration.sql` también si ya instalaste Pulso 247 antes de esta versión. La migración reemplaza la política de lectura pública de ajustes para incluir solo los nuevos campos visuales, sin abrir las claves secretas.
