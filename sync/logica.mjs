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
      habilitado: true, poliza: false, pendientes: [], historial: [], tramites: [], avisos: []
    });
  });
  const ej = a => a.length + (a.length ? ' (ej.: ' + a.slice(0, 12).join(', ') + ')' : '');
  avisosLog.push('BDYANGO · filas leídas: ' + (tablas.login || []).length + ' · válidos: ' + repartidores.size +
    ' · vacías: ' + diag.vacias + ' · sin ID: ' + diag.sinId + ' · sin celular: ' + diag.sinCel +
    ' · celular no válido: ' + ej(diag.celMalo) + ' · ID repetido: ' + ej(diag.duplicados));

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

  /* 6) Avisos (ventanas emergentes) */
  const avisosCfg = [];
  for (const f of tablas.avisos || []) {
    if (!esActivo(f[0])) continue;
    const titulo = texto(f[1]), mensaje = texto(f[2]);
    if (!titulo && !mensaje) continue;
    const desde = fechaISO(f[7]), hasta = fechaISO(f[8]);
    if (desde && hoy < desde) continue;
    if (hasta && hoy > hasta) continue;
    avisosCfg.push({
      codigo: codigoAviso(titulo, mensaje), titulo, mensaje,
      imagen: imagen(f[3]),
      tipo: normalizar(f[4]) || 'INFO', frecuencia: normalizar(f[5]) || 'UNA VEZ', paraQuien: normalizar(f[6]) || 'TODOS',
      botonTexto: texto(f[9]), botonLink: limpiarLink(f[10])
    });
  }
  const peso = { URGENTE: 0, IMPORTANTE: 1, INFO: 2 };
  avisosCfg.sort((a, b) => (peso[a.tipo] ?? 2) - (peso[b.tipo] ?? 2));

  /* 7) Cierre de cada repartidor */
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
    for (const a of avisosCfg) {
      let aplica;
      switch (a.paraQuien) {
        case 'TODOS': aplica = true; break;
        case 'NO HABILITADOS': aplica = !r.habilitado; break;
        case 'SIN POLIZA': aplica = !r.poliza; break;
        case 'CON PENDIENTES': aplica = r.pendientes.length > 0; break;
        default: aplica = a.paraQuien.split(/[,;\s]+/).some(x => idSeguro(x).toUpperCase() === r.uid.toUpperCase());
      }
      if (aplica) {
        const { paraQuien, ...resto } = a;
        r.avisos.push(resto);
      }
    }
  }

  /* 8) Lo que ven todos (anuncios, preguntas, formularios, encuesta) */
  const anuncios = [];
  for (const f of tablas.anuncios || []) {
    if (!esActivo(f[0])) continue;
    const img = imagen(f[1]);
    if (!img) continue;
    const desde = fechaISO(f[4]), hasta = fechaISO(f[5]);
    if (desde && hoy < desde) continue;
    if (hasta && hoy > hasta) continue;
    anuncios.push({ orden: numero(f[3]) ?? 999, imagen: img, link: limpiarLink(f[2]), titulo: texto(f[6]) });
  }
  anuncios.sort((a, b) => a.orden - b.orden);
  anuncios.forEach(a => delete a.orden);

  const cats = new Map();
  for (const f of tablas.faq || []) {
    if (!esActivo(f[0])) continue;
    const p = texto(f[2]), resp = texto(f[3]);
    if (!p || !resp) continue;
    const c = texto(f[1]) || 'General';
    if (!cats.has(c)) cats.set(c, []);
    cats.get(c).push({ p, r: resp, o: numero(f[4]) ?? 999 });
  }
  const preguntas = [...cats.entries()].map(([nombre, l]) => ({
    nombre, preguntas: l.sort((a, b) => a.o - b.o).map(({ p, r }) => ({ p, r }))
  }));

  const publico = {
    anuncios,
    preguntas,
    formularios: cfg.TRAMITES.filter(t => t.formulario).map(t => ({ clave: t.clave, nombre: t.nombre, descripcion: t.descripcion || '', url: t.formulario })),
    encuesta: cfg.ENCUESTA && cfg.ENCUESTA.url ? { ...cfg.ENCUESTA } : null
  };

  return { repartidores, publico, avisosLog };
}

/** Datos que se guardan en Firestore para un repartidor (sin el celular en claro como ID) */
export function documentoRepartidor(r) {
  const { uid, ...doc } = r;
  return doc;
}
