/* ══════════════════════════════════════════════════════════
   PORTAL CONTAX · NUMMEROS — Mis facturas
   El repartidor sube su factura en PDF desde aquí (ya no por WhatsApp).
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

  var ESTADOS = {
    recibida: ['pend', 'Recibida · en revisión'],
    aprobada: ['ok', 'Aprobada'],
    observada: ['mal', 'Observada'],
    rechazada: ['mal', 'Rechazada'],
    anulada: ['neutro', 'Anulada por ti']
  };
  function chip(f) {
    if (f.origen === 'contax') return '<span class="chip ok">Emitida por CONTAX</span>';
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
  }
  function semanasConFactura() {
    var s = {};
    (lista || []).forEach(function (f) { if (f.estado !== 'anulada' && f.estado !== 'rechazada') (f.semanas || []).forEach(function (x) { s[x] = f; }); });
    return s;
  }

  /* ── Página ── */
  N.PAGINAS.facturas = function () {
    if (!lista) cargar();
    var d = S.datos || {}, pend = d.pendientes || [], ya = semanasConFactura(), k = infoCorte();
    var libres = pend.filter(function (p) { return !ya[p.semana]; });
    return N.titulo('Mis facturas', 'Sube aquí tu factura en PDF. Ya no hace falta mandarla por WhatsApp.') +
      '<div class="aviso info">' + ic('reloj') + '<div><b>Corte: ' + textoDia(k.corte) + ' a las 18:00</b>' +
        'Lo que subas antes entra al pago del ' + textoDia(k.viernes) + '. Lo que llegue después entra al pago de la semana siguiente.' +
        (k.horas <= 24 && k.horas >= 0 ? ' <b>Faltan ' + k.horas + ' h.</b>' : '') + '</div></div>' +
      '<div class="grid2">' +
        '<div class="card"><div class="h2">Subir factura</div>' +
          (libres.length ? formulario(libres) :
            N.vacio(pend.length ? 'Todas tus semanas pendientes ya tienen factura' : 'No tienes semanas pendientes', 'Cuando registremos una semana nueva podrás subir su factura aquí.')) +
        '</div>' +
        '<div class="card"><div class="h2">Datos para facturar</div>' +
          '<div class="dato"><span>Razón social</span><div><b>' + esc(C.facturacion.razonSocial) + '</b><button class="copiar" data-copiar="' + esc(C.facturacion.razonSocial) + '">Copiar</button></div></div>' +
          '<div class="dato"><span>NIT</span><div><b class="num">' + esc(C.facturacion.nit) + '</b><button class="copiar" data-copiar="' + esc(C.facturacion.nit) + '">Copiar</button></div></div>' +
          '<ul class="reglas" style="margin-top:12px">' +
            '<li>' + ic('doc') + '<span>Una factura puede cubrir una o varias semanas. Marca todas las que incluye.</span></li>' +
            '<li>' + ic('escudo') + '<span>El importe de la factura debe ser igual a la suma de las semanas que marcas.</span></li>' +
            '<li>' + ic('info') + '<span>Si una factura queda <b>Observada</b>, lee el motivo, corrígela y súbela de nuevo.</span></li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="h2">Facturas enviadas <small>' + (lista ? lista.length : '') + '</small></div>' +
        (lista == null ? '<p class="muted">Cargando tus facturas…</p>' : lista.length ? tabla() : N.vacio('Aún no subiste facturas', 'Las que subas aparecerán aquí con su estado.')) +
      '</div>';
  };

  function formulario(libres) {
    return '<form id="fmFactura" novalidate>' +
      '<div class="fm-campo"><label>Semanas que cubre</label>' +
        libres.map(function (p, i) {
          return '<label class="fac-sem"><input type="checkbox" name="sem" value="' + esc(p.semana) + '" data-imp="' + (Number(p.importe) || 0) + '"' + (i === 0 ? ' checked' : '') + '>' +
            '<span><b class="num">' + esc(p.semana) + '</b> · ' + esc(p.rango || '') + '</span><em class="num">' + bs(p.importe) + '</em></label>';
        }).join('') +
      '</div>' +
      '<div class="grid2" style="gap:12px">' +
        '<div class="fm-campo"><label for="facNum">N.º de factura</label><input id="facNum" inputmode="numeric" maxlength="30" required placeholder="1245"></div>' +
        '<div class="fm-campo"><label for="facImp">Importe (Bs)</label><input id="facImp" inputmode="decimal" required></div>' +
      '</div>' +
      '<div class="fm-campo"><label for="facFecha">Fecha de emisión</label><input id="facFecha" type="date" required></div>' +
      '<div class="fm-campo"><label for="facPdf">Archivo PDF</label><input id="facPdf" type="file" accept="application/pdf,.pdf" required>' +
        '<small>Solo PDF, hasta 700 KB. Es el PDF que descargas del SIAT, no una foto.</small></div>' +
      '<div class="fm-campo"><label for="facNota">Comentario (opcional)</label><textarea id="facNota" maxlength="300" rows="2"></textarea></div>' +
      '<div class="nm-login-err" id="facErr" role="alert"></div>' +
      '<button class="btn ancho" type="submit" id="facBtn">' + ic('descargar') + 'Enviar factura</button>' +
    '</form>';
  }

  function tabla() {
    return '<div class="tabla-caja tabla-movil"><table><thead><tr><th>Enviada</th><th>N.º</th><th>Semanas</th><th>Estado</th><th class="monto">Importe</th><th></th></tr></thead><tbody>' +
      lista.map(function (f) {
        return '<tr><td data-et="Enviada">' + (f.subido ? N.fechaTexto(f.subido) : '—') + '</td>' +
          '<td data-et="N.º"><b class="num">' + esc(f.numero || '') + '</b></td>' +
          '<td data-et="Semanas">' + esc((f.semanas || []).join(', ')) + '</td>' +
          '<td data-et="Estado">' + chip(f) + (f.motivo ? '<div class="fac-motivo">' + esc(f.motivo) + '</div>' : '') + '</td>' +
          '<td class="monto" data-et="Importe">' + bs(f.importe) + '</td>' +
          '<td>' + (f.estado === 'recibida' && f.origen !== 'contax' ? '<button class="btn sec chico" data-anular="' + esc(f._id) + '">Anular</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function sumaMarcadas(fm) {
    var s = 0; fm.querySelectorAll('input[name=sem]:checked').forEach(function (c) { s += Number(c.getAttribute('data-imp')) || 0; });
    return Math.round(s * 100) / 100;
  }
  function numeroDe(t) { return N.numero(String(t || '').replace(/\s/g, '')); }
  function leerPDF(archivo) {
    return new Promise(function (ok, mal) {
      if (!archivo) return mal(new Error('Elige el PDF de tu factura.'));
      if (!/pdf$/i.test(archivo.type || '') && !/\.pdf$/i.test(archivo.name || '')) return mal(new Error('El archivo debe ser PDF.'));
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
    if (!fm) return;
    var imp = fm.querySelector('#facImp');
    var poner = function () { imp.value = sumaMarcadas(fm).toFixed(2).replace('.', ','); };
    poner();
    fm.querySelectorAll('input[name=sem]').forEach(function (c) { c.addEventListener('change', poner); });
    fm.querySelector('#facFecha').value = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
    fm.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = fm.querySelector('#facErr'), btn = fm.querySelector('#facBtn');
      err.textContent = '';
      var semanas = [].map.call(fm.querySelectorAll('input[name=sem]:checked'), function (c) { return c.value; });
      var numero = fm.querySelector('#facNum').value.trim().replace(/\s+/g, '');
      var importe = numeroDe(imp.value), fecha = fm.querySelector('#facFecha').value;
      var archivo = fm.querySelector('#facPdf').files[0], nota = fm.querySelector('#facNota').value.trim();
      if (!semanas.length) { err.textContent = 'Marca al menos una semana.'; return; }
      if (!numero) { err.textContent = 'Escribe el número de la factura.'; return; }
      if (!importe || importe <= 0) { err.textContent = 'Escribe el importe de la factura.'; return; }
      if (!fecha) { err.textContent = 'Elige la fecha de emisión.'; return; }
      var suma = sumaMarcadas(fm);
      if (Math.abs(suma - importe) > 0.05 && !confirm('El importe (' + bs(importe) + ') no es igual a la suma de las semanas (' + bs(suma) + '). ¿Enviar igual?')) return;
      btn.disabled = true; btn.innerHTML = (N.anilloBoton ? N.anilloBoton() : '') + 'Enviando…';
      leerPDF(archivo).then(function (datos) {
        if (N.DEMO) { N.aviso('Demostración: la factura no se envió.'); return; }
        var k = infoCorte(), db = N.db(), ref = db.collection('facturas').doc(), d = S.datos;
        var b = ahoraBolivia();
        var lote = db.batch();
        lote.set(db.collection('facturasPdf').doc(ref.id), { uid: N.auth().currentUser.uid, datos: datos });
        var doc = {
          uid: N.auth().currentUser.uid, id: String(d.id || ''), nombre: String(d.nombre || '').slice(0, 120),
          semanas: semanas, numero: numero, importe: Math.round(importe * 100) / 100, fechaEmision: fecha,
          nombreArchivo: String(archivo.name || 'factura.pdf').slice(0, 120), tamano: archivo.size,
          estado: 'recibida', subido: firebase.firestore.FieldValue.serverTimestamp(),
          corte: k.iso, fueraDeCorte: b.getUTCDay() === 5 || (b.getUTCDay() === 4 && b.getUTCHours() >= 18)
        };
        if (nota) doc.nota = nota.slice(0, 300);
        lote.set(ref, doc);
        return lote.commit().then(function () { N.aviso('Factura enviada. Te avisamos aquí cuando la revisemos.'); N.ir('facturas', true); });
      }).catch(function (ex) {
        console.error(ex);
        err.textContent = ex && ex.message && !/permission|insufficient/i.test(ex.message) ? ex.message : 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.';
      }).then(function () { if (document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = ic('descargar') + 'Enviar factura'; } });
    });
  };

  window.NM_FACTURAS = {
    resumen: function () { return lista; },
    salir: function () { if (escucha) escucha(); escucha = null; lista = null; cargando = false; }
  };
})();
