# Portal CONTAX · NUMMEROS (Portal de repartidores)

## Para qué sirve
Página para el **celular de los repartidores de Yango**: ven sus pagos pendientes e historial, suben su
factura en PDF ("Mis facturas"), ven trámites (soporte, pólizas, devoluciones, desactivación), anuncios,
avisos, preguntas frecuentes, descargan su reporte en PDF, reciben notificaciones y usan un asistente con IA.
Reemplazó al portal viejo que vivía en Google Apps Script. El equipo lo administra desde **CONTROL** (repo `CONTROL-NUMMEROS`).

## Para qué empresa
CONTAX (NUMMEROS by CONTAX), para los repartidores que cobra **MILTHAGOR S.R.L.** (razón social/NIT en `config.js`).

## Cómo está armado (archivos principales)
- `index.html` — página y diseño. `app.js` — lógica principal (login, inicio, pagos, trámites…).
- `facturas.js` (Mis facturas), `reporte.js` (PDF), `chat.js` (asistente), `notificaciones.js` + `firebase-messaging-sw.js` (avisos al celular).
- `admin.js` — panel de administrador viejo dentro del portal (sigue funcionando; CONTROL lo reemplaza).
- `config.js` — versión, Firebase, WhatsApp, URL del asistente, secciones ocultas, reglas de pago.
- `firestore.rules` — reglas del proyecto `portal-nummeros`.
- `sync/` — robot Node.js que copia Google Sheets → Firebase (`config.mjs` = hojas, columnas, trámites; `probar.mjs` = prueba sin internet).
- `asistente/` — Cloudflare Worker (DeepSeek) del asistente con IA.
- `.github/workflows/sincronizar.yml` y `asistente.yml` — tareas automáticas de GitHub Actions.
- `apps-script-migracion/` — código para dejar el link viejo de Apps Script mostrando "nos mudamos".
- `anuncios/` — imágenes de anuncios (las sube el robot solo). `marca/` — logos, fuentes, fotos.

## Dónde se guardan los datos
- **Google Sheets** (fuente): archivo principal con BDYANGO, PPendientes, HistPagosMTG, Habilitados, ASEGURADOS, Anuncios, Avisos, FAQ; y archivos aparte de trámites. IDs en `sync/config.mjs`.
- **Firebase `portal-nummeros`**: Authentication (una cuenta por repartidor, creada por el robot) y Firestore: `repartidores` (+ `lecturas`), `publico`, `facturas`, `facturasPdf`, `imagenes`, `chats`, `notificaciones`, `colaNotif`, `privado`, `archivo`.
- El repartidor entra con su **celular** (BDYANGO col. D) y su **ID de Yango** (col. B).

## Cómo se publica
- GitHub Pages, rama `main` (raíz), dominio `portalnummeros.contaxbolivia.com` (archivo `CNAME`; DNS en Squarespace).
- **Sincronización:** `sincronizar.yml` corre en GitHub Actions cada 15 min (se relanza sola; respaldo cada 3 h). Usa los secretos de GitHub `FIREBASE_SERVICE_ACCOUNT` y `ADMIN_CLAVE`. GitHub pausa estas tareas si el repo pasa 60 días sin cambios.
- **Asistente:** `asistente.yml` lo publica en Cloudflare al cambiar `asistente/`. Secretos: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DEEPSEEK_API_KEY`.
- **Reglas:** el robot de sincronización intenta publicar `firestore.rules` al cambiar; si no, se pegan a mano en la consola de Firebase (`portal-nummeros`).
- **Apps Script viejo:** se pega a mano `apps-script-migracion/` y se crea una nueva versión de la implementación.
- Versiones: `version` en `config.js` (hoy 3.11) y "(v3.x)" en el mensaje del commit.

## Cuidados importantes
- **El repositorio es PÚBLICO.** El `.json` de la cuenta de servicio y las claves van **solo** en GitHub → Settings → Secrets, nunca en archivos.
- `dominioUsuarios` en `config.js` y `DOMINIO_USUARIOS` en `sync/config.mjs` deben ser iguales y no cambiarse.
- `MINIMO_REPARTIDORES` frena el robot si BDYANGO viene casi vacía: no bajarlo.
- Cambiar columnas o nombres de hojas en Google Sheets rompe la sincronización: actualizar `sync/config.mjs` a la vez.
- Las imágenes de `anuncios/` quedan públicas en GitHub.
- La forma de iniciar sesión y la cuenta de prueba tienen riesgos: ver aviso de seguridad.
- Este proyecto Firebase también lo usa CONTROL; las cuentas del equipo las crea el puente del Panel (`NUMMEROS_CRM`).
