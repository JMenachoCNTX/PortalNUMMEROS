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
import { getMessaging } from 'firebase-admin/messaging';
import * as CFG from './config.mjs';
import { armar, documentoRepartidor, correoDe, claveDe, huella, idDrive, texto, importarContenido, importarArchivo, firmaNotif, eventosNotif, unirEventos, aplicaA } from './logica.mjs';

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
const ultimaLetra = o => Object.values(o).filter(v => typeof v === 'string' && /^[A-Z]{1,2}$/.test(v)).sort((a, b) => a.length - b.length || a.localeCompare(b)).pop();
const hoja = n => "'" + String(n).replace(/'/g, "''") + "'";

async function leerTodo() {
  const H = CFG.HOJAS;
  log('Leyendo el archivo principal…');
  const [login, pendientes, pagos, habilitados, asegurados] = await leerRangos(CFG.SPREADSHEET_ID, [
    hoja(H.login.nombre) + '!A2:D', hoja(H.pendientes.nombre) + '!A2:M', hoja(H.pagos.nombre) + '!A' + (H.pagos.filaInicio || 2) + ':' + ultimaLetra(H.pagos),
    hoja(H.habilitados.nombre) + '!A2:A', hoja(H.asegurados.nombre) + '!A2:A'
  ]);
  const tramites = {};
  for (const t of CFG.TRAMITES) {
    if (!t.archivoId) continue;
    log('Leyendo trámites: ' + t.nombre);
    const [filas] = await leerRangos(t.archivoId, [hoja(t.hoja)], { opcional: true });
    tramites[t.clave] = filas;
  }
  log('BDYANGO: ' + login.length + ' filas · PPendientes: ' + pendientes.length + ' · ' + H.pagos.nombre + ': ' + pagos.length);
  return { login, pendientes, pagos, habilitados, asegurados, tramites };
}

/* Migración única: las hojas Anuncios, Avisos, FAQ, ChatLog y AvisosLeidos del archivo
   CONTROL pasan a Firebase. Después de esto, esas hojas ya no se usan y se pueden borrar. */
async function leerMigracion() {
  const H = CFG.HOJAS;
  const opc = { opcional: true };
  const [anuncios] = await leerRangos(CFG.SPREADSHEET_ID, [hoja(H.anuncios.nombre) + '!A2:G'], opc);
  const [avisos] = await leerRangos(CFG.SPREADSHEET_ID, [hoja(H.avisos.nombre) + '!A1:N'], opc);
  const [faq] = await leerRangos(CFG.FAQ_SPREADSHEET_ID || CFG.SPREADSHEET_ID, [hoja(H.faq.nombre) + '!A2:E'], opc);
  const [chatlog] = await leerRangos(CFG.SPREADSHEET_ID, ["'ChatLog'!A1:F"], opc);
  const [avisosLeidos] = await leerRangos(CFG.SPREADSHEET_ID, ["'AvisosLeidos'!A1:F"], opc);
  return { anuncios, avisos, faq, chatlog, avisosLeidos };
}
async function migrarSiHaceFalta() {
  const ref = db.collection('publico').doc('contenido');
  const snap = await ref.get();
  if (snap.exists) return snap.data();
  log('Primera vez: copiando Anuncios, Avisos, FAQ, ChatLog y AvisosLeidos a Firebase…');
  const tablas = await leerMigracion();
  const cont = importarContenido(tablas);
  const arch = importarArchivo(tablas);
  const lote = db.batch();
  const trozos = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));
  trozos(arch.chats, 400).forEach((l, i) => lote.set(db.collection('archivo').doc('chats-' + (i + 1)), { tipo: 'chats', filas: l }));
  trozos(arch.lecturas, 1500).forEach((l, i) => lote.set(db.collection('archivo').doc('lecturas-' + (i + 1)), { tipo: 'lecturas', filas: l }));
  const datos = { ...cont, actualizado: FieldValue.serverTimestamp(), migrado: new Date().toISOString() };
  lote.set(ref, datos);
  await lote.commit();
  console.log('::notice::Migración lista: ' + cont.anuncios.length + ' anuncios, ' + cont.avisos.length + ' avisos, ' + cont.preguntas.length +
    ' preguntas, ' + arch.chats.length + ' chats y ' + arch.lecturas.length + ' lecturas viejas. Ya puedes borrar esas hojas de CONTROL.');
  return { ...cont };
}

/* ── Cuenta de administrador (clave en el secreto ADMIN_CLAVE) ── */
async function cuentaAdmin(estado) {
  const clave = process.env.ADMIN_CLAVE || '';
  if (!clave) { console.log('::notice::Falta el secreto ADMIN_CLAVE: el panel de administrador queda apagado.'); return; }
  if (clave.length < 10) { console.log('::warning::ADMIN_CLAVE es muy corta (mínimo 10 caracteres). No se activó el administrador.'); return; }
  const h = huella(['admin', clave, CFG.CORREO_ADMIN]);
  if (estado.admin === h) return;
  const datos = { email: CFG.CORREO_ADMIN, password: clave, displayName: 'Administrador', disabled: false };
  try { await auth.updateUser('admin', datos); }
  catch (e) { if (e.code !== 'auth/user-not-found') throw e; await auth.createUser({ uid: 'admin', ...datos }); }
  await auth.setCustomUserClaims('admin', { admin: true });
  estado.admin = h;
  log('Cuenta de administrador lista.');
}

/* ── Imágenes de anuncios y avisos: Drive o subidas desde el panel → carpeta anuncios/ ── */
const subidasYaPublicadas = [];
async function resolverImagen(fuente) {
  const t = texto(fuente);
  if (!t) return '';
  const m = t.match(/^subida:([a-zA-Z0-9_-]+)$/);
  if (!m) return rutaImagen(t);
  const id = m[1];
  fs.mkdirSync(CARPETA_IMG, { recursive: true });
  const existente = fs.readdirSync(CARPETA_IMG).find(f => f.startsWith(id + '.'));
  if (existente) { usadas.add(existente); subidasYaPublicadas.push(id); return 'anuncios/' + existente; }
  const doc = await db.collection('imagenes').doc(id).get();
  if (!doc.exists) { log('  Imagen subida ' + id + ' no encontrada'); return ''; }
  const { datos, tipo } = doc.data();
  const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[tipo] || 'jpg';
  const archivo = id + '.' + ext;
  fs.writeFileSync(path.join(CARPETA_IMG, archivo), Buffer.from(String(datos).replace(/^data:[^,]+,/, ''), 'base64'));
  usadas.add(archivo);
  log('  Imagen subida desde el panel: ' + archivo);
  return 'anuncios/' + archivo;
}
async function procesarImagenes(contenido) {
  const items = [...(contenido.anuncios || []), ...(contenido.avisos || [])];
  const rutas = new Map();
  for (const it of items) rutas.set(it.id, await resolverImagen(it.fuente));
  await descargarImagenes();
  for (const [id, r] of rutas) if (renombradas.has(r)) rutas.set(id, renombradas.get(r));
  // Guarda la ruta final solo si cambió (una transacción, por si el administrador guardó algo mientras tanto)
  const ref = db.collection('publico').doc('contenido');
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const c = snap.data();
    let cambio = false;
    for (const lista of ['anuncios', 'avisos']) {
      for (const it of c[lista] || []) {
        const r = rutas.get(it.id);
        if (r === undefined) continue;
        const final = it.fuente ? r : '';
        if ((it.imagen || '') !== final) { it.imagen = final; cambio = true; }
      }
    }
    if (cambio) { tx.update(ref, { anuncios: c.anuncios || [], avisos: c.avisos || [] }); log('Rutas de imágenes actualizadas.'); }
  });
  // Las imágenes subidas que ya quedaron en GitHub se borran de Firebase (ahorra espacio)
  for (const id of subidasYaPublicadas) await db.collection('imagenes').doc(id).delete().catch(() => {});
}

/* ── 3. Imágenes de Drive → carpeta anuncios/ del sitio ── */
const usadas = new Set();
const pendientesDescarga = new Map();
const renombradas = new Map();
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
      if (final !== archivo) { usadas.delete(archivo); usadas.add(final); renombradas.set('anuncios/' + archivo, 'anuncios/' + final); }
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
  let ok = 0, mal = 0; const errores = {};
  await enParalelo(cambios, 6, async ({ r, email, password, h }) => {
    try {
      try { await auth.updateUser(r.uid, { email, password, disabled: false, displayName: r.nombre.slice(0, 100) }); }
      catch (e) {
        if (e.code !== 'auth/user-not-found') throw e;
        await auth.createUser({ uid: r.uid, email, password, displayName: r.nombre.slice(0, 100) });
      }
      estado.cuentas[r.uid] = h; ok++;
    } catch (e) { mal++; errores[e.code || e.message] = (errores[e.code || e.message] || 0) + 1; log('  Cuenta ' + r.id + ': ' + e.message); }
  });
  // Los que ya no están en BDYANGO: se desactivan (no se borran)
  const fuera = Object.keys(estado.cuentas).filter(uid => !repartidores.has(uid));
  await enParalelo(fuera, 6, async uid => {
    try { await auth.updateUser(uid, { disabled: true }); } catch (e) { if (e.code !== 'auth/user-not-found') log('  Desactivar ' + uid + ': ' + e.message); }
    delete estado.cuentas[uid];
  });
  console.log('::notice::Cuentas · por crear o actualizar: ' + cambios.length + ' · listas: ' + ok + ' · con error: ' + mal +
    (mal ? ' (' + Object.entries(errores).map(([k, v]) => k + ': ' + v).join(', ') + ')' : '') + ' · total registradas: ' + Object.keys(estado.cuentas).length);
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

/* ── 6. Notificaciones al celular ── */
const PORTAL = 'https://portalnummeros.contaxbolivia.com';
const SHARDS = 4;
const shard = uid => [...uid].reduce((a, c) => a + c.charCodeAt(0), 0) % SHARDS;
function mensaje(token, m) {
  return {
    token,
    notification: { title: m.titulo.slice(0, 80), body: m.cuerpo.slice(0, 240) },
    webpush: {
      notification: { icon: PORTAL + '/marca/iconos/icono-app-principal-192.png', badge: PORTAL + '/marca/iconos/icono-app-principal-192.png', lang: 'es' },
      fcmOptions: { link: PORTAL + '/#/' + (m.link || 'inicio') }
    }
  };
}
/** Envía [{uid, token, m}] y quita los tokens que ya no sirven */
async function enviar(lista) {
  let ok = 0, mal = 0;
  const malos = new Set();
  for (let i = 0; i < lista.length; i += 500) {
    const parte = lista.slice(i, i + 500);
    try {
      const r = await getMessaging().sendEach(parte.map(x => mensaje(x.token, x.m)));
      r.responses.forEach((res, j) => {
        if (res.success) ok++;
        else {
          mal++;
          const c = res.error && res.error.code || '';
          if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(c)) malos.add(parte[j].uid);
          else if (mal < 4) log('  Notificación no enviada: ' + c + ' ' + (res.error && res.error.message));
        }
      });
    } catch (e) { mal += parte.length; console.log('::warning::No se pudieron enviar notificaciones: ' + e.message); break; }
  }
  for (const uid of malos) await db.collection('notificaciones').doc(uid).delete().catch(() => {});
  return { ok, mal };
}
async function tokensDe(uids) {
  const res = new Map();
  for (let i = 0; i < uids.length; i += 300) {
    const docs = await db.getAll(...uids.slice(i, i + 300).map(u => db.collection('notificaciones').doc(u)));
    docs.forEach(d => { if (d.exists && (d.data().tokens || [])[0]) res.set(d.id, d.data().tokens[0]); });
  }
  return res;
}
async function notificar(repartidores) {
  // a) Cambios de cada repartidor (semana nueva, pago, trámite)
  const refs = Array.from({ length: SHARDS }, (_, i) => db.collection('privado').doc('notif-' + i));
  const snaps = await db.getAll(...refs);
  const primeraVez = snaps.every(d => !d.exists);
  const firmas = snaps.map(d => (d.exists ? d.data().firmas || {} : {}));
  const cambiados = new Set(), mensajes = new Map();
  for (const r of repartidores.values()) {
    if (r.prueba) continue;
    const k = shard(r.uid), f = firmaNotif(r), antes = firmas[k][r.uid];
    if (antes && JSON.stringify(antes) === JSON.stringify(f)) continue;
    const m = unirEventos(eventosNotif(antes, f, r));
    if (m) mensajes.set(r.uid, m);
    firmas[k][r.uid] = f; cambiados.add(k);
  }
  for (const k of cambiados) await refs[k].set({ firmas: firmas[k] });
  if (primeraVez) { log('Notificaciones: primera vez, solo se guardó el estado actual.'); }
  else if (mensajes.size) {
    const tokens = await tokensDe([...mensajes.keys()]);
    const lista = [...tokens].map(([uid, token]) => ({ uid, token, m: mensajes.get(uid) }));
    const r = lista.length ? await enviar(lista) : { ok: 0, mal: 0 };
    console.log('::notice::Notificaciones automáticas: ' + mensajes.size + ' repartidores con novedades · enviadas: ' + r.ok + (r.mal ? ' · fallidas: ' + r.mal : '') + ' (los demás no las activaron)');
  }

  // b) Avisos que mandó el administrador desde el panel
  const cola = await db.collection('colaNotif').where('estado', '==', 'pendiente').get();
  if (cola.empty) return;
  const todos = await db.collection('notificaciones').get();
  const suscritos = new Map();
  todos.forEach(d => { if ((d.data().tokens || [])[0]) suscritos.set(d.id, d.data().tokens[0]); });
  for (const doc of cola.docs) {
    const n = doc.data();
    const lista = [];
    for (const [uid, token] of suscritos) {
      const r = repartidores.get(uid);
      if (r && aplicaA(n.paraQuien || 'TODOS', n.ids, r)) lista.push({ uid, token, m: { titulo: String(n.titulo || 'Portal CONTAX'), cuerpo: String(n.cuerpo || ''), link: n.link || 'inicio' } });
    }
    const r = await enviar(lista);
    await doc.ref.update({ estado: 'enviado', enviados: r.ok, fallidos: r.mal, procesado: FieldValue.serverTimestamp() });
    console.log('::notice::Notificación del administrador "' + n.titulo + '": enviada a ' + r.ok + ' celulares.');
  }
}

/* ══════════ PRINCIPAL ══════════ */
async function principal() {
  const refEstado = db.collection('privado').doc('estado');
  const snap = await refEstado.get();
  const estado = Object.assign({ cuentas: {}, datos: {}, publico: '', reglas: '', total: 0 }, snap.exists ? snap.data() : {});

  await publicarReglas(estado);
  await cuentaAdmin(estado);
  const contenido = await migrarSiHaceFalta();

  const tablas = await leerTodo();
  const { repartidores, publico, avisosLog } = armar(tablas, CFG);
  avisosLog.forEach(a => console.log('::warning::' + a));
  log('Repartidores válidos: ' + repartidores.size);

  if (estado.total && repartidores.size < estado.total * CFG.MINIMO_REPARTIDORES) {
    throw new Error('BDYANGO trajo ' + repartidores.size + ' repartidores, antes había ' + estado.total +
      '. Por seguridad no se cambió nada. Revisa la hoja; si el cambio es correcto, borra el documento privado/estado en Firestore.');
  }

  await procesarImagenes(contenido);
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

  try { await notificar(repartidores); } catch (e) { console.log('::warning::Notificaciones: ' + e.message); }

  estado.total = repartidores.size;
  estado.ultima = new Date().toISOString();
  await refEstado.set(estado);
  log('Sincronización terminada.');
}

principal().catch(e => { console.error('::error::' + e.message); process.exit(1); });
