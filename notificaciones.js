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
    var ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var instalado = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    var soporta = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    return { ios: ios, instalado: instalado, soporta: soporta };
  }
  /* estado: activas | bloqueadas | instalar-iphone | sin-soporte | disponible */
  function estado() {
    var d = dispositivo();
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

  function activar(btn) {
    if (N.DEMO) { N.aviso('Demostración: aquí se activarían las notificaciones.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Activando…'; }
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error('permiso');
      return obtenerToken();
    }).then(function (t) {
      if (!t) throw new Error('token');
      return guardarToken(t).then(function () {
        guardar('nm_notif_ok', uid()); guardar('nm_notif_fecha', String(Date.now()));
        N.aviso('Listo: te avisaremos en este celular.');
        if (S.pagina === 'notificaciones' || S.pagina === 'inicio') N.ir(S.pagina, true);
      });
    }).catch(function (e) {
      console.warn(e);
      if (btn) { btn.disabled = false; btn.textContent = 'Activar notificaciones'; }
      N.aviso(e && e.message === 'permiso' ? 'No diste permiso. Puedes activarlo más tarde desde "Notificaciones".' : 'No se pudieron activar. Intenta de nuevo.');
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
    if (e === 'activas' || e === 'sin-soporte' || e === 'bloqueadas') return '';
    return '<div class="notif-card"><div class="notif-ic">' + ic('campana') + '</div><div class="notif-txt"><b>Entérate al instante</b>' +
      (e === 'instalar-iphone'
        ? 'En iPhone, primero instala el portal en tu pantalla de inicio y ábrelo desde ese ícono. Ahí podrás activar los avisos.'
        : 'Te avisamos en tu celular cuando se cargue tu semana, cuando recibas un pago o cuando respondan tu trámite.') +
      '</div><div class="notif-acc">' +
      (e === 'instalar-iphone' ? '<button class="btn chico" data-ir="notificaciones">Ver cómo</button>' : '<button class="btn chico" data-notif="activar">Activar</button>') +
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
      '<li>Entra con tus datos, ve a <b>Más → Notificaciones</b> y toca <b>Activar notificaciones</b>.</li></ol>';
    else if (e === 'bloqueadas') cuerpo = '<div class="aviso error">' + ic('alerta') + '<div><b>Las notificaciones están bloqueadas</b>' +
      (d.ios ? 'Ve a <b>Ajustes → Notificaciones → Portal CONTAX</b> y activa "Permitir notificaciones".' : 'Toca el candado junto a la dirección del portal → <b>Permisos</b> → <b>Notificaciones</b> → Permitir. Después vuelve aquí.') + '</div></div>';
    else if (e === 'sin-soporte') cuerpo = '<div class="aviso alerta">' + ic('info') + '<div><b>Este navegador no permite notificaciones</b>Abre el portal en <b>Chrome</b> (Android) o instálalo en la pantalla de inicio (iPhone).</div></div>';
    else cuerpo = '<p style="margin-bottom:14px">Solo tienes que permitirlas una vez en este celular.</p><button class="btn" data-notif="activar">' + ic('campana') + 'Activar notificaciones</button>' +
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
