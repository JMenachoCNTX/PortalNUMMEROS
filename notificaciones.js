/* ══════════════════════════════════════════════════════════
   NOTIFICACIONES AL CELULAR · Portal CONTAX
   El repartidor las activa una vez. El robot de sincronización le avisa
   cuando se carga una semana nueva, cuando recibe un pago o cuando cambia
   un trámite. El administrador también puede enviar avisos.
   En iPhone solo funcionan si el portal está instalado en la pantalla de inicio.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var N = window.NM, S = N.S, C = N.C, esc = N.esc, ic = N.ic;
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js';

  function dispositivo() {
    var ua = navigator.userAgent || '';
    var ios = /iphone|ipad|ipod/i.test(ua) || /iP(hone|ad|od)/.test(navigator.platform || '') || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var instalado = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    var soporta = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    return { ios: ios, android: /android/i.test(ua), instalado: instalado, soporta: soporta, seguro: window.isSecureContext !== false };
  }
  /* estado: pronto | activas | bloqueadas | instalar-iphone | sin-soporte | disponible */
  function estado() {
    var d = dispositivo();
    if (!d.seguro) return 'pronto';   // el portal todavía abre sin candado (https)
    if (d.ios && !d.instalado) return 'instalar-iphone';
    if (!d.soporta) return 'sin-soporte';
    if (Notification.permission === 'denied') return 'bloqueadas';
    if (Notification.permission === 'granted' && leer('nm_notif_ok') === uid()) return 'activas';
    return 'disponible';
  }
  function uid() { return S.usuario ? S.usuario.uid : 'demo'; }
  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var cargado = null;
  function cargarSDK() {
    if (!cargado) cargado = new Promise(function (ok, mal) {
      if (firebase.messaging) return ok();
      var s = document.createElement('script'); s.src = SDK; s.onload = ok; s.onerror = function () { mal(new Error('sdk')); };
      document.head.appendChild(s);
    });
    return cargado;
  }

  function obtenerToken() {
    return cargarSDK().then(function () {
      return navigator.serviceWorker.register('firebase-messaging-sw.js');
    }).then(function (reg) {
      var m = firebase.messaging();
      m.onMessage(function (p) {
        var n = p.notification || {};
        N.aviso((n.title ? n.title + ': ' : '') + (n.body || ''));
      });
      return m.getToken({ serviceWorkerRegistration: reg });
    });
  }
  function guardarToken(token) {
    var d = dispositivo();
    return N.db().collection('notificaciones').doc(S.usuario.uid).set({
      tokens: [token], plataforma: d.ios ? 'iphone' : (/android/i.test(navigator.userAgent) ? 'android' : 'otro'),
      actualizado: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  /* ── Ventana con pasos claros ── */
  function ventana(titulo, html, botones) {
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<div class="modal-caja" role="dialog" aria-modal="true"><div class="modal-cab"><div class="nm-patron oscuro" aria-hidden="true"></div>' +
      '<div class="modal-fila"><img class="iso" src="marca/logos/nummeros-isotipo-blanco.svg" alt=""><span class="modal-chip">' + ic('campana') + 'Notificaciones</span>' +
      '<button class="modal-x" aria-label="Cerrar" data-x>×</button></div><h3>' + titulo + '</h3></div>' +
      '<div class="modal-cuerpo">' + html + '</div><div class="modal-pie">' +
      (botones || [{ t: 'Entendido' }]).map(function (b, i) { return '<button class="btn' + (b.sec ? ' sec' : '') + '" data-b="' + i + '">' + b.t + '</button>'; }).join('') + '</div></div>';
    document.body.appendChild(m);
    function cerrar() { m.remove(); }
    m.querySelector('[data-x]').onclick = cerrar;
    m.addEventListener('click', function (e) { if (e.target === m) cerrar(); });
    (botones || [{ t: 'Entendido' }]).forEach(function (b, i) { m.querySelector('[data-b="' + i + '"]').onclick = function () { cerrar(); if (b.fn) b.fn(); }; });
  }
  function pasos(l) { return '<ol class="pasos">' + l.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>'; }
  function guiaInstalarIphone() {
    ventana('Primero instala el portal', '<p>En iPhone, Apple solo deja recibir avisos si el portal está en tu pantalla de inicio. Es una sola vez:</p>' + pasos([
      'Toca el botón <b>Compartir</b> de Safari (el cuadrado con una flecha hacia arriba, abajo de la pantalla).',
      'Baja y elige <b>Agregar a pantalla de inicio</b>. Si aparece "Abrir como app web", déjalo <b>activado</b>.',
      'Toca <b>Agregar</b>.',
      'Cierra Safari y abre el portal <b>desde el ícono verde de NUMMEROS</b> en tu pantalla.',
      'Entra con tus datos y toca <b>Activar avisos</b>.'
    ]));
  }
  function guiaDesbloquear() {
    var d = dispositivo();
    var l = d.ios
      ? ['Abre la app <b>Ajustes</b> de tu iPhone.', 'Entra a <b>Notificaciones</b>.', 'Busca <b>Portal CONTAX</b> y tócalo.', 'Activa <b>Permitir notificaciones</b>.', 'Vuelve al portal y toca <b>Activar avisos</b> otra vez.']
      : ['Arriba, junto a la dirección del portal, toca el ícono de <b>ajustes</b> o el <b>candado</b>.', 'Toca <b>Permisos</b> o <b>Configuración del sitio</b>.', 'Busca <b>Notificaciones</b> y elige <b>Permitir</b>.', 'Recarga el portal y toca <b>Activar avisos</b> otra vez.'];
    ventana('Los avisos están bloqueados', '<p>Antes dijiste <b>"No permitir"</b>, por eso tu celular ya no pregunta. Puedes cambiarlo así:</p>' + pasos(l));
  }

  function activar(btn) {
    var e = estado();
    if (e === 'instalar-iphone') return guiaInstalarIphone();
    if (e === 'bloqueadas') return guiaDesbloquear();
    if (e === 'sin-soporte') return ventana('Tu navegador no permite avisos', '<p>Abre el portal en <b>Google Chrome</b> (Android) o instálalo en tu pantalla de inicio (iPhone) y vuelve a intentar.</p>');
    if (e === 'pronto') return ventana('Muy pronto', '<p>Estamos terminando de activar la conexión segura del portal. En unas horas podrás activar los avisos desde aquí.</p>');
    // Antes de que el celular pregunte, le explicamos qué tocar
    ventana('Tu celular te va a preguntar', '<p>En el siguiente mensaje toca <b>"Permitir"</b>. Así te avisamos cuando se cargue tu semana, cuando recibas un pago o cuando respondan tu trámite.</p>' +
      '<div class="notif-demo"><span>portalnummeros.contaxbolivia.com quiere enviarte notificaciones</span><div><i>Bloquear</i><b>Permitir</b></div></div>',
      [{ t: 'Ahora no', sec: true }, { t: 'Continuar', fn: function () { pedirPermiso(btn); } }]);
  }

  function pedirPermiso(btn) {
    if (N.DEMO) { N.aviso('Demostración: aquí se activarían las notificaciones.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Activando…'; }
    Notification.requestPermission().then(function (p) {
      if (p === 'denied') throw new Error('denegado');
      if (p !== 'granted') throw new Error('sin-respuesta');
      return obtenerToken();
    }).then(function (t) {
      if (!t) throw new Error('token');
      return guardarToken(t).then(function () {
        guardar('nm_notif_ok', uid()); guardar('nm_notif_fecha', String(Date.now()));
        ventana('¡Listo!', '<p>Los avisos quedaron activados en este celular. Te escribiremos cuando haya novedades de tus pagos o trámites.</p>');
        if (S.pagina === 'notificaciones' || S.pagina === 'inicio') N.ir(S.pagina, true);
      });
    }).catch(function (e) {
      console.warn(e);
      if (btn) { btn.disabled = false; btn.textContent = 'Activar avisos'; }
      var m = e && e.message;
      if (m === 'denegado') guiaDesbloquear();
      else if (m === 'sin-respuesta') ventana('No elegiste ninguna opción', '<p>El mensaje se cerró sin respuesta. Toca <b>Activar avisos</b> otra vez y luego <b>"Permitir"</b>.</p>');
      else if (dispositivo().ios && !dispositivo().instalado) guiaInstalarIphone();
      else ventana('No se pudieron activar', '<p>Revisa tu conexión a internet e intenta de nuevo en un momento.</p>');
      if (S.pagina === 'notificaciones') N.ir('notificaciones', true);
    });
  }

  /* Renueva el token una vez al día (Google lo cambia de vez en cuando) */
  function renovar() {
    if (N.DEMO || S.admin || estado() !== 'activas') return;
    if (Date.now() - Number(leer('nm_notif_fecha') || 0) < 864e5) { obtenerToken().catch(function () {}); return; }
    obtenerToken().then(function (t) { if (t) return guardarToken(t).then(function () { guardar('nm_notif_fecha', String(Date.now())); }); }).catch(function () {});
  }

  /* ── Tarjeta del inicio ── */
  function tarjeta() {
    if (S.admin || leer('nm_notif_cerrada') === '1') return '';
    var e = estado();
    if (e === 'activas' || e === 'sin-soporte' || e === 'pronto') return '';
    return '<div class="notif-card"><div class="notif-ic">' + ic('campana') + '</div><div class="notif-txt"><b>Entérate al instante</b>' +
      (e === 'instalar-iphone' ? 'Recibe un aviso cuando se cargue tu semana o recibas un pago. En iPhone primero hay que instalar el portal: te mostramos cómo.'
        : e === 'bloqueadas' ? 'Los avisos están bloqueados en este celular. Te mostramos cómo activarlos.'
        : 'Te avisamos en tu celular cuando se cargue tu semana, cuando recibas un pago o cuando respondan tu trámite.') +
      '</div><div class="notif-acc">' +
      '<button class="btn chico" data-notif="activar">' + (e === 'disponible' ? 'Activar avisos' : 'Ver cómo') + '</button>' +
      '<button class="btn sec chico" data-notif="cerrar">Ahora no</button></div></div>';
  }

  /* ── Página "Notificaciones" ── */
  N.PAGINAS.notificaciones = function () {
    var e = estado(), d = dispositivo();
    var cab = N.titulo('Notificaciones', 'Avisos en tu celular, aunque el portal esté cerrado.');
    var que = '<div class="card"><div class="h2">Qué te vamos a avisar</div><ul class="reglas">' +
      '<li>' + ic('pendientes') + '<span>Cuando se <b>cargue una semana nueva</b> por cobrar.</span></li>' +
      '<li>' + ic('historial') + '<span>Cuando <b>recibas un pago</b>.</span></li>' +
      '<li>' + ic('tramites') + '<span>Cuando <b>cambie el estado de un trámite</b>.</span></li>' +
      '<li>' + ic('megafono') + '<span><b>Avisos importantes</b> de CONTAX.</span></li></ul></div>';
    var cuerpo;
    if (e === 'activas') cuerpo = '<div class="aviso">' + ic('campana') + '<div><b>Notificaciones activas en este celular</b>Te avisaremos aquí. Si cambias de celular, actívalas de nuevo en el otro.</div></div>' +
      '<button class="btn sec chico" data-notif="probar">Volver a activar</button>';
    else if (e === 'instalar-iphone') cuerpo = '<div class="aviso alerta">' + ic('instalar') + '<div><b>En iPhone hay que instalar el portal primero</b>Apple solo permite notificaciones si el portal está en tu pantalla de inicio (iOS 16.4 o más nuevo).</div></div>' +
      '<ol class="pasos"><li>Abre este portal en <b>Safari</b>.</li><li>Toca <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li>' +
      '<li>Elige <b>Agregar a pantalla de inicio</b> y toca <b>Agregar</b>.</li><li>Cierra Safari y abre el portal <b>desde el ícono nuevo</b>.</li>' +
      '<li>Entra con tus datos, ve a <b>Más → Notificaciones</b> y toca <b>Activar avisos</b>.</li></ol>';
    else if (e === 'bloqueadas') cuerpo = '<div class="aviso error">' + ic('alerta') + '<div><b>Las notificaciones están bloqueadas</b>' +
      'Antes elegiste "No permitir".</div></div><button class="btn" data-notif="activar">' + ic('campana') + 'Ver cómo activarlas</button>';
    else if (e === 'pronto') cuerpo = '<div class="aviso">' + ic('reloj') + '<div><b>Muy pronto</b>Estamos terminando de activar la conexión segura del portal. En unas horas podrás activar los avisos aquí.</div></div>';
    else if (e === 'sin-soporte') cuerpo = '<div class="aviso alerta">' + ic('info') + '<div><b>Este navegador no permite notificaciones</b>Abre el portal en <b>Chrome</b> (Android) o instálalo en la pantalla de inicio (iPhone).</div></div>';
    else cuerpo = '<p style="margin-bottom:14px">Solo tienes que permitirlas una vez en este celular.</p><button class="btn" data-notif="activar">' + ic('campana') + 'Activar avisos</button>' +
      (d.ios ? '' : '<p class="muted" style="margin-top:10px;font-size:13px">En iPhone: funcionan solo si el portal está instalado en la pantalla de inicio.</p>');
    return cab + '<div class="grid2"><div class="card"><div class="h2">Este celular</div>' + cuerpo + '</div>' + que + '</div>';
  };

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-notif]');
    if (!b) return;
    var a = b.getAttribute('data-notif');
    if (a === 'activar' || a === 'probar') activar(b);
    if (a === 'cerrar') { guardar('nm_notif_cerrada', '1'); var c = b.closest('.notif-card'); if (c) c.remove(); }
  });

  window.NM_NOTIF = { tarjeta: tarjeta, renovar: renovar, estado: estado };
})();
