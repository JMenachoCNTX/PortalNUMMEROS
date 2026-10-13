/**
 * PORTAL CONTAX — LINK ANTIGUO (Apps Script)
 * Versión 3.0 · Migración a NUMMEROS
 *
 * El portal se mudó a https://portalnummeros.contaxbolivia.com
 * Este proyecto queda SOLO para que quien abra el link viejo vea la
 * página de mudanza (archivo "Migracion") y pase al portal nuevo.
 *
 * Cómo instalarlo:
 *  1) Borra todo el contenido de PortalCONTAX.gs y pega este archivo.
 *  2) Crea un archivo HTML llamado  Migracion  y pega Migracion.html.
 *  3) Puedes borrar los archivos App y Tema (ya no se usan).
 *  4) Gestionar implementaciones → lápiz → Versión: Nueva versión → Implementar.
 *     (Así el link de siempre sigue funcionando.)
 */

const PORTAL_NUEVO = 'https://portalnummeros.contaxbolivia.com';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Migracion')
    .setTitle('Portal CONTAX · Nos mudamos a NUMMEROS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* Si alguien tenía abierta la versión vieja del portal, sus botones
   llaman a estas funciones: les respondemos con el aviso de mudanza. */
function _mudanza() {
  return { success: false, message: 'El Portal CONTAX se mudó a ' + PORTAL_NUEVO + '. Cierra esta página y entra ahí.' };
}
function autenticarCliente() { return _mudanza(); }
function obtenerDatosPortal() { return _mudanza(); }
function obtenerVersion() { return { success: true, version: '3.0' }; }
