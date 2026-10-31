/* ══════════════════════════════════════════════════════════
   PORTAL CONTAX · NUMMEROS — Mis documentos
   El repartidor sube su documentación: NIT, Matrícula de Comercio (con su
   vigencia), ROE; cada mes RCV, Formulario 200 (IVA) y Formulario 400 (IT);
   y los estados financieros de cada gestión. El equipo los revisa en CONTROL.
   Datos: documentos/{uid}_{tipo}[_{periodo}] (estado) y documentosArchivo/{mismo id} (archivo).
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var N = window.NM;
  if (!N) return;
  var S = N.S, C = N.C, esc = N.esc, ic = N.ic;
  var CFG = C.documentos || {};
  var MAX = 700 * 1024;
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var INSCRIPCION = [['nit', 'Certificado de NIT'], ['matricula', 'Matrícula de Comercio'], ['roe', 'ROE (Registro Obligatorio de Empleadores)']];
  var MENSUALES = [['rcv', 'RCV (compras y ventas)'], ['f200', 'Formulario 200 (IVA)'], ['f400', 'Formulario 400 (IT)']];
  var docs = null, cargando = false;

  function idDoc(tipo, periodo) { return N.auth().currentUser.uid + '_' + tipo + (periodo ? '_' + periodo : ''); }
  function fechaCorta(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  /* Últimos meses ya cerrados (la declaración de un mes se presenta el mes siguiente) */
  function periodos() {
    var n = Number(CFG.meses) || 6, d = new Date(Date.now() - 4 * 3600e3), l = [];
    for (var i = 1; i <= n; i++) {
      var x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
      l.push(x.getUTCFullYear() + '-' + String(x.getUTCMonth() + 1).padStart(2, '0'));
    }
    return l;
  }
  function nombreMes(p) { var m = p.split('-'); return MESES[Number(m[1]) - 1] + ' ' + m[0]; }

  function cargar() {
    if (cargando) return;
    if (N.DEMO) { docs = {}; return; }
    cargando = true;
    N.db().collection('documentos').where('uid', '==', N.auth().currentUser.uid).get().then(function (q) {
      docs = {}; q.forEach(function (d) { docs[d.id] = d.data(); });
      cargando = false; if (S.pagina === 'documentos') N.ir('documentos', true);
    }, function (e) { console.error(e); docs = {}; cargando = false; if (S.pagina === 'documentos') N.ir('documentos', true); });
  }

  /* Estado de un documento para mostrar */
  function estado(tipo, periodo) {
    var d = docs && docs[idDoc(tipo, periodo)];
    if (!d) return { clase: 'mal', t: 'Falta', d: null };
    if (tipo === 'matricula' && CFG.matriculaHasta && (!d.vigencia || d.vigencia < CFG.matriculaHasta))
      return { clase: 'mal', t: 'Vencida o por vencer', d: d, nota: 'Vigente hasta ' + (fechaCorta(d.vigencia) || '—') + '. Debe estar vigente hasta el ' + fechaCorta(CFG.matriculaHasta) + '.' };
    if (d.estado === 'aprobado') return { clase: 'ok', t: 'Aprobado', d: d };
    if (d.estado === 'observado') return { clase: 'mal', t: 'Observado', d: d, nota: d.motivo || '' };
    return { clase: 'pend', t: 'Recibido · en revisión', d: d };
  }
  function fila(tipo, nombre, periodo) {
    var e = estado(tipo, periodo), aprobado = e.d && e.d.estado === 'aprobado' && e.t === 'Aprobado';
    return '<div class="fac-sem doc-fila"><span><b>' + esc(nombre) + '</b>' +
        (e.d ? '<small class="muted" style="display:block">' + esc(e.d.nombreArchivo || '') + (e.d.vigencia ? ' · vigente hasta ' + fechaCorta(e.d.vigencia) : '') + '</small>' : '') +
        (e.nota ? '<small style="display:block;color:var(--nm-error)">' + esc(e.nota) + '</small>' : '') + '</span>' +
      '<span class="chip ' + e.clase + '" style="flex:none">' + esc(e.t) + '</span>' +
      (e.d ? '<button class="btn sec chico" type="button" data-ver="' + esc(idDoc(tipo, periodo)) + '">' + ic('ojo') + 'Ver</button>' : '') +
      (aprobado ? '' : '<button class="btn chico" type="button" data-subir="' + tipo + '" data-per="' + esc(periodo || '') + '">' + ic('subir') + (e.d ? 'Reemplazar' : 'Subir') + '</button>') +
    '</div>';
  }

  N.PAGINAS.documentos = function () {
    if (!docs) cargar();
    var anio = CFG.gestionEEFF || String(new Date().getFullYear() - 1);
    return N.titulo('Mis documentos', 'Sube aquí tu documentación. El equipo de CONTAX la revisa y ves el estado de cada documento.') +
      (docs == null ? '<div class="card"><p class="muted">Cargando tus documentos…</p></div>' :
      '<div class="card"><div class="h2">Inscripción <small>una sola vez</small></div>' +
        INSCRIPCION.map(function (x) { return fila(x[0], x[1], ''); }).join('') +
        (CFG.matriculaHasta ? '<p class="muted" style="font-size:13px;margin-top:6px">La Matrícula de Comercio de la gestión actual vence el ' + fechaCorta(CFG.matriculaHasta) + ': súbela actualizada.</p>' : '') +
      '</div>' +
      '<div class="card"><div class="h2">Declaraciones mensuales</div>' +
        '<p class="muted" style="font-size:13px;margin-bottom:10px">Sube cada mes tu RCV, el Formulario 200 (IVA) y el Formulario 400 (IT). Si eres cliente CONTAX, nosotros las presentamos: no necesitas subirlas.</p>' +
        periodos().map(function (p) {
          return '<div style="margin:10px 0 4px"><b>' + esc(nombreMes(p)) + '</b></div>' + MENSUALES.map(function (x) { return fila(x[0], x[1], p); }).join('');
        }).join('') +
      '</div>' +
      '<div class="card"><div class="h2">Estados financieros</div>' +
        '<p class="muted" style="font-size:13px;margin-bottom:10px">Solo si abriste tu NIT en ' + esc(anio) + ' o antes.</p>' +
        fila('eeff', 'Estados financieros gestión ' + anio, anio) +
      '</div>') +
      '<input id="docArch" type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv" hidden>';
  };

  function leer(archivo) {
    return new Promise(function (ok, mal) {
      if (archivo.size > MAX) return mal(new Error('El archivo pesa ' + Math.round(archivo.size / 1024) + ' KB. El máximo es 700 KB.'));
      var r = new FileReader();
      r.onload = function () { ok(String(r.result || '')); };
      r.onerror = function () { mal(new Error('No se pudo leer el archivo.')); };
      r.readAsDataURL(archivo);
    });
  }
  /* La vigencia de la matrícula se pide al subirla */
  function pedirVigencia() {
    return new Promise(function (ok) {
      var v = window.prompt('¿Hasta qué fecha está vigente tu Matrícula de Comercio? (DD/MM/AAAA)', CFG.matriculaHasta ? fechaCorta(CFG.matriculaHasta) : '');
      if (v == null) return ok(null);
      var m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      ok(m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '');
    });
  }

  N.DESPUES.documentos = function () {
    var pg = document.getElementById('pagina'), entrada = pg.querySelector('#docArch'), actual = null;
    if (!entrada) return;
    pg.querySelectorAll('[data-subir]').forEach(function (b) {
      b.addEventListener('click', function () { actual = { tipo: b.getAttribute('data-subir'), periodo: b.getAttribute('data-per') || '', btn: b }; entrada.value = ''; entrada.click(); });
    });
    pg.querySelectorAll('[data-ver]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (N.DEMO) { N.aviso('Demostración: no hay archivo.'); return; }
        N.db().collection('documentosArchivo').doc(b.getAttribute('data-ver')).get().then(function (d) {
          if (!d.exists) { N.aviso('No se encontró el archivo.'); return; }
          var t = String(d.data().datos || ''), bin = atob(t.slice(t.indexOf(',') + 1)), arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          window.open(URL.createObjectURL(new Blob([arr], { type: d.data().mime || 'application/octet-stream' })), '_blank');
        }, function () { N.aviso('No se pudo abrir el archivo.'); });
      });
    });
    entrada.addEventListener('change', function () {
      var a = entrada.files[0], x = actual; if (!a || !x) return;
      var vig = x.tipo === 'matricula' ? pedirVigencia() : Promise.resolve(undefined);
      vig.then(function (v) {
        if (v === null) return;
        if (x.tipo === 'matricula' && !v) { N.aviso('Escribe la fecha de vigencia como DD/MM/AAAA.'); return; }
        x.btn.disabled = true; x.btn.textContent = 'Subiendo…';
        return leer(a).then(function (datos) {
          if (N.DEMO) { N.aviso('Demostración: el documento no se guardó.'); return; }
          var id = idDoc(x.tipo, x.periodo), db = N.db(), lote = db.batch(), uid = N.auth().currentUser.uid;
          var meta = { uid: uid, id: String(S.datos.id || ''), nombre: String(S.datos.nombre || '').slice(0, 120), tipo: x.tipo, periodo: x.periodo,
            nombreArchivo: String(a.name || 'documento').slice(0, 120), tamano: a.size, mime: String(a.type || '').slice(0, 80),
            estado: 'recibido', subido: firebase.firestore.FieldValue.serverTimestamp() };
          if (v) meta.vigencia = v;
          lote.set(db.collection('documentosArchivo').doc(id), { uid: uid, datos: datos, mime: meta.mime });
          lote.set(db.collection('documentos').doc(id), meta);
          return lote.commit().then(function () { docs[id] = Object.assign({}, meta, { subido: new Date() }); N.aviso('Documento enviado.'); N.ir('documentos', true); });
        });
      }).catch(function (e) {
        console.error(e); x.btn.disabled = false; x.btn.textContent = 'Subir';
        N.aviso(e && e.message && !/permission|insufficient/i.test(e.message) ? e.message : 'No se pudo subir. Si el documento ya fue aprobado, no se puede reemplazar.');
      });
    });
  };

  window.NM_DOCUMENTOS = { salir: function () { docs = null; cargando = false; } };
})();
