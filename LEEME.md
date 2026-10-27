# Portal CONTAX · NUMMEROS

Portal donde los repartidores de Yango ven sus pagos, facturas y trámites con CONTAX.
Reemplaza al portal que vivía en Google Apps Script.

- **Página:** https://portalnummeros.contaxbolivia.com (GitHub Pages)
- **Datos y acceso:** Firebase (Authentication + Firestore)
- **De dónde salen los datos:** de los mismos Google Sheets de siempre. GitHub los copia a Firebase **cada 15 minutos**, solo, sin Apps Script.

```
Google Sheets (CONTAX los llena) ──cada 15 min──▶ GitHub (sync/) ──▶ Firebase ──▶ Portal (celular del repartidor)
```

Mientras Firebase no esté configurado, el portal funciona en **modo demostración** con datos de ejemplo.

---

## Configuración (una sola vez, unos 30 minutos)

### Paso 1 · Crear el proyecto de Firebase
1. Entra a https://console.firebase.google.com con tu cuenta personal → **Agregar proyecto** → nombre: `portal-nummeros`. Google Analytics: no hace falta.
2. Menú **Compilación → Authentication → Comenzar** → pestaña **Método de acceso** → **Correo electrónico/contraseña** → activar → Guardar.
3. Menú **Compilación → Firestore Database → Crear base de datos** → ubicación `southamerica-east1 (São Paulo)` → **Modo de producción** → Crear.
4. Arriba a la izquierda, el engranaje **⚙ → Configuración del proyecto** → abajo, en *Tus apps*, el ícono **`</>`** (Web) → nombre `Portal` → **Registrar app** (sin Hosting).
5. Te muestra un bloque `firebaseConfig = { apiKey: ..., authDomain: ..., projectId: ..., appId: ... }`. **Cópialo y pásaselo a Claude** (estos datos no son secretos), o pégalo tú en `config.js`.

### Paso 2 · Generar la llave del robot de sincronización
1. En **⚙ Configuración del proyecto → Cuentas de servicio** → **Generar nueva clave privada** → se descarga un archivo `.json`.
2. ⚠️ Ese archivo **sí es secreto**: no lo mandes por chat ni lo subas al repositorio. Solo va en el Paso 3.
3. Abre el archivo con el Bloc de notas y busca la línea `"client_email"`: algo como `firebase-adminsdk-xxxxx@portal-nummeros.iam.gserviceaccount.com`. Copia ese correo, lo usas en el Paso 4.
4. Activa las dos APIs de Google para ese proyecto (botón **Habilitar** en cada una):
   - https://console.cloud.google.com/apis/library/sheets.googleapis.com
   - https://console.cloud.google.com/apis/library/drive.googleapis.com

   Arriba, en el selector de proyecto, debe decir `portal-nummeros`.

### Paso 3 · Guardar la llave en GitHub
1. En este repositorio: **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `FIREBASE_SERVICE_ACCOUNT`
3. Secret: abre el `.json` del Paso 2, copia **todo** el contenido y pégalo.
4. **Add secret**. Después puedes borrar el archivo `.json` de tu computadora.

### Paso 4 · Darle permiso de lectura al robot
Comparte como **Lector** con el correo `client_email` del Paso 2 (botón *Compartir* de cada archivo, desmarca *Notificar*):
- El archivo principal (BDYANGO, PPendientes, Pagos…).
- Los archivos de trámites: Soporte, Verificación de pólizas y Pagos semanales por desactivación.
- La carpeta de Drive donde están las imágenes de **Anuncios** y **Avisos**.

### Paso 5 · Publicar la página
1. En este repositorio: **Settings → Pages** → *Source*: **Deploy from a branch** → Branch **main** / **(root)** → Save.
2. *Custom domain* ya viene puesto: `portalnummeros.contaxbolivia.com`.
3. En **Squarespace → Dominios → contaxbolivia.com → DNS → Registros personalizados**, agrega:

   | Host | Tipo | Datos |
   |---|---|---|
   | `portalnummeros` | CNAME | `jmenachocntx.github.io` |

4. Espera unos minutos (a veces hasta 1 hora) y vuelve a **Settings → Pages**: marca **Enforce HTTPS**.

### Paso 6 · Primera sincronización
1. Pestaña **Actions → Sincronizar Google Sheets con Firebase → Run workflow**.
2. La primera vez crea una cuenta por cada repartidor; puede tardar varios minutos.
3. Si termina en verde ✅, entra al portal con tu celular y un ID de prueba.
4. Si termina en rojo ❌, abre el paso *Sincronizar*: el mensaje dice qué falta (casi siempre un archivo sin compartir del Paso 4).

### Paso 7 · Apagar el portal viejo
Cuando el nuevo funcione, en Apps Script reemplaza la función `doGet` por esta y crea una **Nueva versión** de la implementación. Así quien tenga el link viejo llega al nuevo:

```javascript
function doGet() {
  const url = 'https://portalnummeros.contaxbolivia.com';
  return HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;text-align:center;padding:40px">' +
    '<h2>El Portal CONTAX se mudó</h2>' +
    '<p><a href="' + url + '" target="_top" style="font-size:18px">Entra aquí: portalnummeros.contaxbolivia.com</a></p></div>'
  ).setTitle('Portal CONTAX').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
```

---

## Panel CONTROL (v3.11)
El equipo ahora maneja todo desde **CONTROL** (repositorio `CONTROL-NUMMEROS`, proyecto Firebase `control--nummeros`), entrando con su cuenta de Google.
- Los dueños (`info@contaxbolivia.com`, `jhonnymenacho04@gmail.com`) tienen acceso total; al resto se le da acceso desde CONTROL → Equipo (colección `equipo` de este proyecto).
- El acceso con Google ya está activado en este proyecto y los dominios de CONTROL están autorizados.
- El panel de administrador de abajo sigue funcionando por ahora; cuando el equipo se acostumbre a CONTROL se puede quitar.

## Mis facturas (v3.11)
- El repartidor sube su factura en PDF (hasta 700 KB) en **Mis facturas**, marca las semanas que cubre y ve el estado: Recibida, Aprobada, Observada (con motivo) o Emitida por CONTAX.
- Corte: **jueves 18:00** (hora de Bolivia). Lo que llega después entra al pago siguiente.
- Se guardan en Firestore: `facturas` (datos) y `facturasPdf` (el PDF). No hace falta el plan Blaze.
- Ya no se pide mandar la factura por WhatsApp.

## Panel de administrador (v3.1)
1. Entra al portal con el usuario de prueba: celular `78015123`, ID `1234`.
2. Ya adentro, el portal pide la **clave de administrador** (secreto `ADMIN_CLAVE` en GitHub; mínimo 10 caracteres).
3. Aparece la sección **Administración**: Panel, Anuncios, Avisos, Preguntas y Chats y lecturas.

- Avisos y preguntas se publican al instante. Las imágenes nuevas tardan unos 15 minutos (el robot las pasa a GitHub).
- Para cambiar la clave: edita el secreto `ADMIN_CLAVE` y corre la sincronización.
- Las hojas **Anuncios, Avisos, FAQ, ChatLog y AvisosLeidos** de CONTROL ya no se usan: se copiaron una sola vez a Firebase (los chats y lecturas viejos quedan en "Chats y lecturas").

## Asistente con IA (DeepSeek por Cloudflare)
- El código está en `asistente/`. GitHub lo publica solo en Cloudflare (`.github/workflows/asistente.yml`).
- Secretos necesarios en GitHub: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DEEPSEEK_API_KEY`.
- La dirección del asistente va en `config.js` → `ia.url`. Si está vacía, el botón "Asistente" no aparece.
- Solo responde a quien inició sesión en el portal y limita 15 preguntas cada 10 minutos por persona.

## Reporte en PDF
En **Reporte** el repartidor elige el período y toca **Descargar PDF**. El PDF se arma en su propio celular (no gasta lecturas de Firebase).

## Cómo entra un repartidor
- **Celular:** el de la columna D de BDYANGO (con o sin 591).
- **ID de Yango:** el de la columna B.

Igual que antes. Si cambian el celular en BDYANGO, a los 15 minutos ya entra con el nuevo.
Si un repartidor sale de BDYANGO, su acceso se desactiva solo.

## Qué se sigue manejando desde Google Sheets
| Hoja | Para qué |
|---|---|
| BDYANGO | Quién puede entrar (ID, nombre, celular) |
| PPendientes / Pagos | Pagos pendientes e historial |
| Habilitados / ASEGURADOS | Alerta de habilitación y estado de póliza |
| Archivos de trámites | Estado de cada formulario |

Los formularios, la encuesta y la configuración de trámites están en `sync/config.mjs`.

## Archivos
| Archivo | Qué es |
|---|---|
| `index.html` | La página y su diseño (marca NUMMEROS) |
| `app.js` | Lo que hace la página |
| `config.js` | Datos de Firebase, WhatsApp, NIT y reglas de pago |
| `firestore.rules` | Seguridad: cada repartidor solo ve lo suyo; el equipo de CONTROL ve todo |
| `facturas.js` | Mis facturas: subir la factura en PDF y ver su estado |
| `sync/` | El robot que copia Sheets → Firebase |
| `.github/workflows/sincronizar.yml` | Cuándo corre el robot (cada 15 min) |
| `marca/` | Logos, letras, íconos y estatuas de NUMMEROS |
| `anuncios/` | Imágenes de anuncios (las pone el robot) |

## Notas
- GitHub pausa las tareas programadas de un repositorio público si pasan 60 días sin ningún cambio. Si eso pasa, en **Actions** aparece un botón para reactivarlas.
- Probar la lógica sin internet: `cd sync && npm install && node probar.mjs`.
