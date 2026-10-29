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
   - Opcional: `GEMINI_TEXT_MODEL` = `gemini-3.1-flash-lite` (modelo de texto con nivel gratuito sujeto a límites y disponibilidad de Google).
   - Opcional: `GEMINI_IMAGE_MODEL` = `gemini-3.1-flash-image`.

   **Importante sobre los costos:** Google ofrece un nivel gratuito para determinados modelos de texto Gemini, con límites que pueden cambiar. La generación de imágenes por API no figura como gratuita en la tabla oficial de precios consultada; puede requerir una cuenta de facturación. Si no habilitas facturación, la redacción con IA puede funcionar en el nivel gratuito, pero la generación automática de imágenes puede devolver un error. Consulta https://ai.google.dev/gemini-api/docs/pricing antes de activarla.
5. Despliega. Vuelve a desplegar si cambias variables de entorno.

## 4. Probar
- Abre el dominio Vercel y confirma que aparece la portada.
- Entra a `/admin.html` e inicia sesión con el usuario creado.
- Crea una noticia de prueba con texto propio, guárdala como borrador, luego pulsa **Aprobar y publicar** en Borradores y revisión.
- Vuelve a la portada; debe aparecer la noticia. Comprueba también su enlace de detalle.
- Prueba los filtros y el buscador.
- Para probar la IA, configura todas las variables privadas indicadas y verifica que la cuenta tenga rol admin.

## 5. Transmisión de audio/video
En el administrador abre **Transmisión y configuración** y coloca URLs HTTPS compatibles con el reproductor del navegador:
- Audio: URL directa de un flujo compatible (por ejemplo, Icecast/Shoutcast con configuración CORS adecuada).
- Video: URL directa HLS/MP4 compatible; algunos formatos HLS pueden requerir un reproductor específico.
- Enlace externo: URL de una página de emisión.
No se crea una señal de radio automáticamente: necesitas una fuente de emisión y permisos del proveedor.

## 6. Redes sociales
Añade enlaces a perfiles oficiales desde el contenido o el portal. La publicación automatizada requiere registrar aplicaciones, permisos y tokens oficiales por red social. No pegues tokens en páginas HTML ni en campos públicos.

## 7. Instalar como aplicación
El sitio necesita HTTPS. En Android, abre el dominio en Chrome y usa **Instalar aplicación** o **Añadir a pantalla principal**. En iPhone, abre el dominio en Safari → Compartir → **Añadir a pantalla de inicio**. En PC, usa el icono de instalar del navegador cuando esté disponible.

## 8. Seguridad y limitaciones conocidas
- El rol `admin` es obligatorio para usar el panel. No compartas el usuario.
- Las políticas RLS separan borradores de noticias públicas.
- La clave `service_role` es un secreto crítico: guárdala solo en variables privadas de Vercel.
- La IA produce borradores; revisa fuentes, hechos y derechos de imágenes antes de publicar.
- Las imágenes generadas se guardan en el bucket público `pulso-media` de Supabase Storage (el endpoint de servidor usa la clave secreta); no publiques la clave secreta.
- Este paquete no incluye un proveedor de streaming ni publica automáticamente en redes sociales. Son integraciones externas que deben configurarse.
- Antes de un lanzamiento público, realiza pruebas de seguridad, respaldo/restauración, accesibilidad y carga.
