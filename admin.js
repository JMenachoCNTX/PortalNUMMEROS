/* ══════════════════════════════════════════════════════════
   PANEL DE ADMINISTRADOR · Portal CONTAX
   Solo se carga cuando entra la cuenta de administrador.
   Edita el documento publico/contenido de Firebase (anuncios, avisos
   y preguntas). Reemplaza a las hojas Anuncios, Avisos, FAQ, ChatLog y
   AvisosLeidos del archivo CONTROL.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var N = window.NM, S = N.S, esc = N.esc, ic = N.ic;
  var P = N.PAGINAS, D = N.DESPUES;
  var previas = {};          // id de imagen subida → vista previa (hasta que GitHub la publique)
  var lecturasCache = {};    // código de aviso → cantidad de lecturas
  var registros = { vista: 'chats', chats: null, archivoChats: null, archivoLecturas: null, buscar: '' };

  var TIPOS = [['INFO', 'Información'], ['IMPORTANTE', 'Importante'], ['URGENTE', 'Urgente']];
  var FRECUENCIAS = [['UNA VEZ', 'Una sola vez'], ['CADA INGRESO', 'Cada vez que entra'], ['HASTA QUE CONFIRME', 'Hasta que presione "Entendido"']];
  var PARA = [['TODOS', 'Todos'], ['NO HABILITADOS', 'No habilitados por la app'], ['SIN POLIZA', 'Sin póliza presentada'], ['CON PENDIENTES', 'Con pagos pendientes'], ['IDS', 'IDs específicos']];
  function nombreDe(lista, v) { for (var i = 0; i < lista.length; i++) if (lista[i][0] === v) return lista[i][1]; return v || ''; }

  function nuevoId() {
    var a = new Uint8Array(6); (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
  }
  function contenido() { S.contenido = S.contenido || {}; return S.contenido; }
  function lista(k) { var c = contenido(); c[k] = c[k] || []; return c[k]; }
  function fechaCorta(iso) { if (!iso) return ''; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function vigencia(it) {
    if (it.desde && it.hasta) return 'Del ' + fechaCorta(it.desde) + ' al ' + fechaCorta(it.hasta);
    if (it.desde) return 'Desde el ' + fechaCorta(it.desde);
    if (it.hasta) return 'Hasta el ' + fechaCorta(it.hasta);
    return 'Sin fecha límite';
  }
  function estadoItem(it) {
    if (it.activo === false) return '<span class="chip neutro">Apagado</span>';
    if (!N.vigente(it)) return '<span class="chip pend">Fuera de fecha</span>';
    return '<span class="chip ok">Publicado</span>';
  }

  /* Guarda una lista (anuncios, avisos o preguntas) en Firebase */
  function guardar(k, msg) {
    N.aplicarContenido(contenido());
    if (N.DEMO) { N.aviso(msg + ' (demostración: no se guardó)'); return Promise.resolve(); }
    var cambio = {}; cambio[k] = lista(k); cambio.actualizado = firebase.firestore.FieldValue.serverTimestamp();
    return N.db().collection('publico').doc('contenido').set(cambio, { merge: true }).then(function () { N.aviso(msg); },
      function (e) { console.error(e); N.aviso('No se pudo guardar. Revisa tu conexión.'); throw e; });
  }
  /* Antes de editar, trae la versión más reciente (por si se editó desde otro equipo) */
  function recargar() {
    if (N.DEMO) return Promise.resolve();
    return N.db().collection('publico').doc('contenido').get().then(function (d) { N.aplicarContenido(d.exists ? d.data() : {}); });
  }

  /* ── Imagen: subir desde el equipo (se achica y se guarda en Firebase) ── */
  function achicar(archivo) {
    return new Promise(function (ok, mal) {
      var img = new Image(), url = URL.createObjectURL(archivo);
      img.onload = function () {
        var max = 1400, w = img.naturalWidth, h = img.naturalHeight;
        if (w > max) { h = Math.round(h * max / w); w = max; }
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        var datos = cv.toDataURL('image/webp', 0.85);
        if (datos.indexOf('data:image/webp') !== 0) datos = cv.toDataURL('image/jpeg', 0.86);
        var q = 0.8;
        while (datos.length > 900000 && q > 0.4) { datos = cv.toDataURL(datos.indexOf('webp') > 0 ? 'image/webp' : 'image/jpeg', q); q -= 0.1; }
        if (datos.length > 900000) { mal(new Error('La imagen es demasiado grande.')); return; }
        ok(datos);
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('Ese archivo no es una imagen.')); };
      img.src = url;
    });
  }
  function subirImagen(datos, nombre) {
    var id = nuevoId();
    previas[id] = datos;
    if (N.DEMO) return Promise.resolve('subida:' + id);
    return N.db().collection('imagenes').doc(id).set({
      datos: datos, tipo: datos.slice(5, datos.indexOf(';')), nombre: String(nombre || '').slice(0, 120),
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () { return 'subida:' + id; });
  }
  function vistaImagen(it) {
    var m = String(it.fuente || '').match(/^subida:(.+)$/);
    if (it.imagen) return it.imagen;
    if (m && previas[m[1]]) return previas[m[1]];
    return '';
  }

  /* ══════════ FORMULARIO GENÉRICO (ventana) ══════════ */
  function campoHTML(c, v) {
    var id = 'f_' + c.k, val = v == null ? '' : v;
    var ayuda = c.ayuda ? '<small>' + c.ayuda + '</small>' : '';
    if (c.tipo === 'textarea') return '<div class="fm-campo"><label for="' + id + '">' + c.t + '</label><textarea id="' + id + '" rows="' + (c.filas || 5) + '"' + (c.max ? ' maxlength="' + c.max + '"' : '') + '>' + esc(val) + '</textarea>' + ayuda + '</div>';
    if (c.tipo === 'select') return '<div class="fm-campo"><label for="' + id + '">' + c.t + '</label><select id="' + id + '">' + c.opciones.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' + ayuda + '</div>';
    if (c.tipo === 'switch') return '<label class="fm-switch"><input type="checkbox" id="' + id + '"' + (val !== false ? ' checked' : '') + '><span></span>' + c.t + '</label>';
    if (c.tipo === 'imagen') {
      var src = vistaImagen(v || {});
      return '<div class="fm-campo"><label>' + c.t + '</label><div class="fm-imagen" id="' + id + '">' +
        '<div class="fm-img-previa">' + (src ? '<img src="' + esc(src) + '" alt="">' : '<span>' + ic('imagen') + 'Sin imagen</span>') + '</div>' +
        '<div class="fm-img-acc"><label class="btn chico">' + ic('subir') + 'Subir imagen<input type="file" accept="image/*" hidden></label>' +
        '<button type="button" class="btn sec chico" data-link>Pegar link de Drive</button>' +
        ((v && v.fuente) && !c.obligatorio ? '<button type="button" class="btn sec chico" data-quitar>Quitar</button>' : '') + '</div>' +
        '<input type="url" class="fm-img-link" placeholder="https://drive.google.com/file/d/…" value="' + esc(v && v.fuente && !/^subida:/.test(v.fuente) ? v.fuente : '') + '"' + (v && v.fuente && !/^subida:/.test(v.fuente) ? '' : ' hidden') + '>' +
        '<small>JPG o PNG. Se achica sola. Si usas un link de Drive, la carpeta debe estar compartida con el robot.</small></div></div>';
    }
    return '<div class="fm-campo"><label for="' + id + '">' + c.t + '</label><input id="' + id + '" type="' + (c.tipo || 'text') + '" value="' + esc(val) + '"' + (c.max ? ' maxlength="' + c.max + '"' : '') + (c.ph ? ' placeholder="' + esc(c.ph) + '"' : '') + '>' + ayuda + '</div>';
  }

  function abrirFormulario(titulo, campos, item, alGuardar, extra) {
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<form class="modal-caja fm" novalidate>' +
      '<div class="modal-cab"><div class="nm-patron oscuro" aria-hidden="true"></div><div class="modal-fila"><img class="iso" src="marca/logos/nummeros-isotipo-blanco.svg" alt="">' +
      '<span class="modal-chip">' + ic('editar') + 'Administrador</span><button type="button" class="modal-x" aria-label="Cerrar" data-cerrar>×</button></div><h3>' + esc(titulo) + '</h3></div>' +
      '<div class="modal-cuerpo">' + campos.map(function (c) { return '<div class="fm-bloque" data-campo="' + c.k + '"' + (c.si && !c.si(item) ? ' hidden' : '') + '>' + campoHTML(c, c.tipo === 'imagen' ? item : item[c.k]) + '</div>'; }).join('') +
      '<div class="nm-login-err" data-err role="alert"></div></div>' +
      '<div class="modal-pie">' + (extra ? '<button type="button" class="btn sec" data-extra>' + extra.t + '</button>' : '') +
      '<button type="button" class="btn sec" data-cerrar>Cancelar</button><button class="btn" type="submit">Guardar</button></div></form>';
    document.body.appendChild(m);
    var imagenNueva = null;   // { datos, nombre } o { link } o { quitar: true }

    function leerValores() {
      var v = Object.assign({}, item);
      campos.forEach(function (c) {
        var el = m.querySelector('#f_' + c.k);
        if (!el || c.tipo === 'imagen') return;
        v[c.k] = c.tipo === 'switch' ? el.checked : String(el.value || '').trim();
      });
      return v;
    }
    function actualizarVisibles() {
      var v = leerValores();
      campos.forEach(function (c) { if (c.si) m.querySelector('[data-campo="' + c.k + '"]').hidden = !c.si(v); });
    }
    m.addEventListener('change', actualizarVisibles);

    var ci = m.querySelector('.fm-imagen');
    if (ci) {
      var previa = ci.querySelector('.fm-img-previa'), link = ci.querySelector('.fm-img-link');
      ci.querySelector('input[type=file]').addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        previa.innerHTML = '<span>Preparando…</span>';
        achicar(f).then(function (datos) {
          imagenNueva = { datos: datos, nombre: f.name };
          previa.innerHTML = '<img src="' + datos + '" alt="">';
          link.hidden = true; link.value = '';
        }, function (er) { previa.innerHTML = '<span>' + esc(er.message) + '</span>'; });
      });
      ci.querySelector('[data-link]').addEventListener('click', function () { link.hidden = false; link.focus(); });
      link.addEventListener('input', function () { imagenNueva = link.value.trim() ? { link: link.value.trim() } : null; });
      var q = ci.querySelector('[data-quitar]');
      if (q) q.addEventListener('click', function () { imagenNueva = { quitar: true }; previa.innerHTML = '<span>' + ic('imagen') + 'Sin imagen</span>'; link.value = ''; link.hidden = true; });
    }

    function cerrar() { m.remove(); }
    m.querySelectorAll('[data-cerrar]').forEach(function (b) { b.addEventListener('click', cerrar); });
    if (extra) m.querySelector('[data-extra]').addEventListener('click', function () { extra.fn(leerValores()); });
    m.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = leerValores(), err = m.querySelector('[data-err]');
      var btn = m.querySelector('button[type=submit]');
      var falta = campos.filter(function (c) { return c.obligatorio && c.tipo !== 'imagen' && !v[c.k] && (!c.si || c.si(v)); })[0];
      if (falta) { err.textContent = 'Completa: ' + falta.t + '.'; return; }
      if (v.desde && v.hasta && v.desde > v.hasta) { err.textContent = 'La fecha "Desde" no puede ser después de "Hasta".'; return; }
      var conImagen = campos.some(function (c) { return c.tipo === 'imagen' && c.obligatorio; });
      if (conImagen && !v.fuente && !(imagenNueva && !imagenNueva.quitar)) { err.textContent = 'Falta la imagen.'; return; }
      btn.disabled = true; btn.textContent = 'Guardando…'; err.textContent = '';
      var paso = Promise.resolve();
      if (imagenNueva && imagenNueva.datos) paso = subirImagen(imagenNueva.datos, imagenNueva.nombre).then(function (f) { v.fuente = f; v.imagen = ''; });
      else if (imagenNueva && imagenNueva.link) { v.fuente = imagenNueva.link; v.imagen = /^https:\/\//.test(v.fuente) && !/drive\.google|docs\.google/.test(v.fuente) ? v.fuente : ''; }
      else if (imagenNueva && imagenNueva.quitar) { v.fuente = ''; v.imagen = ''; }
      paso.then(function () { return alGuardar(v); }).then(cerrar, function (ex) {
        btn.disabled = false; btn.textContent = 'Guardar';
        err.textContent = (ex && ex.message) || 'No se pudo guardar.';
      });
    });
    var primero = m.querySelector('input:not([type=checkbox]):not([type=file]):not([hidden]), textarea');
    if (primero) primero.focus();
  }

  function confirmar(texto, si) {
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<div class="modal-caja" role="alertdialog" aria-modal="true"><div class="modal-cuerpo" style="padding-top:22px"><p><b>' + esc(texto) + '</b></p><p class="muted">Esta acción no se puede deshacer.</p></div>' +
      '<div class="modal-pie"><button class="btn sec" data-no>Cancelar</button><button class="btn peligro" data-si>Sí, borrar</button></div></div>';
    document.body.appendChild(m);
    m.querySelector('[data-no]').onclick = function () { m.remove(); };
    m.querySelector('[data-si]').onclick = function () { m.remove(); si(); };
  }

  function mover(k, id, paso) {
    var l = lista(k).slice().sort(function (a, b) { return (a.orden || 999) - (b.orden || 999); });
    var i = l.findIndex(function (x) { return x.id === id; }), j = i + paso;
    if (i < 0 || j < 0 || j >= l.length) return;
    var t = l[i]; l[i] = l[j]; l[j] = t;
    l.forEach(function (x, n) { x.orden = n + 1; });
    contenido()[k] = l;
    guardar(k, 'Orden actualizado').then(refrescar);
  }
  function refrescar() { N.ir(S.pagina, true); }

  /* ══════════ PANEL (inicio del administrador) ══════════ */
  P.admin = function () {
    var c = contenido(), pub = S.publico || {};
    var an = (c.anuncios || []), av = (c.avisos || []), pr = (c.preguntas || []);
    var cuenta = function (l) { return l.filter(N.vigente).length; };
    return N.titulo('Panel de administrador', 'Desde aquí manejas lo que ven los repartidores. Ya no hace falta tocar el archivo CONTROL para esto.') +
      '<div class="nm-kpis adm-kpis">' +
        '<div class="nm-kpi"><small>Repartidores</small><b class="num">' + (pub.totalRepartidores || '—') + '</b><em>con acceso al portal</em></div>' +
        '<button class="nm-kpi" data-ir="admin-anuncios"><small>Anuncios</small><b class="num">' + cuenta(an) + '</b><em>publicados de ' + an.length + '</em></button>' +
        '<button class="nm-kpi" data-ir="admin-avisos"><small>Avisos</small><b class="num">' + cuenta(av) + '</b><em>publicados de ' + av.length + '</em></button>' +
        '<button class="nm-kpi" data-ir="admin-preguntas"><small>Preguntas</small><b class="num">' + cuenta(pr) + '</b><em>publicadas de ' + pr.length + '</em></button>' +
      '</div>' +
      '<div class="grid2">' +
        '<div class="card"><div class="h2">Accesos rápidos</div><div class="adm-rapidos">' +
          '<button class="btn" data-adm="nuevo-aviso">' + ic('megafono') + 'Nuevo aviso</button>' +
          '<button class="btn sec" data-adm="nuevo-anuncio">' + ic('imagen') + 'Nuevo anuncio</button>' +
          '<button class="btn sec" data-adm="nueva-pregunta">' + ic('preguntas') + 'Nueva pregunta</button>' +
          '<button class="btn sec" data-ir="admin-registros">' + ic('chat') + 'Ver chats y lecturas</button>' +
        '</div></div>' +
        '<div class="card"><div class="h2">Cómo funciona</div><ul class="reglas">' +
          '<li>' + N.ic('reloj') + '<span>Los <b>avisos y preguntas</b> se ven al instante en el portal.</span></li>' +
          '<li>' + N.ic('imagen') + '<span>Las <b>imágenes nuevas</b> tardan unos 15 minutos: el robot las publica en GitHub.</span></li>' +
          '<li>' + N.ic('info') + '<span>Los <b>pagos y trámites</b> siguen llegando de Google Sheets cada 15 minutos.</span></li>' +
          '<li>' + N.ic('candado') + '<span>Para salir del modo administrador, presiona <b>Salir</b>.</span></li>' +
        '</ul></div>' +
      '</div>';
  };

  /* ══════════ ANUNCIOS (carrusel del inicio) ══════════ */
  var CAMPOS_ANUNCIO = [
    { k: 'imagen', t: 'Imagen', tipo: 'imagen', obligatorio: true },
    { k: 'titulo', t: 'Título (solo para ti y para lectores de pantalla)', max: 80, obligatorio: true },
    { k: 'link', t: 'Link al tocar la imagen (opcional)', tipo: 'url', ph: 'https://wa.me/59169021969' },
    { k: 'desde', t: 'Mostrar desde (opcional)', tipo: 'date' },
    { k: 'hasta', t: 'Mostrar hasta (opcional)', tipo: 'date' },
    { k: 'activo', t: 'Publicado', tipo: 'switch' }
  ];
  function editarAnuncio(it) {
    var nuevo = !it;
    it = it || { id: nuevoId(), activo: true, orden: lista('anuncios').length + 1 };
    recargar().then(function () {
      abrirFormulario(nuevo ? 'Nuevo anuncio' : 'Editar anuncio', CAMPOS_ANUNCIO, it, function (v) {
        if (v.link && !/^https?:\/\//i.test(v.link)) v.link = 'https://' + v.link;
        var l = lista('anuncios'), i = l.findIndex(function (x) { return x.id === v.id; });
        if (i >= 0) l[i] = v; else l.push(v);
        return guardar('anuncios', nuevo ? 'Anuncio creado' : 'Anuncio guardado').then(refrescar);
      });
    });
  }
  P['admin-anuncios'] = function () {
    var l = lista('anuncios').slice().sort(function (a, b) { return (a.orden || 999) - (b.orden || 999); });
    return N.titulo('Anuncios', 'Las imágenes del carrusel del inicio. El orden de esta lista es el orden del carrusel.',
        '<button class="btn" data-adm="nuevo-anuncio">' + ic('mas2') + 'Nuevo anuncio</button>') +
      '<div class="card">' + (l.length ? '<div class="adm-lista">' + l.map(function (a, n) {
        var src = vistaImagen(a);
        return '<article class="adm-item">' +
          '<div class="adm-mini">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : '<span>Publicando…</span>') + '</div>' +
          '<div class="adm-info"><b>' + esc(a.titulo || 'Sin título') + '</b>' +
            '<div class="adm-meta">' + estadoItem(a) + (!a.imagen ? '<span class="chip pend">Imagen en camino (~15 min)</span>' : '') + '<span>' + vigencia(a) + '</span>' + (a.link ? '<span>Link: ' + esc(a.link.replace(/^https?:\/\//, '').slice(0, 40)) + '</span>' : '') + '</div></div>' +
          '<div class="adm-acc">' +
            '<button class="icono" title="Subir" aria-label="Subir" data-adm="subir-anuncio" data-id="' + a.id + '"' + (n === 0 ? ' disabled' : '') + '>' + ic('arriba') + '</button>' +
            '<button class="icono" title="Bajar" aria-label="Bajar" data-adm="bajar-anuncio" data-id="' + a.id + '"' + (n === l.length - 1 ? ' disabled' : '') + '>' + ic('abajo') + '</button>' +
            '<button class="icono" title="' + (a.activo === false ? 'Publicar' : 'Apagar') + '" aria-label="Publicar o apagar" data-adm="alternar-anuncio" data-id="' + a.id + '">' + ic('ojo') + '</button>' +
            '<button class="icono" title="Editar" aria-label="Editar" data-adm="editar-anuncio" data-id="' + a.id + '">' + ic('editar') + '</button>' +
            '<button class="icono peligro" title="Borrar" aria-label="Borrar" data-adm="borrar-anuncio" data-id="' + a.id + '">' + ic('borrar') + '</button>' +
          '</div></article>';
      }).join('') + '</div>' : N.vacio('Todavía no hay anuncios', 'Crea el primero con "Nuevo anuncio".')) + '</div>';
  };

  /* ══════════ AVISOS (ventanas emergentes) ══════════ */
  var CAMPOS_AVISO = [
    { k: 'titulo', t: 'Título', max: 120, obligatorio: true, ph: 'COMUNICADO OFICIAL - FACTURACIÓN SEMANA 42' },
    { k: 'mensaje', t: 'Mensaje', tipo: 'textarea', filas: 7, max: 2500, ayuda: 'Para <b>negrita</b> escribe **así**. Deja una línea en blanco para empezar otro párrafo. Para una lista, empieza cada línea con "- ".' },
    { k: 'tipo', t: 'Tipo', tipo: 'select', opciones: TIPOS, ayuda: 'Urgente obliga a presionar "Entendido".' },
    { k: 'frecuencia', t: 'Cuántas veces se muestra', tipo: 'select', opciones: FRECUENCIAS },
    { k: 'paraQuien', t: 'Para quién', tipo: 'select', opciones: PARA },
    { k: 'ids', t: 'IDs de Yango', tipo: 'textarea', filas: 2, ayuda: 'Separados por coma. Ejemplo: 27391057, 31827409', si: function (v) { return v.paraQuien === 'IDS'; }, obligatorio: true },
    { k: 'imagen', t: 'Imagen (opcional)', tipo: 'imagen' },
    { k: 'botonTexto', t: 'Texto del botón (opcional)', max: 40, ph: 'Escribir por WhatsApp' },
    { k: 'botonLink', t: 'Link del botón (opcional)', tipo: 'url', ph: 'https://wa.me/59169021969' },
    { k: 'desde', t: 'Mostrar desde (opcional)', tipo: 'date' },
    { k: 'hasta', t: 'Mostrar hasta (opcional)', tipo: 'date' },
    { k: 'activo', t: 'Publicado', tipo: 'switch' }
  ];
  function previaDe(v) {
    N.previaAviso({ titulo: v.titulo, mensaje: v.mensaje, tipo: v.tipo, frecuencia: 'CADA INGRESO', imagen: vistaImagen(v), botonTexto: v.botonTexto, botonLink: v.botonLink });
  }
  function editarAviso(it, copiar) {
    var nuevo = !it || copiar;
    it = it ? Object.assign({}, it) : { tipo: 'INFO', frecuencia: 'UNA VEZ', paraQuien: 'TODOS', activo: true };
    if (nuevo) { it.id = nuevoId(); it.codigo = nuevoId(); if (copiar) { it.titulo = 'Copia de ' + it.titulo; it.activo = false; } }
    var campos = CAMPOS_AVISO.slice();
    if (!nuevo) campos.push({ k: 'repetir', t: 'Volver a mostrarlo a quienes ya lo leyeron', tipo: 'switch' });
    if (!nuevo) it.repetir = false;
    recargar().then(function () {
      abrirFormulario(nuevo ? 'Nuevo aviso' : 'Editar aviso', campos, it, function (v) {
        if (v.botonLink && !/^https?:\/\//i.test(v.botonLink)) v.botonLink = 'https://' + v.botonLink;
        if (v.botonLink && !v.botonTexto) v.botonTexto = 'Ver más';
        if (v.paraQuien !== 'IDS') v.ids = '';
        if (v.repetir) { v.codigo = nuevoId(); delete lecturasCache[it.codigo]; }
        delete v.repetir;
        var l = lista('avisos'), i = l.findIndex(function (x) { return x.id === v.id; });
        if (i >= 0) l[i] = v; else l.unshift(v);
        return guardar('avisos', nuevo ? 'Aviso creado' : 'Aviso guardado').then(refrescar);
      }, { t: ic('ojo') + 'Vista previa', fn: previaDe });
    });
  }
  function contarLecturas(codigo, el) {
    if (N.DEMO) { el.textContent = 'Leído por 0 (demostración)'; return; }
    el.textContent = 'Contando…';
    var q = N.db().collectionGroup('lecturas').where('codigo', '==', codigo);
    var pedir = q.count ? q.count().get().then(function (r) { return r.data().count; }) : q.get().then(function (r) { return r.size; });
    pedir.then(function (n) { lecturasCache[codigo] = n; el.textContent = 'Leído por ' + n + (n === 1 ? ' repartidor' : ' repartidores'); },
      function (e) { console.error(e); el.textContent = 'No se pudo contar'; });
  }
  function descargarLecturas(a) {
    N.aviso('Preparando la lista…');
    N.db().collectionGroup('lecturas').where('codigo', '==', a.codigo).get().then(function (r) {
      var filas = [['Fecha', 'ID Yango', 'Nombre', 'Aviso']];
      r.forEach(function (d) { var x = d.data(); filas.push([x.fecha && x.fecha.toDate ? x.fecha.toDate().toLocaleString('es-BO') : '', x.id || '', x.nombre || '', x.titulo || '']); });
      bajarCSV(filas, 'lecturas-' + (a.titulo || 'aviso').slice(0, 30));
    }, function () { N.aviso('No se pudo descargar.'); });
  }
  P['admin-avisos'] = function () {
    var l = lista('avisos');
    return N.titulo('Avisos', 'Las ventanas que aparecen al entrar al portal. Los cambios se ven al instante.',
        '<button class="btn" data-adm="nuevo-aviso">' + ic('mas2') + 'Nuevo aviso</button>') +
      '<div class="card">' + (l.length ? '<div class="adm-lista">' + l.map(function (a) {
        var lect = lecturasCache[a.codigo];
        return '<article class="adm-item aviso-' + (a.tipo || 'INFO') + '">' +
          '<div class="adm-tipo">' + ic(a.tipo === 'INFO' ? 'info' : 'alerta') + '</div>' +
          '<div class="adm-info"><b>' + esc(a.titulo || 'Sin título') + '</b>' +
            '<p class="adm-extracto">' + esc(String(a.mensaje || '').replace(/\*\*/g, '').slice(0, 160)) + (String(a.mensaje || '').length > 160 ? '…' : '') + '</p>' +
            '<div class="adm-meta">' + estadoItem(a) + '<span>' + esc(nombreDe(TIPOS, a.tipo)) + '</span><span>' + esc(nombreDe(FRECUENCIAS, a.frecuencia)) + '</span>' +
              '<span>Para: ' + esc(a.paraQuien === 'IDS' ? (String(a.ids || '').split(/[,;\s]+/).filter(Boolean).length + ' IDs') : nombreDe(PARA, a.paraQuien)) + '</span><span>' + vigencia(a) + '</span>' +
              (a.frecuencia !== 'CADA INGRESO' ? '<button class="enlace" data-adm="contar" data-id="' + a.id + '">' + (lect == null ? 'Ver cuántos lo leyeron' : 'Leído por ' + lect) + '</button>' : '') +
            '</div></div>' +
          '<div class="adm-acc">' +
            '<button class="icono" title="Vista previa" aria-label="Vista previa" data-adm="previa-aviso" data-id="' + a.id + '">' + ic('ojo') + '</button>' +
            '<button class="icono" title="Editar" aria-label="Editar" data-adm="editar-aviso" data-id="' + a.id + '">' + ic('editar') + '</button>' +
            '<button class="icono" title="Duplicar" aria-label="Duplicar" data-adm="copiar-aviso" data-id="' + a.id + '">' + ic('copiar') + '</button>' +
            (a.frecuencia !== 'CADA INGRESO' ? '<button class="icono" title="Descargar quién lo leyó" aria-label="Descargar lecturas" data-adm="bajar-lecturas" data-id="' + a.id + '">' + ic('descargar') + '</button>' : '') +
            '<button class="icono peligro" title="Borrar" aria-label="Borrar" data-adm="borrar-aviso" data-id="' + a.id + '">' + ic('borrar') + '</button>' +
          '</div></article>';
      }).join('') + '</div>' : N.vacio('Todavía no hay avisos', 'Crea el primero con "Nuevo aviso".')) + '</div>';
  };

  /* ══════════ PREGUNTAS FRECUENTES ══════════ */
  function camposPregunta() {
    var cats = []; lista('preguntas').forEach(function (q) { if (q.categoria && cats.indexOf(q.categoria) < 0) cats.push(q.categoria); });
    return [
      { k: 'categoria', t: 'Categoría', max: 40, obligatorio: true, ayuda: cats.length ? 'Usa una existente para agruparlas: ' + cats.map(esc).join(', ') : '' },
      { k: 'p', t: 'Pregunta', max: 200, obligatorio: true },
      { k: 'r', t: 'Respuesta', tipo: 'textarea', filas: 5, max: 1500, obligatorio: true, ayuda: 'El asistente con IA también usa estas respuestas.' },
      { k: 'activo', t: 'Publicada', tipo: 'switch' }
    ];
  }
  function editarPregunta(it) {
    var nuevo = !it;
    it = it || { id: nuevoId(), activo: true, categoria: '', orden: 999 };
    recargar().then(function () {
      abrirFormulario(nuevo ? 'Nueva pregunta' : 'Editar pregunta', camposPregunta(), it, function (v) {
        var l = lista('preguntas'), i = l.findIndex(function (x) { return x.id === v.id; });
        if (nuevo) v.orden = l.filter(function (x) { return x.categoria === v.categoria; }).length + 1;
        if (i >= 0) l[i] = v; else l.push(v);
        return guardar('preguntas', nuevo ? 'Pregunta creada' : 'Pregunta guardada').then(refrescar);
      });
    });
  }
  function moverPregunta(id, paso) {
    var l = lista('preguntas'), q = l.filter(function (x) { return x.id === id; })[0];
    if (!q) return;
    var grupo = l.filter(function (x) { return x.categoria === q.categoria; }).sort(function (a, b) { return (a.orden || 999) - (b.orden || 999); });
    var i = grupo.indexOf(q), j = i + paso;
    if (j < 0 || j >= grupo.length) return;
    grupo.splice(i, 1); grupo.splice(j, 0, q);
    grupo.forEach(function (x, n) { x.orden = n + 1; });
    guardar('preguntas', 'Orden actualizado').then(refrescar);
  }
  P['admin-preguntas'] = function () {
    var cats = [], por = {};
    lista('preguntas').forEach(function (q) { var c = q.categoria || 'General'; if (!por[c]) { por[c] = []; cats.push(c); } por[c].push(q); });
    return N.titulo('Preguntas frecuentes', 'Lo que ven los repartidores en "Preguntas". El asistente con IA también las usa para responder.',
        '<button class="btn" data-adm="nueva-pregunta">' + ic('mas2') + 'Nueva pregunta</button>') +
      (cats.length ? cats.map(function (c) {
        var g = por[c].sort(function (a, b) { return (a.orden || 999) - (b.orden || 999); });
        return '<div class="card"><div class="h2">' + esc(c) + ' <small>' + g.length + '</small></div><div class="adm-lista">' + g.map(function (q, n) {
          return '<article class="adm-item"><div class="adm-info"><b>' + esc(q.p) + '</b><p class="adm-extracto">' + esc(String(q.r || '').slice(0, 220)) + '</p>' +
            '<div class="adm-meta">' + estadoItem(q) + '</div></div><div class="adm-acc">' +
            '<button class="icono" aria-label="Subir" title="Subir" data-adm="subir-pregunta" data-id="' + q.id + '"' + (n === 0 ? ' disabled' : '') + '>' + ic('arriba') + '</button>' +
            '<button class="icono" aria-label="Bajar" title="Bajar" data-adm="bajar-pregunta" data-id="' + q.id + '"' + (n === g.length - 1 ? ' disabled' : '') + '>' + ic('abajo') + '</button>' +
            '<button class="icono" aria-label="Publicar o apagar" title="' + (q.activo === false ? 'Publicar' : 'Apagar') + '" data-adm="alternar-pregunta" data-id="' + q.id + '">' + ic('ojo') + '</button>' +
            '<button class="icono" aria-label="Editar" title="Editar" data-adm="editar-pregunta" data-id="' + q.id + '">' + ic('editar') + '</button>' +
            '<button class="icono peligro" aria-label="Borrar" title="Borrar" data-adm="borrar-pregunta" data-id="' + q.id + '">' + ic('borrar') + '</button>' +
            '</div></article>';
        }).join('') + '</div></div>';
      }).join('') : '<div class="card">' + N.vacio('Todavía no hay preguntas', 'Crea la primera con "Nueva pregunta".') + '</div>');
  };

  /* ══════════ CHATS Y LECTURAS ══════════ */
  function bajarCSV(filas, nombre) {
    var csv = '﻿' + filas.map(function (f) { return f.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = nombre.replace(/[^\w\-]+/g, '-') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function cargarRegistros() {
    if (N.DEMO) {
      registros.chats = [{ fecha: new Date(), id: '27391057', nombre: 'JUAN CARLOS PÉREZ', pregunta: '¿Cuánto tengo por cobrar?', respuesta: 'Tienes 3 semanas pendientes por Bs 1.245,50.', tokens: 820 }];
      registros.archivoChats = [{ fecha: '23/9/2026 1:36:14', id: '31827409', nombre: 'Naval Arias Erick Richard', pregunta: '¿A qué número mando mi factura?', respuesta: 'Al WhatsApp 75854243.', tokens: 1307 }];
      registros.archivoLecturas = [{ fecha: '22/9/2026 12:00:06', id: '66314299', nombre: 'Rodriguez Robles Cristhian', titulo: 'Bienvenido al portal de CONTAX' }];
      return Promise.resolve();
    }
    var db = N.db();
    return Promise.all([
      db.collection('chats').orderBy('fecha', 'desc').limit(300).get(),
      db.collection('archivo').get()
    ]).then(function (r) {
      registros.chats = []; r[0].forEach(function (d) { var x = d.data(); x.fecha = x.fecha && x.fecha.toDate ? x.fecha.toDate() : null; registros.chats.push(x); });
      registros.archivoChats = []; registros.archivoLecturas = [];
      r[1].forEach(function (d) { var x = d.data(); (x.tipo === 'chats' ? registros.archivoChats : registros.archivoLecturas).push.apply(x.tipo === 'chats' ? registros.archivoChats : registros.archivoLecturas, x.filas || []); });
      registros.archivoChats.reverse(); registros.archivoLecturas.reverse();
    });
  }
  function textoFecha(f) { return f instanceof Date ? f.toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : String(f || ''); }
  function filtrar(l) {
    var q = registros.buscar.toLowerCase();
    return !q ? l : l.filter(function (x) { return [x.id, x.nombre, x.pregunta, x.respuesta, x.titulo].join(' ').toLowerCase().indexOf(q) >= 0; });
  }
  P['admin-registros'] = function () {
    var v = registros.vista;
    var pest = [['chats', 'Chats del asistente'], ['archivoChats', 'Chats anteriores (ChatLog)'], ['archivoLecturas', 'Lecturas anteriores (AvisosLeidos)']];
    var cab = N.titulo('Chats y lecturas', 'Lo que los repartidores le preguntan al asistente y quién leyó los avisos antiguos.',
        '<button class="btn sec" data-adm="bajar-registros">' + ic('descargar') + 'Descargar Excel (CSV)</button>') +
      '<div class="segmento">' + pest.map(function (p) { return '<button class="' + (v === p[0] ? 'on' : '') + '" data-adm="vista" data-id="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>';
    if (!registros[v]) return cab + '<div class="card">' + N.vacio('Cargando…') + '</div>';
    var l = filtrar(registros[v]);
    var cuerpo = v === 'archivoLecturas'
      ? '<div class="tabla-caja tabla-movil"><table><thead><tr><th>Fecha</th><th>ID</th><th>Nombre</th><th>Aviso</th></tr></thead><tbody>' +
        l.slice(0, 300).map(function (x) { return '<tr><td data-et="Fecha">' + esc(textoFecha(x.fecha)) + '</td><td data-et="ID" class="num">' + esc(x.id) + '</td><td data-et="Nombre">' + esc(x.nombre) + '</td><td data-et="Aviso">' + esc(x.titulo) + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<div class="chat-registro">' + l.slice(0, 300).map(function (x) {
          return '<article><div class="cr-cab"><b>' + esc(x.nombre || '') + '</b><span class="num">ID ' + esc(x.id || '') + '</span><span>' + esc(textoFecha(x.fecha)) + '</span></div>' +
            '<p class="cr-p">' + esc(x.pregunta) + '</p><p class="cr-r">' + esc(x.respuesta) + '</p></article>';
        }).join('') + '</div>';
    return cab + '<div class="card"><div class="buscar">' + ic('buscar') + '<input id="buscarReg" type="search" placeholder="Buscar por ID, nombre o texto" value="' + esc(registros.buscar) + '"></div>' +
      '<p class="muted" style="margin:10px 0 12px">' + l.length + ' registro' + (l.length === 1 ? '' : 's') + (l.length > 300 ? ' (se muestran los 300 más recientes; el Excel trae todos)' : '') + '</p>' +
      (l.length ? cuerpo : N.vacio('No hay registros', registros.buscar ? 'Prueba con otra búsqueda.' : '')) + '</div>';
  };
  D['admin-registros'] = function () {
    var inp = document.getElementById('buscarReg');
    if (inp) {
      var t = null;
      inp.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { registros.buscar = inp.value; var pos = inp.selectionStart; refrescar(); var n = document.getElementById('buscarReg'); n.focus(); n.setSelectionRange(pos, pos); }, 250);
      });
    }
    if (!registros.chats) cargarRegistros().then(refrescar, function (e) { console.error(e); N.aviso('No se pudieron cargar los registros.'); });
  };

  /* ══════════ CLICS DEL PANEL ══════════ */
  function buscar(k, id) { return lista(k).filter(function (x) { return x.id === id; })[0]; }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-adm]');
    if (!b) return;
    e.preventDefault();
    var acc = b.getAttribute('data-adm'), id = b.getAttribute('data-id');
    switch (acc) {
      case 'nuevo-anuncio': editarAnuncio(); break;
      case 'editar-anuncio': editarAnuncio(buscar('anuncios', id)); break;
      case 'subir-anuncio': mover('anuncios', id, -1); break;
      case 'bajar-anuncio': mover('anuncios', id, 1); break;
      case 'alternar-anuncio': var a = buscar('anuncios', id); a.activo = a.activo === false; guardar('anuncios', a.activo ? 'Anuncio publicado' : 'Anuncio apagado').then(refrescar); break;
      case 'borrar-anuncio': confirmar('¿Borrar este anuncio?', function () { contenido().anuncios = lista('anuncios').filter(function (x) { return x.id !== id; }); guardar('anuncios', 'Anuncio borrado').then(refrescar); }); break;
      case 'nuevo-aviso': editarAviso(); break;
      case 'editar-aviso': editarAviso(buscar('avisos', id)); break;
      case 'copiar-aviso': editarAviso(buscar('avisos', id), true); break;
      case 'previa-aviso': previaDe(buscar('avisos', id)); break;
      case 'contar': contarLecturas(buscar('avisos', id).codigo, b); break;
      case 'bajar-lecturas': descargarLecturas(buscar('avisos', id)); break;
      case 'borrar-aviso': confirmar('¿Borrar este aviso?', function () { contenido().avisos = lista('avisos').filter(function (x) { return x.id !== id; }); guardar('avisos', 'Aviso borrado').then(refrescar); }); break;
      case 'nueva-pregunta': editarPregunta(); break;
      case 'editar-pregunta': editarPregunta(buscar('preguntas', id)); break;
      case 'subir-pregunta': moverPregunta(id, -1); break;
      case 'bajar-pregunta': moverPregunta(id, 1); break;
      case 'alternar-pregunta': var q = buscar('preguntas', id); q.activo = q.activo === false; guardar('preguntas', q.activo ? 'Pregunta publicada' : 'Pregunta apagada').then(refrescar); break;
      case 'borrar-pregunta': confirmar('¿Borrar esta pregunta?', function () { contenido().preguntas = lista('preguntas').filter(function (x) { return x.id !== id; }); guardar('preguntas', 'Pregunta borrada').then(refrescar); }); break;
      case 'vista': registros.vista = id; refrescar(); break;
      case 'bajar-registros':
        var v = registros.vista, l = filtrar(registros[v] || []);
        if (v === 'archivoLecturas') bajarCSV([['Fecha', 'ID Yango', 'Nombre', 'Aviso']].concat(l.map(function (x) { return [textoFecha(x.fecha), x.id, x.nombre, x.titulo]; })), 'lecturas-anteriores');
        else bajarCSV([['Fecha', 'ID Yango', 'Nombre', 'Pregunta', 'Respuesta', 'Tokens']].concat(l.map(function (x) { return [textoFecha(x.fecha), x.id, x.nombre, x.pregunta, x.respuesta, x.tokens]; })), v === 'chats' ? 'chats-asistente' : 'chats-anteriores');
        break;
    }
  });

  window.NM_ADMIN = true;
})();
