/* ══════════════════════════════════════════════════════════
   LÓGICA DE LA SINCRONIZACIÓN (sin conexión a internet)
   Recibe las tablas leídas de Google Sheets y arma los documentos
   que se guardan en Firebase. Es la misma lógica que tenía Apps Script.
   ══════════════════════════════════════════════════════════ */
import crypto from 'node:crypto';

/* ── Debe ser igual a app.js (la página) ── */
export function limpiarCelular(c) {
  c = String(c ?? '').replace(/\D/g, '');
  if (c.length === 8) c = '591' + c;
  return c;
}
export function idSeguro(id) { return String(id ?? '').trim().replace(/[^a-zA-Z0-9._-]/g, '_'); }
export function correoDe(id, dominio) { return idSeguro(id).toLowerCase() + '@' + dominio; }
export function claveDe(cel, id) { return 'NM-' + cel + '-' + String(id ?? '').trim(); }

/* ── Ayudantes ── */
export function columna(letra) {
  let n = 0;
  for (const ch of String(letra).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
export function sinEmojis(t) { return String(t || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '').replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+/gm, ''); }
export function texto(v) { return v === null || v === undefined ? '' : String(v).trim(); }
export function numero(v) {
  if (typeof v === 'number') return v;
  const t0 = texto(v);
  if (!t0) return null;
  let t = t0.replace(/[^\d,.-]/g, '');
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}
export function esActivo(v) {
  if (v === true) return true;
  const t = texto(v).toUpperCase();
  return t === 'SI' || t === 'SÍ' || t === 'TRUE' || t === 'X' || t === 'VERDADERO';
}
export function normalizar(v) {
  return texto(v).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
/** "13/10/2026", "13/10/2026 10:12:00" o "2026-10-13" → número para ordenar (0 si no se entiende) */
export function ordenFecha(v) {
  const t = texto(v);
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return Date.UTC(y, Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return 0;
}
/** "13/10/2026" → "2026-10-13" (vacío si no se entiende) */
export function fechaISO(v) {
  const o = ordenFecha(v);
  return o ? new Date(o).toISOString().slice(0, 10) : '';
}
export function hoyISO(zona) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function huella(obj) { return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 24); }
export function codigoAviso(titulo, mensaje) {
  return crypto.createHash('md5').update(titulo + '|' + mensaje, 'utf8').digest('hex').slice(0, 10);
}
export function idDrive(v) {
  const t = texto(v);
  const m = t.match(/\/d\/([a-zA-Z0-9_-]{10,})/) || t.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  return m ? m[1] : '';
}
export function limpiarLink(v) {
  let t = texto(v);
  if (!t) return '';
  if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
  return t;
}
/** Acepta el nombre del encabezado o la letra de la columna */
export function indiceColumna(campo, encabezados) {
  const t = texto(campo);
  if (!t) return -1;
  if (/^[A-Za-z]{1,2}$/.test(t)) return columna(t);
  const b = normalizar(t);
  let i = encabezados.findIndex(h => normalizar(h) === b);
  if (i < 0) i = encabezados.findIndex(h => normalizar(h).startsWith(b));
  return i;
}

/* ══════════ ARMADO DE LOS DOCUMENTOS ══════════
   tablas = {
     login, pendientes, pagos, habilitados, asegurados, anuncios, avisos, faq : filas (sin encabezado),
     tramites: { clave: { filas (con encabezados), cfg } }
   }
   imagenes = { driveId: 'anuncios/archivo.jpg' } (las que ya se descargaron) */
export function armar(tablas, cfg, opciones = {}) {
  const hoy = opciones.hoy || hoyISO(cfg.ZONA_HORARIA);
  const imagen = opciones.imagen || (v => texto(v));
  const H = cfg.HOJAS;
  const avisosLog = [];

  /* 1) Repartidores (BDYANGO) */
  const repartidores = new Map();
  // Todas las tablas se leen desde la columna A, así la letra coincide con la posición
  const iId = columna(H.login.id), iNom = columna(H.login.nombreCol), iCel = columna(H.login.celular);
  const diag = { vacias: 0, sinId: 0, sinCel: 0, celMalo: [], duplicados: [] };
  (tablas.login || []).forEach((f, n) => {
    const fila = n + 2;
    const id = texto(f[iId]);
    const crudo = String(f[iCel] ?? '').trim();
    const cel = limpiarCelular(crudo);
    if (!id && !crudo && !texto(f[iNom])) { diag.vacias++; return; }
    if (!id) { diag.sinId++; return; }
    if (!crudo) { diag.sinCel++; return; }
    if (!/^591\d{8}$/.test(cel)) { diag.celMalo.push('fila ' + fila + ' (' + cel.length + ' dígitos)'); return; }
    if (repartidores.has(idSeguro(id))) diag.duplicados.push('fila ' + fila);
    repartidores.set(idSeguro(id), {
      uid: idSeguro(id), id, nombre: texto(f[iNom]), celular: cel,
      habilitado: true, poliza: false, pendientes: [], historial: [], tramites: []
    });
  });
  const ej = a => a.length + (a.length ? ' (ej.: ' + a.slice(0, 12).join(', ') + ')' : '');
  avisosLog.push('BDYANGO · filas leídas: ' + (tablas.login || []).length + ' · válidos: ' + repartidores.size +
    ' · vacías: ' + diag.vacias + ' · sin ID: ' + diag.sinId + ' · sin celular: ' + diag.sinCel +
    ' · celular no válido: ' + ej(diag.celMalo) + ' · ID repetido: ' + ej(diag.duplicados));

  /* 1b) Usuarios de prueba (no están en BDYANGO) */
  for (const u of cfg.USUARIOS_PRUEBA || []) {
    const cel = limpiarCelular(u.celular), id = texto(u.id);
    if (!id || !/^591\d{8}$/.test(cel) || repartidores.has(idSeguro(id))) continue;
    repartidores.set(idSeguro(id), {
      uid: idSeguro(id), id, nombre: u.nombre || 'USUARIO DE PRUEBA', celular: cel, prueba: true,
      habilitado: true, poliza: true,
      pendientes: [
        { semana: '41', rango: '05/10 al 11/10', importe: 415.2, estado: 'Pendiente' },
        { semana: '40', rango: '28/09 al 04/10', importe: 512.8, estado: 'Factura recibida' }
      ],
      historial: [
        { fechaPago: '03/10/2026', semana: '39', rango: '21/09 al 27/09', importe: 486, _o: ordenFecha('03/10/2026'), _n: 4 },
        { fechaPago: '26/09/2026', semana: '38', rango: '14/09 al 20/09', importe: 538.4, _o: ordenFecha('26/09/2026'), _n: 3 },
        { fechaPago: '19/09/2026', semana: '37', rango: '07/09 al 13/09', importe: 402.1, _o: ordenFecha('19/09/2026'), _n: 2 },
        { fechaPago: '12/09/2026', semana: '36', rango: '31/08 al 06/09', importe: 455.75, _o: ordenFecha('12/09/2026'), _n: 1 }
      ],
      tramites: [{
        numero: 'SOP-0001', clave: 'soporte', tipo: 'Soporte – Problemas con pagos', fecha: '08/10/2026 10:12:00', _o: ordenFecha('08/10/2026'),
        asunto: 'No me llegó el pago (ejemplo)', detalle: '001245', etAsunto: 'Problema', etDetalle: 'Nro de factura',
        estado: 'En revisión', resolucion: '', motivo: '', comentario: 'Esto es una prueba', fechaRespuesta: ''
      }]
    });
  }

  /* 2) Habilitados / Asegurados (el ID en la columna A) */
  for (const f of tablas.habilitados || []) { const r = repartidores.get(idSeguro(f[0])); if (r && texto(f[0])) r.habilitado = false; }
  for (const f of tablas.asegurados || []) { const r = repartidores.get(idSeguro(f[0])); if (r && texto(f[0])) r.poliza = true; }

  /* 3) Pagos pendientes */
  const P = H.pendientes;
  for (const f of tablas.pendientes || []) {
    const r = repartidores.get(idSeguro(f[columna(P.id)]));
    if (!r || !texto(f[columna(P.id)])) continue;
    r.pendientes.push({
      semana: texto(f[columna(P.semana)]), rango: texto(f[columna(P.rango)]),
      importe: numero(f[columna(P.importe)]), estado: texto(f[columna(P.estado)])
    });
  }

  /* 4) Historial de pagos (el más reciente primero) */
  const G = H.pagos;
  for (const [n, f] of (tablas.pagos || []).entries()) {
    const r = repartidores.get(idSeguro(f[columna(G.id)]));
    if (!r || !texto(f[columna(G.id)])) continue;
    r.historial.push({
      fechaPago: texto(f[columna(G.fechaPago)]), semana: texto(f[columna(G.semana)]), rango: texto(f[columna(G.rango)]),
      importe: numero(f[columna(G.importe)]), _o: ordenFecha(f[columna(G.fechaPago)]), _n: n
    });
  }

  /* 5) Trámites */
  for (const t of cfg.TRAMITES) {
    const datos = tablas.tramites && tablas.tramites[t.clave];
    if (!datos || !datos.length) continue;
    const filaEnc = t.filaEncabezados || 1;
    const enc = (datos[filaEnc - 1] || []).map(texto);
    const idx = {};
    for (const k of Object.keys(t.campos)) idx[k] = indiceColumna(t.campos[k], enc);
    if (idx.id < 0) { avisosLog.push('Trámite ' + t.nombre + ': no se encontró la columna del ID.'); continue; }
    for (let i = filaEnc; i < datos.length; i++) {
      const f = datos[i];
      const r = repartidores.get(idSeguro(f[idx.id]));
      if (!r || !texto(f[idx.id])) continue;
      const c = k => (idx[k] >= 0 ? texto(f[idx[k]]) : '');
      r.tramites.push({
        numero: t.prefijo + '-' + String(i + 1).padStart(4, '0'),
        clave: t.clave, tipo: t.nombre, fecha: c('fecha'), _o: ordenFecha(c('fecha')),
        asunto: c('asunto'), detalle: c('detalle'),
        etAsunto: (t.etiquetas && t.etiquetas.asunto) || '', etDetalle: (t.etiquetas && t.etiquetas.detalle) || '',
        estado: c('estado'), resolucion: c('resolucion'), motivo: c('motivo'),
        comentario: c('comentario'), fechaRespuesta: c('fechaRespuesta')
      });
    }
  }

  /* 6) Cierre de cada repartidor */
  for (const r of repartidores.values()) {
    r.historial.sort((a, b) => (b._o - a._o) || (b._n - a._n));
    r.historial.forEach(h => { delete h._o; delete h._n; });
    r.tramites.sort((a, b) => b._o - a._o);
    r.tramites.forEach(t => { delete t._o; });
    const suma = l => Math.round(l.reduce((s, x) => s + (x.importe || 0), 0) * 100) / 100;
    r.resumen = {
      pendientes: { cantidad: r.pendientes.length, total: suma(r.pendientes) },
      pagados: { cantidad: r.historial.length, total: suma(r.historial) }
    };
  }

  /* 7) Lo que ven todos y sale de la configuración (formularios, encuesta).
     Anuncios, avisos y preguntas ya NO salen de Google Sheets: se editan en el
     panel de administrador del portal (documento publico/contenido). */
  const publico = {
    formularios: cfg.TRAMITES.filter(t => t.formulario).map(t => ({ clave: t.clave, nombre: t.nombre, descripcion: t.descripcion || '', url: t.formulario })),
    encuesta: cfg.ENCUESTA && cfg.ENCUESTA.url ? { ...cfg.ENCUESTA } : null,
    totalRepartidores: [...repartidores.values()].filter(r => !r.prueba).length
  };

  return { repartidores, publico, avisosLog };
}

/* ══════════ MIGRACIÓN ÚNICA desde el archivo CONTROL ══════════
   Convierte las hojas Anuncios, Avisos y FAQ al formato del panel de
   administrador. Se usa UNA sola vez (cuando publico/contenido no existe). */
export function nuevoId() { return crypto.randomBytes(6).toString('hex'); }
export function importarContenido(tablas) {
  const anuncios = [];
  for (const f of tablas.anuncios || []) {
    const fuente = texto(f[1]);
    if (!fuente) continue;
    anuncios.push({
      id: nuevoId(), activo: esActivo(f[0]), fuente, imagen: '', link: limpiarLink(f[2]),
      orden: numero(f[3]) ?? 999, desde: fechaISO(f[4]), hasta: fechaISO(f[5]), titulo: texto(f[6])
    });
  }
  anuncios.sort((a, b) => a.orden - b.orden);
  anuncios.forEach((a, i) => { a.orden = i + 1; });

  const avisos = [];
  const filasAvisos = tablas.avisos || [];
  // Si la primera fila es de encabezados, las columnas se ubican por su nombre
  const cabAv = filasAvisos.length && /activo/i.test(texto(filasAvisos[0][0])) ? filasAvisos[0].map(h => normalizar(h)) : null;
  const colAv = claves => cabAv.findIndex(h => claves.some(k => h.includes(k)));
  const AV = cabAv ? {
    titulo: colAv(['TITULO']), mensaje: cabAv.findIndex(h => h.includes('MENSAJE') && !h.includes('TITULO')),
    imagen: colAv(['IMAGEN']), tipo: colAv(['TIPO']), frecuencia: colAv(['FRECUENCIA']), para: colAv(['PARA']),
    desde: colAv(['DESDE']), hasta: colAv(['HASTA']),
    boton: colAv(['BOTON']), link: cabAv.findIndex(h => h.includes('LINK'))
  } : { titulo: 1, mensaje: 2, imagen: 3, tipo: 4, frecuencia: 5, para: 6, desde: 7, hasta: 8, boton: 9, link: 10 };
  const celda = (f, i) => (i >= 0 ? f[i] : '');
  for (const f of cabAv ? filasAvisos.slice(1) : filasAvisos) {
    let titulo = texto(celda(f, AV.titulo)), mensaje = texto(celda(f, AV.mensaje));
    // Una sola columna "Título / Mensaje": la primera línea es el título
    if (titulo && !mensaje && AV.mensaje < 0) {
      const lineas = titulo.split(/\r?\n/);
      const i = lineas.findIndex(l => l.trim());
      titulo = lineas[i].trim(); mensaje = lineas.slice(i + 1).join('\n').trim();
    }
    titulo = sinEmojis(titulo).replace(/\*\*/g, '').trim();
    mensaje = sinEmojis(mensaje).trim();
    if (!titulo && !mensaje) continue;
    let botonTexto = texto(celda(f, AV.boton)), botonLink = limpiarLink(celda(f, AV.link));
    const url = botonTexto.match(/(https?:\/\/\S+|wa\.me\/\S+)/i);
    if (url && !botonLink) { botonLink = limpiarLink(url[1]); botonTexto = botonTexto.replace(url[1], '').replace(/[|:\-–\s]+$/, '').trim(); }
    if (botonLink && !botonTexto) botonTexto = 'Ver más';
    const para = normalizar(celda(f, AV.para)) || 'TODOS';
    const grupos = ['TODOS', 'NO HABILITADOS', 'SIN POLIZA', 'CON PENDIENTES'];
    avisos.push({
      id: nuevoId(), codigo: codigoAviso(titulo, mensaje), activo: esActivo(f[0]), titulo, mensaje,
      fuente: texto(celda(f, AV.imagen)), imagen: '',
      tipo: ['INFO', 'IMPORTANTE', 'URGENTE'].includes(normalizar(celda(f, AV.tipo))) ? normalizar(celda(f, AV.tipo)) : 'INFO',
      frecuencia: ['UNA VEZ', 'CADA INGRESO', 'HASTA QUE CONFIRME'].includes(normalizar(celda(f, AV.frecuencia))) ? normalizar(celda(f, AV.frecuencia)) : 'UNA VEZ',
      paraQuien: grupos.includes(para) ? para : 'IDS', ids: grupos.includes(para) ? '' : texto(celda(f, AV.para)),
      desde: fechaISO(celda(f, AV.desde)), hasta: fechaISO(celda(f, AV.hasta)),
      botonTexto: botonLink ? botonTexto : '', botonLink
    });
  }

  const preguntas = [];
  for (const f of tablas.faq || []) {
    const p = texto(f[2]), r = texto(f[3]);
    if (!p) continue;
    preguntas.push({ id: nuevoId(), activo: esActivo(f[0]), categoria: texto(f[1]) || 'General', p, r, orden: numero(f[4]) ?? 999 });
  }
  return { anuncios, avisos, preguntas };
}

/** ChatLog y AvisosLeidos viejos → listas para el archivo (solo lo ve el administrador) */
export function importarArchivo(tablas) {
  const chats = (tablas.chatlog || []).slice(1).filter(f => texto(f[3])).map(f => ({
    fecha: texto(f[0]), id: texto(f[1]), nombre: texto(f[2]), pregunta: texto(f[3]).slice(0, 600), respuesta: texto(f[4]).slice(0, 1200), tokens: numero(f[5]) || 0
  }));
  const lecturas = (tablas.avisosLeidos || []).filter(f => texto(f[1]) && !/^fecha/i.test(texto(f[0]))).map(f => ({
    fecha: texto(f[0]), id: texto(f[1]), nombre: texto(f[2]), codigo: texto(f[4]), titulo: texto(f[5]).slice(0, 200)
  }));
  return { chats, lecturas };
}

/** Datos que se guardan en Firestore para un repartidor (sin el celular en claro como ID) */
export function documentoRepartidor(r) {
  const { uid, avisos, ...doc } = r;
  return doc;
}

/* ══════════ NOTIFICACIONES ══════════
   Se guarda una "firma" corta de cada repartidor. Si en la siguiente
   sincronización cambió, se arma el aviso para su celular. */
export function bsTexto(n) {
  const v = Number(n) || 0, p = Math.abs(v).toFixed(2).split('.');
  return (v < 0 ? '−' : '') + 'Bs ' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1];
}
export function firmaNotif(r) {
  return {
    p: (r.pendientes || []).map(x => String(x.semana)),
    h: (r.historial || []).length,
    t: (r.tramites || []).slice(0, 6).map(t => t.numero + '=' + (t.estado || '') + '|' + (t.resolucion || ''))
  };
}
export function eventosNotif(antes, ahora, r) {
  if (!antes) return [];
  const ev = [];
  const nuevas = ahora.p.filter(s => !antes.p.includes(s));
  if (nuevas.length) {
    const items = (r.pendientes || []).filter(x => nuevas.includes(String(x.semana)));
    const total = items.reduce((s, x) => s + (Number(x.importe) || 0), 0);
    ev.push(nuevas.length === 1
      ? { titulo: 'Semana ' + nuevas[0] + ' registrada', cuerpo: 'Tienes ' + bsTexto(total) + ' por cobrar. Envía tu factura hasta el jueves a las 18:00.', link: 'pendientes' }
      : { titulo: nuevas.length + ' semanas nuevas por cobrar', cuerpo: 'Total ' + bsTexto(total) + '. Envía tus facturas hasta el jueves a las 18:00.', link: 'pendientes' });
  }
  if (ahora.h > antes.h) {
    const pagos = (r.historial || []).slice(0, ahora.h - antes.h);
    const total = pagos.reduce((s, x) => s + (Number(x.importe) || 0), 0);
    ev.push(pagos.length === 1
      ? { titulo: 'Recibiste tu pago', cuerpo: 'Semana ' + pagos[0].semana + ': ' + bsTexto(pagos[0].importe) + (pagos[0].fechaPago ? ', pagado el ' + pagos[0].fechaPago : '') + '.', link: 'historial' }
      : { titulo: 'Recibiste ' + pagos.length + ' pagos', cuerpo: 'Total ' + bsTexto(total) + '.', link: 'historial' });
  }
  const previo = Object.fromEntries((antes.t || []).map(x => [x.split('=')[0], x]));
  for (const x of ahora.t) {
    const num = x.split('=')[0];
    if (previo[num] && previo[num] !== x) {
      const [estado, res] = x.slice(num.length + 1).split('|');
      ev.push({ titulo: 'Tu trámite ' + num + ' cambió', cuerpo: 'Estado: ' + (estado || 'Recibido') + (res ? ' · ' + res : '') + '. Toca para ver la respuesta.', link: 'tramites' });
    }
  }
  return ev;
}
/** Junta varios eventos en una sola notificación */
export function unirEventos(ev) {
  if (!ev.length) return null;
  if (ev.length === 1) return ev[0];
  return { titulo: 'Tienes novedades en el Portal CONTAX', cuerpo: ev.map(e => e.titulo).join(' · ') + '.', link: ev[0].link };
}
/** ¿A quién le llega un aviso del administrador? */
export function aplicaA(paraQuien, ids, r) {
  switch (paraQuien) {
    case 'NO HABILITADOS': return r.habilitado === false;
    case 'SIN POLIZA': return !r.poliza;
    case 'CON PENDIENTES': return (r.pendientes || []).length > 0;
    case 'IDS': return String(ids || '').split(/[,;\s]+/).some(x => x && idSeguro(x).toUpperCase() === r.uid.toUpperCase());
    default: return true;
  }
}
