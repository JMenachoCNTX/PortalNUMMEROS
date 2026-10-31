# Portal CONTAX · NUMMEROS (Portal de repartidores)

## Para qué sirve
Página para el **celular de los repartidores de Yango**: ven sus pagos pendientes e historial, suben su
factura en PDF ("Mis facturas"), ven trámites (soporte, pólizas, devoluciones, desactivación), anuncios,
avisos, preguntas frecuentes, descargan su reporte en PDF, reciben notificaciones y usan un asistente con IA.
Reemplazó al portal viejo que vivía en Google Apps Script. **Toda la administración (anuncios, avisos, preguntas, notificaciones, chats y su archivo) se hace desde CONTROL** (repo `CONTROL-NUMMEROS`); el portal ya no tiene panel de administrador.

## Para qué empresa
CONTAX (NUMMEROS by CONTAX), para los repartidores que cobra **MILTHAGOR S.R.L.** (razón social/NIT en `config.js`).

## Cómo está armado (archivos principales)
- `index.html` — página y diseño. `app.js` — lógica principal (login, inicio, pagos, trámites…).
- `facturas.js` (Mis facturas), `reporte.js` (PDF), `chat.js` (asistente), `notificaciones.js` + `firebase-messaging-sw.js` (avisos al celular).
- `config.js` — versión, Firebase, WhatsApp, URL del asistente, secciones ocultas, reglas de pago y `fuentePagos` (`'sheets'` = pagos desde el robot de Google Sheets, como hoy; `'control'` = pagos desde la colección `semanas` que llena CONTROL, con estados Pendiente / Enviado a pagar / Pagado / No habilitado). Se cambia junto con `fuentePagos` de CONTROL.
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
- Versiones: `version` en `config.js` (hoy 3.18) y "(v3.x)" en el mensaje del commit.

## Cuidados importantes
- **El repositorio es PÚBLICO.** El `.json` de la cuenta de servicio y las claves van **solo** en GitHub → Settings → Secrets, nunca en archivos.
- `dominioUsuarios` en `config.js` y `DOMINIO_USUARIOS` en `sync/config.mjs` deben ser iguales y no cambiarse.
- `MINIMO_REPARTIDORES` frena el robot si BDYANGO viene casi vacía: no bajarlo.
- Cambiar columnas o nombres de hojas en Google Sheets rompe la sincronización: actualizar `sync/config.mjs` a la vez.
- Las imágenes de `anuncios/` quedan públicas en GitHub.
- La forma de iniciar sesión y la cuenta de prueba tienen riesgos: ver aviso de seguridad.
- Este proyecto Firebase también lo usa CONTROL; las cuentas del equipo las crea el puente del Panel (`NUMMEROS_CRM`).
- La cuenta de administrador vieja (`admin@portalnummeros.app`, la crea el robot con `ADMIN_CLAVE`) ya no entra al portal: se cierra su sesión sin ningún mensaje (los repartidores no deben ver nada de la administración). El usuario de prueba `1234` sigue funcionando como repartidor de prueba.
- **«Mis facturas»: solo se sube el PDF.** El asistente (`asistente/`, ruta `/factura`) lo lee con **Gemini** (secreto de GitHub `GEMINI_API_KEY`, la misma clave del Panel) y el portal revisa: factura válida, a nombre de MILTHAGOR (NIT 550276028), emitida con el NIT y la razón social registrados, N.º no repetido, fecha válida y **una factura por cada pago**: cada pago pendiente tiene su botón «Adjuntar factura» y el importe debe ser exactamente el de ese pago (no se aceptan facturas por varias semanas). Si algo falla, no se sube y se explica el motivo.
- **NIT una sola vez:** al entrar se pide NIT y razón social (colección `perfiles`). Después solo el equipo lo cambia desde CONTROL.
- **Sin `GEMINI_API_KEY` no se pueden subir facturas**: no publicar cambios del lector sin la clave cargada.
- **Mis documentos** (`documentos.js`): NIT, Matrícula de Comercio (con vigencia; `config.js → documentos.matriculaHasta`), ROE, RCV/F-200/F-400 de los últimos meses y estados financieros (`documentos.gestionEEFF`). Colecciones `documentos` (estado) y `documentosArchivo` (archivo, máx. 700 KB). Se revisan en CONTROL → Documentos.
