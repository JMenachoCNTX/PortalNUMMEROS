/* ══════════════════════════════════════════════════════════
   PORTAL CONTAX · NUMMEROS — Mis facturas
   El repartidor sube SOLO el PDF de su factura. La IA (Gemini, a través del
   asistente del portal, ruta /factura) lee sus datos y aquí se revisa que esté
   a nombre de MILTHAGOR, con el NIT y la razón social que el repartidor registró
   y por el importe exacto de sus semanas pendientes; si algo falla no se sube.
   El equipo de CONTAX la revisa en el panel CONTROL y el estado
   (recibida, aprobada, observada) se ve al instante en esta página.
   Corte: jueves 18:00 (hora de Bolivia). Lo que llega después entra
   al pago de la semana siguiente.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var N = window.NM;
  if (!N) return;
  var S = N.S, C = N.C, esc = N.esc, ic = N.ic, bs = N.bs;
  var MAX_PDF = 700 * 1024;   // 700 KB (Firebase guarda hasta ~1 MB por documento)
  var lista = null, cargando = false, escucha = null;
  var emision = {};   // semana → motivo de CONTAX (colección emisionContax, la escribe el Panel)
  var AYUDA_MOTIVO = {
    'PEDIR CÓDIGO DE INGRESO': 'Envíanos el código de ingreso que te llega de Impuestos Nacionales.',
    'PEDIR CÓDIGO SIAT': 'Envíanos el código del SIAT que te llega de Impuestos Nacionales.',
    'FALTA DDJJ': 'Tienes una declaración jurada pendiente: hay que presentarla antes de facturar.',
    'NIT INACTIVO': 'Tu NIT figura inactivo en Impuestos Nacionales: hay que reactivarlo.',
    'CONTRASEÑA INCORRECTA PORTAL': 'La contraseña de Impuestos que tenemos no funciona: envíanos la correcta.',
    'SIN ACTIVIDADES ECONÓMICAS': 'Tu NIT no tiene una actividad económica registrada: hay que agregarla.',
    'CONTRASEÑA INCORRECTA SIAT': 'La contraseña del SIAT que tenemos no funciona: envíanos la correcta.'
  };

  var ESTADOS = {
    recibida: ['pend', 'Recibida · en revisión'],
    aprobada: ['ok', 'Aprobada'],
    observada: ['mal', 'Observada'],
    rechazada: ['mal', 'Rechazada'],
    anulada: ['neutro', 'Anulada por ti']
  };
  function chip(f) {
    if (f.origen === 'contax') return '<span class="chip ok">Emitida por CONTAX</span>';
    // Aprobada sin verificar en el Excel de Impuestos: todavía no habilita el pago
    if (f.estado === 'aprobada' && !f.verificacion) return '<span class="chip pend">Pre-aprobada</span>';
    var e = ESTADOS[f.estado] || ['neutro', f.estado || '—'];
    return '<span class="chip ' + e[0] + '">' + e[1] + '</span>';
  }

  /* ── Corte: jueves 18:00 en Bolivia (UTC-4, sin horario de verano) ── */
  function ahoraBolivia() { return new Date(Date.now() - 4 * 3600 * 1000); }  // usar con getUTC*
  function corteActual() {
    var b = ahoraBolivia(), dia = b.getUTCDay();                 // 0 domingo … 4 jueves
    var faltan = (4 - dia + 7) % 7;
    var c = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + faltan, 18, 0, 0));
    if (c <= b) c = new Date(c.getTime() + 7 * 864e5);            // jueves después de las 18:00 → el siguiente
    return c;                                                       // fecha "en hora Bolivia"
  }
  function textoDia(d) {
    var dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    return dias[d.getUTCDay()] + ' ' + String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0');
  }
  function infoCorte() {
    var c = corteActual(), viernes = new Date(c.getTime() + 864e5);
    var b = ahoraBolivia(), horas = Math.round((c - b) / 36e5);
    return { corte: c, viernes: viernes, horas: horas, iso: c.toISOString().slice(0, 10) };
  }

  /* ── Datos ── */
  function cargar() {
    if (cargando) return;
    if (N.DEMO) {
      lista = [{ _id: 'd1', numero: '1245', importe: 512.8, semanas: ['40'], estado: 'aprobada', subido: new Date(Date.now() - 4 * 864e5), nombreArchivo: 'factura-1245.pdf' },
               { _id: 'd2', numero: '1251', importe: 415.2, semanas: ['41'], estado: 'recibida', subido: new Date(), nombreArchivo: 'factura-1251.pdf' }];
      return;
    }
    cargando = true;
    escucha = N.db().collection('facturas').where('uid', '==', N.auth().currentUser.uid).onSnapshot(function (q) {
      lista = [];
      q.forEach(function (d) { var x = d.data(); x._id = d.id; x.subido = x.subido && x.subido.toDate ? x.subido.toDate() : null; lista.push(x); });
      lista.sort(function (a, b) { return (b.subido || 0) - (a.subido || 0); });
      cargando = false;
      if (S.pagina === 'facturas') N.ir('facturas', true);
    }, function (e) { console.error(e); cargando = false; lista = []; if (S.pagina === 'facturas') N.ir('facturas', true); });
    N.db().collection('emisionContax').where('uid', '==', N.auth().currentUser.uid).onSnapshot(function (q) {
      emision = {};
      q.forEach(function (d) { var x = d.data(); if (x.estado === 'noSePudo') emision[x.semana] = x; });
      if (S.pagina === 'facturas') N.ir('facturas', true);
    }, function (e) { console.warn('emisionContax', e); });
  }
  function semanasConFactura() {
    var s = {};
    (lista || []).forEach(function (f) { if (f.estado !== 'anulada' && f.estado !== 'rechazada') (f.semanas || []).forEach(function (x) { s[x] = f; }); });
    return s;
  }

  /* ── Página ── */
  N.PAGINAS.facturas = function () {
    if (!lista) cargar();
    var pend = (S.datos || {}).pendientes || [], libres = semanasLibres(), k = infoCorte();
    var pagadas = libres.filter(function (p) { return p.pagada; }).length;
    return N.titulo('Mis facturas', 'Sube aquí tu factura en PDF, foto o captura. Ya no hace falta mandarla por WhatsApp.') +
      '<div class="aviso info">' + ic('reloj') + '<div><b>Corte: ' + textoDia(k.corte) + ' a las 18:00</b>' +
        'Lo que subas antes entra al pago del ' + textoDia(k.viernes) + '. Lo que llegue después entra al pago de la semana siguiente.' +
        (k.horas <= 24 && k.horas >= 0 ? ' <b>Faltan ' + k.horas + ' h.</b>' : '') + '</div></div>' +
      (libres.some(function (p) { return emision[p.semana]; }) ? '<div class="aviso alerta">' + ic('alerta') + '<div><b>CONTAX no pudo emitir tu factura</b>' +
        'Mira el motivo en el pago y escríbenos para resolverlo. Apenas lo tengamos, emitimos tu factura.</div></div>' : '') +
      (pagadas ? '<div class="aviso alerta">' + ic('alerta') + '<div><b>Tienes ' + pagadas + (pagadas === 1 ? ' pago que ya se pagó' : ' pagos que ya se pagaron') + ' pero falta su factura</b>' +
        'El pago está hecho, pero la factura sigue pendiente de emisión. Emítela en el SIAT y adjúntala abajo, en ese pago.</div></div>' : '') +
      '<div class="grid2">' +
        '<div class="card"><div class="h2">Subir factura</div>' +
          (!S.perfil && !N.DEMO ? '<p style="margin-bottom:12px">Para subir facturas primero registra tu NIT. Lo pedimos una sola vez.</p><button class="btn ancho" data-pedir-nit>' + ic('doc') + 'Registrar mi NIT</button>' :
            libres.length ? formulario(libres) :
            N.vacio(pend.length || ((S.datos || {}).porEmitir || []).length ? 'Todos tus pagos ya tienen factura' : 'No tienes semanas pendientes', 'Cuando registremos una semana nueva podrás subir su factura aquí.')) +
        '</div>' +
        '<div class="card"><div class="h2">Datos para facturar</div>' +
          '<div class="dato"><span>Razón social</span><div><b>' + esc(C.facturacion.razonSocial) + '</b><button class="copiar" data-copiar="' + esc(C.facturacion.razonSocial) + '">Copiar</button></div></div>' +
          '<div class="dato"><span>NIT</span><div><b class="num">' + esc(C.facturacion.nit) + '</b><button class="copiar" data-copiar="' + esc(C.facturacion.nit) + '">Copiar</button></div></div>' +
          '<ul class="reglas" style="margin-top:12px">' +
            '<li>' + ic('doc') + '<span>Sube el <b>PDF, una foto o una captura</b> de tu factura: leemos solos el número, la fecha, el NIT y el importe. En fotos y capturas <b>todos los datos deben leerse bien</b>.</span></li>' +
            '<li>' + ic('escudo') + '<span><b>Una factura por cada pago</b>, por el importe exacto de ese pago, a nombre de MILTHAGOR y emitida con tu NIT registrado' + (S.perfil ? ' (<b class="num">' + esc(S.perfil.nit) + '</b>)' : '') + '. Adjúntala con el botón de ese pago.</span></li>' +
            '<li>' + ic('info') + '<span>Si una factura queda <b>Observada</b>, lee el motivo, corrígela y súbela de nuevo.</span></li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="h2">Facturas enviadas <small>' + (lista ? lista.length : '') + '</small></div>' +
        (lista == null ? '<p class="muted">Cargando tus facturas…</p>' : lista.length ? tabla() : N.vacio('Aún no subiste facturas', 'Las que subas aparecerán aquí con su estado.')) +
      '</div>';
  };

  /* Semanas que todavía se pueden facturar («Enviado a pagar» ya está en la planilla del banco) */
  function semanasLibres() {
    var ya = semanasConFactura(), d = S.datos || {};
    var pend = (d.pendientes || []).filter(function (p) { return !ya[p.semana] && !p.enPlanilla; });
    // También los pagos ya pagados cuya factura está pendiente de emisión
    var pagadas = (d.porEmitir || []).filter(function (p) { return !ya[p.semana]; }).map(function (p) { return Object.assign({}, p, { pagada: true }); });
    return pend.concat(pagadas);
  }
  /* Dos estados distintos: el del pago y el de la factura */
  function estadosPago(p) {
    var e = emision[p.semana];
    return '<div class="fac-estados"><span class="muted">Pago:</span> ' + (p.pagada ? '<span class="chip ok">Pagado' + (p.fechaPago ? ' el ' + esc(p.fechaPago) : '') + '</span>' : '<span class="chip pend">Pendiente</span>') +
      ' <span class="muted">Factura:</span> ' + (e ? '<span class="chip mal">CONTAX no pudo emitirla</span>' : '<span class="chip pend">Pendiente de emisión</span>') + '</div>' +
      (e ? '<div class="fac-motivo"><b>' + esc(e.motivo) + '</b>' + (AYUDA_MOTIVO[e.motivo] ? ' · ' + esc(AYUDA_MOTIVO[e.motivo]) : '') + (e.comentario ? '<br>' + esc(e.comentario) : '') + '</div>' : '');
  }
  /* Un pago = una factura. Cada pago pendiente tiene su botón «Adjuntar factura»; la factura se revisa
     contra ESE pago (mismo importe exacto). Así cada pago del banco tiene su factura y la conciliación es directa. */
  function formulario(libres) {
    return '<div id="fmFactura">' +
      libres.map(function (p, i) {
        return '<div class="fac-pago" data-i="' + i + '">' +
          '<div class="fac-sem"><span><b class="num">' + esc(p.semana) + '</b> · ' + esc(p.rango || '') + '</span><em class="num">' + bs(p.importe) + '</em>' +
            '<button class="btn chico" type="button" data-adjuntar="' + i + '">' + ic('doc') + 'Adjuntar factura</button></div>' + estadosPago(p) +
          '<div class="fac-leida" id="facLeida' + i + '"></div></div>';
      }).join('') +
      '<input id="facPdf" type="file" accept="application/pdf,.pdf,image/*" hidden>' +
      '<p class="muted" style="font-size:13px">Una factura por cada pago, por el importe exacto de ese pago. Sube el PDF del SIAT (hasta 700 KB), una foto o una captura: leemos los datos solos.</p>' +
    '</div>';
  }
  function tabla() {
    return '<div class="tabla-caja tabla-movil"><table><thead><tr><th>Enviada</th><th>N.º</th><th>Semanas</th><th>Estado</th><th class="monto">Importe</th><th></th></tr></thead><tbody>' +
      lista.map(function (f) {
        return '<tr><td data-et="Enviada">' + (f.subido ? N.fechaTexto(f.subido) : '—') + '</td>' +
          '<td data-et="N.º"><b class="num">' + esc(f.numero || '') + '</b>' + (f.fechaEmision || f.nitEmisor ? '<div class="fac-motivo" style="color:var(--nm-suave)">' + (f.fechaEmision ? 'Emitida ' + fechaCorta(f.fechaEmision) : '') + (f.nitEmisor ? ' · NIT ' + esc(f.nitEmisor) : '') + '</div>' : '') + '</td>' +
          '<td data-et="Semanas">' + esc((f.semanas || []).join(', ')) + '</td>' +
          '<td data-et="Estado">' + chip(f) + (f.motivo ? '<div class="fac-motivo">' + esc(f.motivo) + '</div>' : '') + '</td>' +
          '<td class="monto" data-et="Importe">' + bs(f.importe) + '</td>' +
          '<td>' + (f.estado === 'recibida' && f.origen !== 'contax' ? '<button class="btn sec chico" data-anular="' + esc(f._id) + '">Anular</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function normal(t) { return String(t || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function digitos(v) { return String(v == null ? '' : v).replace(/\D/g, '').replace(/^0+/, ''); }
  function fechaCorta(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || ''); }
  /* Mismo nombre: al menos dos palabras (de 3+ letras) en común, o una si uno de los dos tiene una sola */
  function mismoNombre(a, b) {
    var pal = function (t) { return normal(t).split(/[^A-Z]+/).filter(function (w) { return w.length >= 3; }); };
    var pa = pal(a), pb = pal(b); if (!pa.length || !pb.length) return null;
    return pa.filter(function (w) { return pb.indexOf(w) >= 0; }).length >= Math.min(2, pa.length, pb.length);
  }
  /* Revisión de lo que leyó la IA. Cada punto: ok + texto (si falla, el texto explica qué corregir) */
  function revisar(d, pago, libres) {
    var p = S.perfil || {}, mil = C.facturacion, ch = [];
    var punto = function (ok, bien, mal) { ch.push({ ok: !!ok, t: ok ? bien : mal }); };
    punto(d.esFactura && !d.anulada, 'Es una factura del SIAT', d.anulada ? 'La factura figura ANULADA.' : 'El archivo no parece una factura del SIAT. Sube el PDF, una foto o una captura de tu factura, no un comprobante ni un recibo.');
    punto(d.legible !== false, 'Todos los datos se leen bien',
      'No se leen bien ' + ((d.ilegibles || []).length ? 'estos datos: ' + d.ilegibles.join(', ') : 'algunos datos') + '. Sube una foto o captura más clara (completa, derecha y sin reflejos) o el PDF del SIAT.');
    punto(digitos(d.nitComprador) === digitos(mil.nit) && /MILTHAGOR/.test(normal(d.razonSocialComprador)),
      'A nombre de ' + mil.razonSocial + ' (NIT ' + mil.nit + ')',
      'La factura debe estar a nombre de ' + mil.razonSocial + ' con NIT ' + mil.nit + '. Está a nombre de «' + (d.razonSocialComprador || '—') + '» (NIT ' + (d.nitComprador || '—') + ').');
    punto(digitos(d.nitEmisor) && digitos(d.nitEmisor) === digitos(p.nit), 'Emitida con tu NIT ' + p.nit,
      'La factura fue emitida con el NIT ' + (d.nitEmisor || '—') + ', pero tu NIT registrado es ' + p.nit + '. Si tu NIT cambió, escríbenos para actualizarlo.');
    // Si el NIT lo cargó CONTAX desde sus facturas anteriores (origen «historial»), la razón social puede no ser exacta: no se exige
    punto(p.origen === 'historial' || mismoNombre(d.razonSocialEmisor, p.razonSocial) !== false, 'Emitida por ' + (d.razonSocialEmisor || '—'),
      'La factura la emite «' + (d.razonSocialEmisor || '—') + '», pero tu razón social registrada es «' + p.razonSocial + '».');
    var repetida = (lista || []).some(function (f) { return f.estado !== 'anulada' && f.estado !== 'rechazada' && digitos(f.numero) === digitos(d.numeroFactura) && (!f.nitEmisor || digitos(f.nitEmisor) === digitos(d.nitEmisor)); });
    punto(d.numeroFactura && !repetida, 'Factura N.º ' + d.numeroFactura, d.numeroFactura ? 'Ya subiste la factura N.º ' + d.numeroFactura + '.' : 'No se encontró el número de la factura.');
    var hoy = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
    punto(d.fechaEmision && d.fechaEmision <= hoy, 'Emitida el ' + fechaCorta(d.fechaEmision), 'No se encontró la fecha de emisión o es una fecha futura.');
    var igual = Math.abs((Number(d.importeTotal) || 0) - (Number(pago.importe) || 0)) <= 0.05;
    var otro = !igual && (libres || []).filter(function (x) { return x !== pago && Math.abs((Number(x.importe) || 0) - (Number(d.importeTotal) || 0)) <= 0.05; })[0];
    var total = (libres || []).reduce(function (t, x) { return t + (Number(x.importe) || 0); }, 0);
    punto(igual, bs(d.importeTotal) + ' = pago de la ' + pago.semana,
      'Esta factura es por ' + bs(d.importeTotal) + ', pero el pago de la ' + pago.semana + ' es de ' + bs(pago.importe) + '. ' +
      (otro ? 'Parece ser la factura del pago de la ' + otro.semana + ': adjúntala en ese pago.' :
       (libres || []).length > 1 && Math.abs(total - (Number(d.importeTotal) || 0)) <= 0.05 ? 'No se acepta una factura por varias semanas: emite una factura por cada pago.' :
       'Emite una factura por el importe exacto de este pago.'));
    return { puntos: ch, semanas: igual ? [pago] : [], todoBien: ch.every(function (x) { return x.ok; }) };
  }
  function pintarLeida(d, rv) {
    var dato = function (t, v) { return '<div class="dato"><span>' + t + '</span><div><b>' + esc(v || '—') + '</b></div></div>'; };
    return '<div class="card" style="margin:6px 0 12px">' +
      '<div class="h2">Datos de tu factura <small>leídos del archivo</small></div>' +
      dato('N.º de factura', d.numeroFactura) + dato('Fecha de emisión', fechaCorta(d.fechaEmision)) + dato('NIT del emisor', d.nitEmisor) + dato('Emisor', d.razonSocialEmisor) +
      dato('A nombre de', d.razonSocialComprador + (d.nitComprador ? ' · NIT ' + d.nitComprador : '')) + dato('Importe', bs(d.importeTotal)) +
      (d.codigoAutorizacion ? dato('Código de autorización', d.codigoAutorizacion.slice(0, 22) + (d.codigoAutorizacion.length > 22 ? '…' : '')) : '') +
      '<ul class="reglas" style="margin-top:12px">' + rv.puntos.map(function (x) {
        return '<li style="color:' + (x.ok ? 'inherit' : 'var(--nm-error)') + '">' + ic(x.ok ? 'escudo' : 'alerta') + '<span>' + esc(x.t) + '</span></li>';
      }).join('') + '</ul>' +
      (rv.todoBien ? '<button class="btn ancho" type="button" data-enviar style="margin-top:12px">' + ic('descargar') + 'Enviar factura</button>' :
        '<p class="muted" style="margin-top:10px">Corrige la factura en el SIAT y vuelve a adjuntarla.</p>') +
      '<div class="nm-login-err" data-err role="alert"></div>' +
    '</div>';
  }
  /* Le pide a la IA los datos del PDF (en demostración devuelve datos de ejemplo) */
  function leerConIA(dataUrl, pago) {
    if (N.DEMO) {
      var p = pago || { importe: 100 };
      return Promise.resolve({ modelo: 'demo', datos: { esFactura: true, nitEmisor: (S.perfil || {}).nit || '1234567', razonSocialEmisor: (S.perfil || {}).razonSocial || (S.datos || {}).nombre || '',
        numeroFactura: String(1000 + Math.floor(Math.random() * 900)), codigoAutorizacion: 'DEMO', fechaEmision: new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10),
        nitComprador: C.facturacion.nit, razonSocialComprador: C.facturacion.razonSocial, importeTotal: Number(p.importe) || 0, anulada: false } });
    }
    if (!C.ia || !C.ia.url) return Promise.reject(new Error('El lector de facturas no está disponible. Escríbenos por WhatsApp.'));
    return N.auth().currentUser.getIdToken().then(function (tok) {
      return fetch(C.ia.url.replace(/\/+$/, '') + '/factura', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
        body: JSON.stringify({ pdf: dataUrl.slice(dataUrl.indexOf(',') + 1), tipo: (dataUrl.match(/^data:([^;,]+)/) || [0, 'application/pdf'])[1] })
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.error || !j.datos) throw new Error(j.error || 'No pudimos leer tu factura. Intenta de nuevo en unos minutos.');
        return j;
      });
    });
  }
  /* Fotos y capturas: se achican a JPEG (lado mayor 2000 px) para que pesen poco y la IA lea más rápido */
  function leerImagen(archivo) {
    return new Promise(function (ok, mal) {
      var url = URL.createObjectURL(archivo), img = new Image();
      img.onload = function () {
        var esc2 = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * esc2); cv.height = Math.round(img.naturalHeight * esc2);
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        var q = 0.85, d = cv.toDataURL('image/jpeg', q);
        while (d.length * 0.75 > MAX_PDF && q > 0.4) { q -= 0.15; d = cv.toDataURL('image/jpeg', q); }
        if (d.length * 0.75 > MAX_PDF) return mal(new Error('La imagen es muy grande. Sube una captura o el PDF.'));
        ok(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('No se pudo abrir la imagen. Sube una foto en JPG o PNG, o el PDF.')); };
      img.src = url;
    });
  }
  function leerPDF(archivo) {
    if (archivo && /^image\//i.test(archivo.type || '')) return leerImagen(archivo);
    return new Promise(function (ok, mal) {
      if (!archivo) return mal(new Error('Elige el PDF, la foto o la captura de tu factura.'));
      if (!/pdf$/i.test(archivo.type || '') && !/\.pdf$/i.test(archivo.name || '')) return mal(new Error('El archivo debe ser PDF, foto o captura (JPG o PNG).'));
      if (archivo.size > MAX_PDF) return mal(new Error('El PDF pesa ' + Math.round(archivo.size / 1024) + ' KB. El máximo es 700 KB.'));
      var r = new FileReader();
      r.onload = function () {
        var t = String(r.result || '');
        if (t.indexOf('data:application/pdf;base64,') !== 0 && !/^data:[^,]*;base64,JVBER/.test(t)) {
          if (!/,JVBER/.test(t)) return mal(new Error('Ese archivo no parece un PDF válido.'));
        }
        ok(t);
      };
      r.onerror = function () { mal(new Error('No se pudo leer el archivo.')); };
      r.readAsDataURL(archivo);
    });
  }

  N.DESPUES.facturas = function () {
    var fm = document.getElementById('fmFactura');
    var pg = document.getElementById('pagina');
    pg.querySelectorAll('[data-anular]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm('¿Anular esta factura? Podrás subir otra para esas semanas.')) return;
        if (N.DEMO) { N.aviso('Demostración: no se anuló.'); return; }
        N.db().collection('facturas').doc(b.getAttribute('data-anular')).update({ estado: 'anulada', anulada: firebase.firestore.FieldValue.serverTimestamp() })
          .then(function () { N.aviso('Factura anulada.'); }, function (e) { console.error(e); N.aviso('No se pudo anular. Intenta de nuevo.'); });
      });
    });
    var bn = pg.querySelector('[data-pedir-nit]');
    if (bn) bn.addEventListener('click', function () { N.pedirNit(function () { N.ir('facturas', true); }); });
    if (!fm) return;
    var libres = semanasLibres(), entrada = fm.querySelector('#facPdf'), actual = -1;
    fm.querySelectorAll('[data-adjuntar]').forEach(function (b) {
      b.addEventListener('click', function () { actual = Number(b.getAttribute('data-adjuntar')); entrada.value = ''; entrada.click(); });
    });
    entrada.addEventListener('change', function () {
      var archivo = entrada.files[0], i = actual, pago = libres[i], caja = fm.querySelector('#facLeida' + i);
      if (!archivo || !pago || !caja) return;
      caja.innerHTML = '<div class="aviso info">' + ic('reloj') + '<div><b>Leyendo tu factura de la ' + esc(pago.semana) + '…</b>Tarda unos segundos.</div></div>';
      var datosPdf = null;
      leerPDF(archivo).then(function (d) { datosPdf = d; return leerConIA(d, pago); }).then(function (r) {
        var rv = revisar(r.datos, pago, libres);
        caja.innerHTML = pintarLeida(r.datos, rv);
        var env = caja.querySelector('[data-enviar]');
        if (env) env.addEventListener('click', function () { enviar({ d: r.datos, rv: rv, modelo: r.modelo || '', pdf: datosPdf, archivo: archivo, pago: pago }, env, caja.querySelector('[data-err]')); });
      }).catch(function (ex) { console.error(ex); caja.innerHTML = '<div class="nm-login-err">' + esc((ex && ex.message) || 'No pudimos leer tu factura.') + '</div>'; });
    });
  };
  function enviar(leida, btn, err) {
    var d = leida.d, a = leida.archivo;
    btn.disabled = true; btn.textContent = 'Enviando…';
    Promise.resolve().then(function () {
      if (N.DEMO) { N.aviso('Demostración: la factura no se envió.'); return; }
      var k = infoCorte(), db = N.db(), ref = db.collection('facturas').doc(), uid = N.auth().currentUser.uid, b = ahoraBolivia();
      var lote = db.batch();
      lote.set(db.collection('facturasPdf').doc(ref.id), { uid: uid, datos: leida.pdf });
      lote.set(ref, {
        uid: uid, id: String(S.datos.id || ''), nombre: String(S.datos.nombre || d.razonSocialEmisor || '').slice(0, 120),
        semanas: [leida.pago.semana], numero: d.numeroFactura, importe: Math.round(d.importeTotal * 100) / 100,
        fechaEmision: d.fechaEmision, horaEmision: d.horaEmision || '', nitEmisor: d.nitEmisor, razonEmisor: String(d.razonSocialEmisor || '').slice(0, 160),
        autorizacion: String(d.codigoAutorizacion || '').slice(0, 80), leidaIA: String(leida.modelo || '').slice(0, 60),
        nombreArchivo: String(a.name || 'factura.pdf').slice(0, 120), tamano: a.size,
        estado: 'recibida', subido: firebase.firestore.FieldValue.serverTimestamp(),
        corte: k.iso, fueraDeCorte: b.getUTCDay() === 5 || (b.getUTCDay() === 4 && b.getUTCHours() >= 18)
      });
      return lote.commit().then(function () { N.aviso('Factura de la ' + leida.pago.semana + ' enviada.'); N.ir('facturas', true); });
    }).catch(function (ex) {
      console.error(ex); btn.disabled = false; btn.innerHTML = ic('descargar') + 'Enviar factura';
      if (err) err.textContent = ex && ex.message && !/permission|insufficient/i.test(ex.message) ? ex.message : 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.';
    });
  }

  window.NM_FACTURAS = {
    resumen: function () { return lista; },
    salir: function () { if (escucha) escucha(); escucha = null; lista = null; cargando = false; }
  };
})();
