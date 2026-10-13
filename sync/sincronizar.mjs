/* ══════════════════════════════════════════════════════════
   SINCRONIZACIÓN  Google Sheets → Firebase
   La ejecuta GitHub cada 15 minutos (.github/workflows/sincronizar.yml).
   Necesita el secreto FIREBASE_SERVICE_ACCOUNT (la llave JSON de la
   cuenta de servicio de Firebase). Esa cuenta debe tener acceso de
   LECTOR a los Google Sheets y a las imágenes de Drive.
   ══════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleAuth } from 'google-auth-library';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getSecurityRules } from 'firebase-admin/security-rules';
import * as CFG from './config.mjs';
import { armar, documentoRepartidor, correoDe, claveDe, huella, idDrive, texto } from './logica.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const CARPETA_IMG = path.join(RAIZ, 'anuncios');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ── 1. Credenciales ── */
const secreto = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!secreto || !secreto.trim().startsWith('{')) {
  console.log('::warning::Falta el secreto FIREBASE_SERVICE_ACCOUNT. Sigue la guía (LEEME.md, paso 3). No se sincronizó nada.');
  process.exit(0);
}
const cuenta = JSON.parse(secreto);
initializeApp({ credential: cert(cuenta) });
const db = getFirestore();
const auth = getAuth();
const google = new GoogleAuth({
  credentials: cuenta,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly']
});
let token = null;
async function cabeceras() {
  if (!token) token = (await (await google.getClient()).getAccessToken()).token;
  return { Authorization: 'Bearer ' + token };
}

/* ── 2. Lectura de Google Sheets ── */
async function leerRangos(archivo, rangos, { opcional = false } = {}) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + archivo + '/values:batchGet?' +
    rangos.map(r => 'ranges=' + encodeURIComponent(r)).join('&') +
    '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING';
  const res = await fetch(url, { headers: await cabeceras() });
  if (!res.ok) {
    const txt = await res.text();
    if (opcional) { log('  (no se pudo leer ' + rangos.join(', ') + ': ' + res.status + ')'); return rangos.map(() => []); }
    if (res.status === 403 && /SERVICE_DISABLED|has not been used|is disabled/i.test(txt))
      throw new Error('La API de Google Sheets no está activada en el proyecto ' + cuenta.project_id + '. Actívala aquí: https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=' + cuenta.project_id + ' (espera 2 minutos y vuelve a correr).');
    if (res.status === 403) throw new Error('Sin permiso para leer el archivo ' + archivo + '. Compártelo como LECTOR con ' + cuenta.client_email + ' · Detalle: ' + txt.replace(/\s+/g, ' ').slice(0, 300));
    throw new Error('Error leyendo ' + rangos.join(', ') + ' (' + res.status + '): ' + txt.slice(0, 300));
  }
  const j = await res.json();
  return (j.valueRanges || []).map(v => v.values || []);
}
const hoja = n => "'" + String(n).replace(/'/g, "''") + "'";

async function leerTodo() {
  const H = CFG.HOJAS;
  log('Leyendo el archivo principal…');
  const [login, pendientes, pagos, habilitados, asegurados] = await leerRangos(CFG.SPREADSHEET_ID, [
    hoja(H.login.nombre) + '!A2:D', hoja(H.pendientes.nombre) + '!A2:M', hoja(H.pagos.nombre) + '!A2:F',
    hoja(H.habilitados.nombre) + '!A2:A', hoja(H.asegurados.nombre) + '!A2:A'
  ]);
  const [anuncios] = await leerRangos(CFG.SPREADSHEET_ID, [hoja(H.anuncios.nombre) + '!A2:G'], { opcional: true });
  const [avisos] = await leerRangos(CFG.SPREADSHEET_ID, [hoja(H.avisos.nombre) + '!A2:K'], { opcional: true });
  const [faq] = await leerRangos(CFG.FAQ_SPREADSHEET_ID || CFG.SPREADSHEET_ID, [hoja(H.faq.nombre) + '!A2:E'], { opcional: true });

  const tramites = {};
  for (const t of CFG.TRAMITES) {
    if (!t.archivoId) continue;
    log('Leyendo trámites: ' + t.nombre);
    const [filas] = await leerRangos(t.archivoId, [hoja(t.hoja)], { opcional: true });
    tramites[t.clave] = filas;
  }
  log('BDYANGO: ' + login.length + ' filas · PPendientes: ' + pendientes.length + ' · Pagos: ' + pagos.length);
  return { login, pendientes, pagos, habilitados, asegurados, anuncios, avisos, faq, tramites };
}

/* ── 3. Imágenes de Drive → carpeta anuncios/ del sitio ── */
const usadas = new Set();
const pendientesDescarga = new Map();
function rutaImagen(valor) {
  const t = texto(valor);
  if (!t) return '';
  const id = idDrive(t);
  if (!id) return /^https:\/\//i.test(t) ? t : '';
  const existente = fs.existsSync(CARPETA_IMG) && fs.readdirSync(CARPETA_IMG).find(f => f.startsWith(id + '.'));
  const archivo = existente || id + '.jpg';
  usadas.add(archivo);
  if (!existente) pendientesDescarga.set(id, archivo);
  return 'anuncios/' + archivo;
}
async function descargarImagenes() {
  fs.mkdirSync(CARPETA_IMG, { recursive: true });
  for (const [id, archivo] of pendientesDescarga) {
    try {
      const meta = await (await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=mimeType,size&supportsAllDrives=true', { headers: await cabeceras() })).json();
      if (!meta.mimeType || !meta.mimeType.startsWith('image/')) { log('  Imagen ' + id + ': no es una imagen o no hay permiso (' + (meta.error ? meta.error.message : meta.mimeType) + ')'); continue; }
      const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[meta.mimeType] || 'jpg';
      const res = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media&supportsAllDrives=true', { headers: await cabeceras() });
      const buf = Buffer.from(await res.arrayBuffer());
      const final = id + '.' + ext;
      fs.writeFileSync(path.join(CARPETA_IMG, final), buf);
      if (final !== archivo) { usadas.delete(archivo); usadas.add(final); }
      log('  Imagen descargada: ' + final + ' (' + Math.round(buf.length / 1024) + ' KB)');
    } catch (e) { log('  No se pudo descargar la imagen ' + id + ': ' + e.message); }
  }
  for (const f of fs.readdirSync(CARPETA_IMG)) {
    if (f !== '.gitkeep' && !usadas.has(f)) { fs.unlinkSync(path.join(CARPETA_IMG, f)); log('  Imagen ya no usada, borrada: ' + f); }
  }
}

/* ── 4. Cuentas de acceso (Firebase Authentication) ── */
async function enParalelo(lista, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < lista.length) { const x = lista[i++]; await fn(x); } }));
}
async function sincronizarCuentas(repartidores, estado) {
  const cambios = [];
  for (const r of repartidores.values()) {
    const email = correoDe(r.id, CFG.DOMINIO_USUARIOS), password = claveDe(r.celular, r.id);
    const h = huella([email, password]);
    if (estado.cuentas[r.uid] !== h) cambios.push({ r, email, password, h });
  }
  log('Cuentas a crear o actualizar: ' + cambios.length);
  let ok = 0, mal = 0;
  await enParalelo(cambios, 6, async ({ r, email, password, h }) => {
    try {
      try { await auth.updateUser(r.uid, { email, password, disabled: false, displayName: r.nombre.slice(0, 100) }); }
      catch (e) {
        if (e.code !== 'auth/user-not-found') throw e;
        await auth.createUser({ uid: r.uid, email, password, displayName: r.nombre.slice(0, 100) });
      }
      estado.cuentas[r.uid] = h; ok++;
    } catch (e) { mal++; log('  Cuenta ' + r.id + ': ' + e.message); }
  });
  // Los que ya no están en BDYANGO: se desactivan (no se borran)
  const fuera = Object.keys(estado.cuentas).filter(uid => !repartidores.has(uid));
  await enParalelo(fuera, 6, async uid => {
    try { await auth.updateUser(uid, { disabled: true }); } catch (e) { if (e.code !== 'auth/user-not-found') log('  Desactivar ' + uid + ': ' + e.message); }
    delete estado.cuentas[uid];
  });
  log('Cuentas listas: ' + ok + (mal ? ' · con error: ' + mal : '') + (fuera.length ? ' · desactivadas: ' + fuera.length : ''));
}

/* ── 5. Reglas de seguridad de Firestore ── */
async function publicarReglas(estado) {
  const reglas = fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8');
  const h = huella(reglas);
  if (estado.reglas === h) return;
  try {
    await getSecurityRules().releaseFirestoreRulesetFromSource(reglas);
    estado.reglas = h;
    log('Reglas de seguridad publicadas.');
  } catch (e) {
    console.log('::warning::No se pudieron publicar las reglas automáticamente (' + e.message + '). Cópialas a mano: Firebase → Firestore → Reglas.');
  }
}

/* ══════════ PRINCIPAL ══════════ */
async function principal() {
  const refEstado = db.collection('privado').doc('estado');
  const snap = await refEstado.get();
  const estado = Object.assign({ cuentas: {}, datos: {}, publico: '', reglas: '', total: 0 }, snap.exists ? snap.data() : {});

  await publicarReglas(estado);

  const tablas = await leerTodo();
  const { repartidores, publico, avisosLog } = armar(tablas, CFG, { imagen: rutaImagen });
  avisosLog.forEach(a => console.log('::warning::' + a));
  log('Repartidores válidos: ' + repartidores.size);

  if (estado.total && repartidores.size < estado.total * CFG.MINIMO_REPARTIDORES) {
    throw new Error('BDYANGO trajo ' + repartidores.size + ' repartidores, antes había ' + estado.total +
      '. Por seguridad no se cambió nada. Revisa la hoja; si el cambio es correcto, borra el documento privado/estado en Firestore.');
  }

  await descargarImagenes();
  await sincronizarCuentas(repartidores, estado);

  // Datos de cada repartidor: solo se escriben los que cambiaron
  const escritor = db.bulkWriter();
  let escritos = 0, borrados = 0;
  for (const r of repartidores.values()) {
    const doc = documentoRepartidor(r);
    const h = huella(doc);
    if (estado.datos[r.uid] === h) continue;
    escritor.set(db.collection('repartidores').doc(r.uid), { ...doc, actualizado: FieldValue.serverTimestamp() });
    estado.datos[r.uid] = h; escritos++;
  }
  for (const uid of Object.keys(estado.datos)) {
    if (repartidores.has(uid)) continue;
    escritor.delete(db.collection('repartidores').doc(uid));
    delete estado.datos[uid]; borrados++;
  }
  // Datos para todos (siempre: así el portal sabe cuándo fue la última sincronización)
  escritor.set(db.collection('publico').doc('portal'), { ...publico, sincronizado: FieldValue.serverTimestamp() });
  await escritor.close();
  log('Repartidores actualizados: ' + escritos + (borrados ? ' · quitados: ' + borrados : ''));

  estado.total = repartidores.size;
  estado.ultima = new Date().toISOString();
  await refEstado.set(estado);
  log('Sincronización terminada.');
}

principal().catch(e => { console.error('::error::' + e.message); process.exit(1); });
