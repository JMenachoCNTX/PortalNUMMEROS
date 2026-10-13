/* ══════════════════════════════════════════════════════════
   PORTAL CONTAX · NUMMEROS  —  lógica de la página
   Los datos llegan de Firebase (Firestore). Un proceso automático en
   GitHub (carpeta sync/) los copia desde Google Sheets cada 15 minutos.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var C = window.PORTAL || {};
  var DEMO = !C.firebase || /PEGAR/.test(C.firebase.apiKey || '') || /[?&]demo\b/.test(location.search);
  var app = document.getElementById('app');

  var S = {
    datos: null,          // documento del repartidor
    publico: null,        // anuncios, preguntas, formularios, encuesta
    lecturas: {},         // avisos que ya confirmó
    pagina: 'inicio',
    oscuro: leer('nm_oscuro') === '1',
    avisosVistos: false,
    usuario: null,
    carrusel: null,
    grafico: null
  };

  /* ── Íconos de línea (sin emojis, regla de marca) ── */
  var T = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var IC = {
    inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    pendientes: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    historial: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16 9.5"/>',
    resumen: '<path d="M4 20V11M10 20V5M16 20v-8M21 20H3"/>',
    tramites: '<path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z"/><path d="M14 7v2M14 11v2M14 15v2"/>',
    preguntas: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.4M12 17h.01"/>',
    contacto: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    instalar: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
    mas: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    salir: '<path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10"/>',
    luna: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    alerta: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    escudo: '<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    flechaIzq: '<path d="m15 6-6 6 6 6"/>',
    flechaDer: '<path d="m9 6 6 6-6 6"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
    estrella: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    whatsapp: '<path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5 5 16.2a8.5 8.5 0 1 1 15.5-4.6z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2.2-1-1 .9a5 5 0 0 1-2.6-2.6l.9-1-1-2.2z"/>'
  };
  function ic(n) { return '<span class="ic"><svg viewBox="0 0 24 24" ' + T + ' aria-hidden="true">' + (IC[n] || '') + '</svg></span>'; }

  /* ── Ayudantes ── */
  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function esc(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function conEnlaces(t) {
    return esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
  }
  function numero(v) {
    if (typeof v === 'number') return v;
    if (v == null || v === '') return null;
    var t = String(v).replace(/[^\d,.-]/g, '');
    if (t.indexOf(',') >= 0 && t.indexOf('.') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    else if (t.indexOf(',') >= 0) t = t.replace(',', '.');
    var n = parseFloat(t);
    return isNaN(n) ? null : n;
  }
  /* Formato boliviano: Bs 48.250,00 */
  function bs(v) {
    var n = numero(v);
    if (n === null) return '—';
    var neg = n < 0; n = Math.abs(n);
    var p = n.toFixed(2).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + 'Bs ' + p[0] + ',' + p[1];
  }
  function primerNombre(n) {
    var t = String(n || '').trim().toLowerCase().split(/\s+/)[0] || '';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function fechaTexto(f) {
    if (!f) return '';
    var d = f.toDate ? f.toDate() : new Date(f);
    if (isNaN(d)) return '';
    function z(x) { return (x < 10 ? '0' : '') + x; }
    return z(d.getDate()) + '/' + z(d.getMonth() + 1) + ' a las ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  function aviso(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2400);
  }
  function wa(numero, texto) {
    return 'https://wa.me/' + numero + (texto ? '?text=' + encodeURIComponent(texto) : '');
  }
  function telVisible(n) { return String(n).replace(/^591/, ''); }

  /* Debe ser igual a sync/sincronizar.mjs */
  function limpiarCelular(c) {
    c = String(c || '').replace(/\D/g, '');
    if (c.length === 8) c = '591' + c;
    return c;
  }
  function idSeguro(id) { return String(id || '').trim().replace(/[^a-zA-Z0-9._-]/g, '_'); }
  function correoDe(id) { return idSeguro(id).toLowerCase() + '@' + C.dominioUsuarios; }
  function claveDe(cel, id) { return 'NM-' + cel + '-' + String(id || '').trim(); }

  /* Reemplaza IDYANGO, NOMBRE y CELULAR en los links de formularios */
  function prellenar(url) {
    var d = S.datos || {};
    return String(url || '')
      .replace(/IDYANGO/g, encodeURIComponent(d.id || ''))
      .replace(/NOMBRE/g, encodeURIComponent(d.nombre || ''))
      .replace(/CELULAR/g, encodeURIComponent(d.celular || ''));
  }

  function aplicarTema() {
    document.body.classList.toggle('dark-mode', S.oscuro);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', S.oscuro ? '#051F20' : '#F4FAF5');
  }

  /* ══════════ FIREBASE ══════════ */
  var auth = null, db = null;
  if (!DEMO) {
    firebase.initializeApp(C.firebase);
    auth = firebase.auth();
    db = firebase.firestore();
  }

  function iniciar() {
    aplicarTema();
    if (DEMO) {
      if (leer('nm_demo_sesion') === '1') { cargarDemo(); } else { pintarLogin(); }
      return;
    }
    auth.onAuthStateChanged(function (u) {
      S.usuario = u;
      if (!u) { S.datos = null; pintarLogin(); return; }
      cargarDatos();
    });
  }

  function cargarDatos() {
    var uid = S.usuario.uid;
    Promise.all([
      db.collection('repartidores').doc(uid).get(),
      db.collection('publico').doc('portal').get(),
      db.collection('repartidores').doc(uid).collection('lecturas').get()
    ]).then(function (r) {
      if (!r[0].exists) {
        pintarMensaje('Tus datos se están preparando',
          'Tu cuenta existe, pero todavía no llegaron tus datos. Vuelve a intentar en unos minutos. Si el problema sigue, escríbenos.');
        return;
      }
      S.datos = r[0].data();
      S.publico = r[1].exists ? r[1].data() : {};
      S.lecturas = {};
      r[2].forEach(function (d) { S.lecturas[d.id] = true; });
      arrancarApp();
    }).catch(function (e) {
      console.error(e);
      pintarMensaje('No pudimos cargar tus datos', 'Revisa tu conexión a internet e intenta de nuevo.');
    });
  }

  function pintarMensaje(titulo, texto) {
    app.innerHTML = '<div class="nm-pantalla"><div class="nm-patron" aria-hidden="true"></div>' +
      '<img src="marca/logos/nummeros-logotipo-apilado-' + (S.oscuro ? 'claro' : 'principal') + '.svg" alt="NUMMEROS">' +
      '<div style="max-width:380px"><div class="nm-login-titulo">' + esc(titulo) + '</div><p class="muted" style="margin-top:6px">' + esc(texto) + '</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' +
      '<button class="btn" data-accion="recargar">Intentar de nuevo</button>' +
      '<a class="btn sec" href="' + wa(C.whatsappGeneral, 'Hola, no puedo ver mis datos en el Portal CONTAX.') + '" target="_blank" rel="noopener">Escribir por WhatsApp</a>' +
      '<button class="btn sec" data-accion="salir">Salir</button></div></div>';
  }

  /* ══════════ INICIO DE SESIÓN ══════════ */
  var FOTOS = [
    { img: 'euclides-laptop', nombre: 'Euclides', rasgo: 'El orden', frase: 'Tus facturas y trámites, bien ordenados.' },
    { img: 'pitagoras-tablet', nombre: 'Pitágoras', rasgo: 'Los números del día a día', frase: 'Tus pagos de cada semana, siempre al día.' },
    { img: 'arquimedes-balanza', nombre: 'Arquímedes', rasgo: 'El equilibrio', frase: 'Lo que facturas y lo que cobras, cuadrado.' },
    { img: 'pitagoras-celular', nombre: 'Pitágoras', rasgo: 'Los números del día a día', frase: 'Tus números, desde el celular.' }
  ];
  var FOTOS_OSCURO = [
    { img: 'arquimedes-pensando', nombre: 'Arquímedes', rasgo: 'El equilibrio', frase: 'Lo que facturas y lo que cobras, cuadrado.' },
    { img: 'arquimedes-eureka', nombre: 'Arquímedes', rasgo: 'El equilibrio', frase: '¡Eureka! Tu pago ya está registrado.', pos: '72% 40%' }
  ];
  function insignia(p) {
    return '<div class="nm-nombre"><i><img src="marca/logos/nummeros-isotipo-blanco.svg" alt=""></i>' + p.nombre + '<span>' + p.rasgo + '</span></div>';
  }

  function pintarLogin(error) {
    pararCarrusel();
    var fotos = S.oscuro ? FOTOS_OSCURO.concat(FOTOS_OSCURO) : FOTOS;
    var cel = leer('nm_ultimo_celular') || '';
    app.innerHTML =
      '<div class="nm-login">' +
        '<main class="nm-login-panel"><div class="nm-patron" aria-hidden="true"></div>' +
          '<form class="nm-login-card" id="formLogin" novalidate>' +
            '<img class="nm-login-logo" src="marca/logos/nummeros-logotipo-apilado-' + (S.oscuro ? 'claro' : 'principal') + '.svg" alt="NUMMEROS">' +
            '<div class="nm-login-slogan">Sistemas a la medida de tu empresa.</div>' +
            '<h1 class="nm-login-titulo">Portal CONTAX</h1>' +
            '<p class="nm-login-sub">Consulta tus pagos, facturas y trámites. Ingresa con tu celular y tu ID de Yango.</p>' +
            '<div class="nm-campo"><label for="cel">Número de celular</label>' +
              '<input id="cel" inputmode="numeric" autocomplete="tel" placeholder="591 7XXXXXXX" value="' + esc(cel) + '" required>' +
              '<small>Con o sin el 591 adelante.</small></div>' +
            '<div class="nm-campo"><label for="idy">ID de Yango</label>' +
              '<input id="idy" type="password" autocomplete="current-password" placeholder="Tu ID de Yango" required></div>' +
            '<div class="nm-login-err" id="errLogin" role="alert">' + esc(error || '') + '</div>' +
            '<button class="nm-login-btn" id="btnEntrar" type="submit">Ingresar</button>' +
            '<p class="nm-login-ayuda">¿Problemas para entrar? <a href="' + wa(C.whatsappGeneral, 'Hola, no puedo entrar al Portal CONTAX.') + '" target="_blank" rel="noopener">Escríbenos por WhatsApp</a></p>' +
          '</form>' +
          '<div class="nm-login-pie"><span class="nm-login-ver">Portal CONTAX · v' + esc(C.version) + (DEMO ? ' · demostración' : '') + '</span>' +
            '<span>NUMMEROS by CONTAX · Santa Cruz de la Sierra, Bolivia</span>' +
            '<button class="hdr-btn" type="button" data-accion="tema" style="margin-top:6px">' + ic(S.oscuro ? 'sol' : 'luna') + (S.oscuro ? 'Modo claro' : 'Modo oscuro') + '</button></div>' +
        '</main>' +
        '<aside class="nm-login-foto" aria-label="Escultura griega trabajando con NUMMEROS">' +
          fotos.map(function (p) {
            return '<figure><img src="marca/clasicos/' + p.img + '.jpg"' + (p.pos ? ' style="object-position:' + p.pos + '"' : '') +
              ' alt="' + p.nombre + ', escultura griega de mármol"><figcaption>' + insignia(p) + '<div class="nm-frase">' + p.frase + '</div></figcaption></figure>';
          }).join('') +
          '<div class="nm-login-lema">Tus pagos, claros y al día.<small>Portal de repartidores · NUMMEROS by CONTAX</small></div>' +
        '</aside>' +
      '</div>';
    document.getElementById('formLogin').addEventListener('submit', entrar);
  }

  function entrar(e) {
    e.preventDefault();
    var err = document.getElementById('errLogin');
    var cel = limpiarCelular(document.getElementById('cel').value);
    var id = String(document.getElementById('idy').value || '').trim();
    if (!/^591\d{8}$/.test(cel)) { err.textContent = 'Revisa tu celular: deben ser 8 números (con o sin el 591).'; return; }
    if (!id) { err.textContent = 'Escribe tu ID de Yango.'; return; }
    var btn = document.getElementById('btnEntrar');
    btn.disabled = true; btn.textContent = 'Verificando…'; err.textContent = '';
    guardar('nm_ultimo_celular', cel);

    if (DEMO) { guardar('nm_demo_sesion', '1'); setTimeout(cargarDemo, 400); return; }

    auth.signInWithEmailAndPassword(correoDe(id), claveDe(cel, id)).catch(function (ex) {
      btn.disabled = false; btn.textContent = 'Ingresar';
      var c = ex && ex.code || '';
      if (/invalid|wrong-password|user-not-found/.test(c)) err.textContent = 'Celular o ID incorrecto. Revisa tus datos.';
      else if (/too-many-requests/.test(c)) err.textContent = 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
      else if (/network/.test(c)) err.textContent = 'No hay conexión a internet.';
      else err.textContent = 'No pudimos ingresar. Intenta de nuevo.';
    });
  }

  function salir() {
    pararCarrusel();
    S.datos = null; S.avisosVistos = false;
    if (DEMO) { guardar('nm_demo_sesion', '0'); pintarLogin(); return; }
    auth.signOut();
  }

  /* ══════════ ESTRUCTURA DE LA APP ══════════ */
  var MENU = [
    { sec: 'Mis pagos' },
    { id: 'inicio', t: 'Inicio', i: 'inicio' },
    { id: 'pendientes', t: 'Pendientes', i: 'pendientes' },
    { id: 'historial', t: 'Historial', i: 'historial' },
    { id: 'resumen', t: 'Resumen', i: 'resumen' },
    { sec: 'Ayuda' },
    { id: 'tramites', t: 'Mis trámites', i: 'tramites' },
    { id: 'preguntas', t: 'Preguntas', i: 'preguntas' },
    { id: 'contacto', t: 'Contacto', i: 'contacto' },
    { id: 'instalar', t: 'Instalar en el celular', i: 'instalar' }
  ];
  var TABS = [
    { id: 'inicio', t: 'Inicio', i: 'inicio' },
    { id: 'pendientes', t: 'Pendientes', i: 'pendientes' },
    { id: 'historial', t: 'Historial', i: 'historial' },
    { id: 'tramites', t: 'Trámites', i: 'tramites' },
    { id: 'mas', t: 'Más', i: 'mas' }
  ];

  function cuentas() {
    var d = S.datos || {};
    var tr = (d.tramites || []).filter(function (t) { return claseTramite(t) !== 'ok'; }).length;
    return { pendientes: (d.pendientes || []).length, tramites: tr };
  }

  function arrancarApp() {
    var d = S.datos;
    app.innerHTML =
      (DEMO ? '<div class="demo-cinta">Modo demostración: estos datos son de ejemplo. Los datos reales aparecen cuando se conecte Firebase.</div>' : '') +
      '<header class="hdr">' +
        '<button class="hdr-brand" data-ir="inicio" aria-label="Ir al inicio"><img src="marca/logos/nummeros-logotipo-horizontal-' + (S.oscuro ? 'claro' : 'principal') + '.svg" alt="NUMMEROS">' +
        '<span class="hdr-emp"><b>Portal CONTAX</b>' + esc(d.nombre || '') + '</span></button>' +
        '<div class="hdr-r">' +
          '<span class="hdr-sync">' + (ultimaSync() ? 'Datos al ' + fechaTexto(ultimaSync()) : '') + '</span>' +
          '<button class="hdr-btn solo" data-accion="tema" aria-label="Cambiar modo claro u oscuro">' + ic(S.oscuro ? 'sol' : 'luna') + '</button>' +
          '<button class="hdr-btn" data-accion="salir">' + ic('salir') + 'Salir</button>' +
        '</div>' +
      '</header>' +
      '<div class="layout">' +
        '<nav class="nav" id="nav" aria-label="Menú"></nav>' +
        '<main class="cnt"><div class="cnt-in" id="pagina"></div></main>' +
      '</div>' +
      '<nav class="tabbar" id="tabbar" aria-label="Menú"></nav>';
    var h = (location.hash || '').replace('#/', '');
    ir(PAGINAS[h] ? h : 'inicio', true);
    if (!S.avisosVistos) { S.avisosVistos = true; setTimeout(mostrarAvisos, 500); }
  }

  function pintarMenus() {
    var n = cuentas();
    document.getElementById('nav').innerHTML = MENU.map(function (m) {
      if (m.sec) return '<span class="nav-sec">' + m.sec + '</span>';
      var c = n[m.id] ? '<span class="cuenta">' + n[m.id] + '</span>' : '';
      return '<button class="nav-link' + (S.pagina === m.id ? ' active' : '') + '" data-ir="' + m.id + '">' + ic(m.i) + '<span>' + m.t + '</span>' + c + '</button>';
    }).join('') +
      '<div class="nav-pie"><img src="marca/logos/nummeros-logotipo-firma-' + (S.oscuro ? 'claro' : 'principal') + '.svg" alt="NUMMEROS by CONTAX">Portal CONTAX · v' + esc(C.version) + '</div>';
    var enMas = ['resumen', 'preguntas', 'contacto', 'instalar'].indexOf(S.pagina) >= 0;
    document.getElementById('tabbar').innerHTML = TABS.map(function (t) {
      var on = t.id === S.pagina || (t.id === 'mas' && enMas);
      return '<button class="' + (on ? 'on' : '') + '" ' + (t.id === 'mas' ? 'data-accion="mas"' : 'data-ir="' + t.id + '"') + '><i>' + ic(t.i) + '</i>' + t.t + '</button>';
    }).join('');
  }

  function ir(p, sinHistorial) {
    if (!PAGINAS[p]) p = 'inicio';
    pararCarrusel();
    if (S.grafico) { S.grafico.destroy(); S.grafico = null; }
    S.pagina = p;
    pintarMenus();
    var el = document.getElementById('pagina');
    el.innerHTML = PAGINAS[p]() + pie();
    if (DESPUES[p]) DESPUES[p]();
    if (!sinHistorial) history.pushState(null, '', '#/' + p);
    else history.replaceState(null, '', '#/' + p);
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', function () {
    if (!S.datos) return;
    var h = (location.hash || '').replace('#/', '');
    ir(PAGINAS[h] ? h : 'inicio', true);
  });

  function pie() {
    return '<div class="pie-version"><img src="marca/logos/nummeros-logotipo-firma-' + (S.oscuro ? 'claro' : 'principal') + '.svg" alt="NUMMEROS by CONTAX">' +
      'Portal CONTAX · v' + esc(C.version) + (ultimaSync() ? ' · datos al ' + fechaTexto(ultimaSync()) : '') + '</div>';
  }
  function ultimaSync() { return (S.publico && S.publico.sincronizado) || (S.datos && S.datos.actualizado) || null; }
  function titulo(t, sub, extra) {
    return '<div class="pg-tit"><div><h1>' + t + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (extra || '') + '</div>';
  }
  function vacio(t, s) { return '<div class="vacio"><b>' + t + '</b>' + (s || '') + '</div>'; }

  /* ── Bloques que se repiten ── */
  function alertaHabilitacion() {
    if (!S.datos || S.datos.habilitado !== false) return '';
    return '<div class="aviso error">' + ic('alerta') + '<div><b>Tu pago de esta semana no está habilitado por la app</b>' +
      'No cumpliste con las horas mínimas de Yango esta semana. Si tienes pagos de semanas anteriores pendientes y emites tu factura, esos sí se te pagan.</div></div>';
  }
  function tarjetaPoliza() {
    var form = formulario('polizas');
    if (S.datos.poliza) {
      return '<div class="aviso">' + ic('escudo') + '<div><b>Póliza de seguro presentada</b>Tu póliza está registrada. No tienes nada pendiente.</div></div>';
    }
    return '<div class="aviso alerta">' + ic('escudo') + '<div><b>Póliza de seguro no presentada</b>' +
      'Si tu póliza es de PATRIA ASEGURADORA no hace falta enviarla, pero sí debes llenar el formulario para que no se retengan tus pagos. Si es de otra aseguradora, preséntala con el mismo formulario.' +
      (form ? '<div class="acciones"><a class="btn chico" href="' + esc(prellenar(form.url)) + '" target="_blank" rel="noopener">' + ic('doc') + 'Llenar formulario de póliza</a></div>' : '') +
      '</div></div>';
  }
  function formulario(clave) {
    var f = (S.publico && S.publico.formularios) || [];
    for (var i = 0; i < f.length; i++) if (f[i].clave === clave) return f[i];
    return null;
  }

  /* ══════════ PÁGINAS ══════════ */
  var PAGINAS = {}, DESPUES = {};

  PAGINAS.inicio = function () {
    var d = S.datos, r = d.resumen || {};
    var pend = r.pendientes || { cantidad: 0, total: 0 }, pag = r.pagados || { cantidad: 0, total: 0 };
    var ultimo = (d.historial || [])[0];
    var tr = d.tramites || [];
    var enProceso = tr.filter(function (t) { return claseTramite(t) !== 'ok'; }).length;
    return '' +
      alertaHabilitacion() +
      '<div class="nm-inicio">' +
        '<section class="nm-inicio-hero"><div class="nm-patron" aria-hidden="true"></div>' +
          '<div class="nm-saludo"><small>Portal CONTAX</small><h1>Hola, ' + esc(primerNombre(d.nombre)) + '.</h1>' +
          '<p>' + (pend.cantidad ? 'Tienes ' + pend.cantidad + ' pago' + (pend.cantidad === 1 ? '' : 's') + ' pendiente' + (pend.cantidad === 1 ? '' : 's') + ' por ' + bs(pend.total) + '. Recuerda enviar tu factura hasta el jueves a las 18:00.' : 'No tienes pagos pendientes. Todo está al día.') + '</p></div>' +
          '<div class="nm-kpis">' +
            '<button class="nm-kpi" data-ir="pendientes"><small>Por cobrar</small><b>' + bs(pend.total) + '</b><em>' + pend.cantidad + ' semana' + (pend.cantidad === 1 ? '' : 's') + ' pendiente' + (pend.cantidad === 1 ? '' : 's') + '</em></button>' +
            '<button class="nm-kpi" data-ir="historial"><small>Último pago</small><b>' + (ultimo ? bs(ultimo.importe) : '—') + '</b><em>' + (ultimo ? esc(ultimo.fechaPago || '') : 'Sin pagos aún') + '</em></button>' +
            '<button class="nm-kpi" data-ir="resumen"><small>Total cobrado</small><b>' + bs(pag.total) + '</b><em>' + pag.cantidad + ' pago' + (pag.cantidad === 1 ? '' : 's') + '</em></button>' +
          '</div>' +
        '</section>' +
        '<figure class="nm-inicio-foto"><img src="marca/clasicos/' + (S.oscuro ? 'arquimedes-eureka' : 'pitagoras-celular') + '.jpg" alt="Escultura griega revisando un celular">' +
          '<figcaption>' + insignia(S.oscuro ? FOTOS_OSCURO[1] : FOTOS[3]) + '<div class="nm-frase">' + (S.oscuro ? FOTOS_OSCURO[1] : FOTOS[3]).frase + '</div></figcaption></figure>' +
      '</div>' +
      '<div id="carrusel"></div>' +
      '<div class="grid2">' +
        '<div class="card"><div class="h2">Póliza de seguro</div>' + tarjetaPoliza() + '</div>' +
        '<div class="card"><div class="h2">Mis trámites <small>' + (tr.length ? tr.length + ' en total' : '') + '</small></div>' +
          (tr.length
            ? '<p style="margin-bottom:12px">' + (enProceso ? 'Tienes <b>' + enProceso + '</b> trámite' + (enProceso === 1 ? '' : 's') + ' en proceso.' : 'Todos tus trámites están resueltos.') + '</p>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px"><span class="muted" style="font-size:13px">Último: ' + esc(tr[0].numero) + '</span>' + chipEstado(tr[0]) + '</div>'
            : '<p class="muted" style="margin-bottom:14px">Aún no enviaste ningún formulario. Desde aquí puedes pedir soporte, presentar tu póliza o solicitar devoluciones.</p>') +
          '<button class="btn sec chico" data-ir="tramites">Ver mis trámites</button></div>' +
      '</div>';
  };
  DESPUES.inicio = function () { pintarCarrusel(); };

  PAGINAS.pendientes = function () {
    var d = S.datos, lista = d.pendientes || [], r = (d.resumen || {}).pendientes || { total: 0 };
    return titulo('Pagos pendientes', 'Semanas registradas que todavía no fueron abonadas.') +
      alertaHabilitacion() +
      '<div class="grid2">' +
        '<div class="card"><div class="h2">Datos para facturar</div>' +
          '<div class="dato"><span>Razón social</span><div><b>' + esc(C.facturacion.razonSocial) + '</b><button class="copiar" data-copiar="' + esc(C.facturacion.razonSocial) + '">Copiar</button></div></div>' +
          '<div class="dato"><span>NIT</span><div><b class="num">' + esc(C.facturacion.nit) + '</b><button class="copiar" data-copiar="' + esc(C.facturacion.nit) + '">Copiar</button></div></div>' +
          '<div style="margin-top:14px"><a class="btn wa ancho" href="' + wa(C.whatsappFacturas) + '" target="_blank" rel="noopener">' + ic('whatsapp') + 'Enviar factura en PDF · ' + telVisible(C.whatsappFacturas) + '</a></div>' +
        '</div>' +
        '<div class="card"><div class="h2">Cuándo se paga</div><ul class="reglas">' +
          (C.reglasPago || []).map(function (t) { return '<li>' + ic('reloj') + '<span>' + esc(t) + '</span></li>'; }).join('') +
        '</ul></div>' +
      '</div>' +
      '<div class="card"><div class="h2">Detalle <small>' + lista.length + ' semana' + (lista.length === 1 ? '' : 's') + '</small></div>' +
        (lista.length
          ? '<div class="tabla-caja tabla-movil"><table><thead><tr><th>Semana</th><th>Período</th><th>Estado</th><th class="monto">Importe</th></tr></thead><tbody>' +
            lista.map(function (p) {
              return '<tr><td data-et="Semana"><b class="num">' + esc(p.semana) + '</b></td><td data-et="Período">' + esc(p.rango) + '</td>' +
                '<td data-et="Estado"><span class="chip pend">' + esc(p.estado || 'Pendiente') + '</span></td><td class="monto" data-et="Importe">' + bs(p.importe) + '</td></tr>';
            }).join('') +
            '</tbody><tfoot><tr><td colspan="3">Total por cobrar</td><td class="monto" data-et="Total por cobrar">' + bs(r.total) + '</td></tr></tfoot></table></div>'
          : vacio('No tienes pagos pendientes', 'Cuando registremos una semana nueva aparecerá aquí.')) +
      '</div>';
  };

  PAGINAS.historial = function () {
    var d = S.datos, lista = d.historial || [], r = (d.resumen || {}).pagados || { total: 0 };
    return titulo('Historial de pagos', 'Pagos que ya recibiste.') +
      '<div class="card">' +
        (lista.length
          ? '<div class="tabla-caja tabla-movil"><table><thead><tr><th>Fecha de pago</th><th>Semana</th><th>Período</th><th class="monto">Importe</th></tr></thead><tbody>' +
            lista.map(function (p) {
              return '<tr><td data-et="Fecha de pago"><b>' + esc(p.fechaPago) + '</b></td><td data-et="Semana" class="num">' + esc(p.semana) + '</td>' +
                '<td data-et="Período">' + esc(p.rango) + '</td><td class="monto" data-et="Importe">' + bs(p.importe) + '</td></tr>';
            }).join('') +
            '</tbody><tfoot><tr><td colspan="3">Total cobrado</td><td class="monto" data-et="Total cobrado">' + bs(r.total) + '</td></tr></tfoot></table></div>'
          : vacio('Todavía no tienes pagos registrados')) +
      '</div>';
  };

  PAGINAS.resumen = function () {
    var r = S.datos.resumen || {}, pe = r.pendientes || { cantidad: 0, total: 0 }, pa = r.pagados || { cantidad: 0, total: 0 };
    var prom = pa.cantidad ? pa.total / pa.cantidad : null;
    return titulo('Resumen', 'Tus números en un vistazo.') +
      '<div class="nm-kpis" style="margin-bottom:14px">' +
        '<div class="nm-kpi"><small>Total cobrado</small><b>' + bs(pa.total) + '</b><em>' + pa.cantidad + ' pagos</em></div>' +
        '<div class="nm-kpi"><small>Por cobrar</small><b>' + bs(pe.total) + '</b><em>' + pe.cantidad + ' semanas</em></div>' +
        '<div class="nm-kpi"><small>Promedio por pago</small><b>' + bs(prom) + '</b><em>de lo ya cobrado</em></div>' +
      '</div>' +
      '<div class="card"><div class="h2">Pagos recibidos por semana <small>últimas 12</small></div>' +
        ((S.datos.historial || []).length ? '<div class="grafico"><canvas id="grafico" aria-label="Gráfico de pagos por semana"></canvas></div>' : vacio('Aún no hay pagos para graficar')) +
      '</div>';
  };
  DESPUES.resumen = function () {
    var lista = (S.datos.historial || []).slice(0, 12).reverse();
    var cv = document.getElementById('grafico');
    if (!cv || !lista.length) return;
    function dibujar() {
      if (!window.Chart) { setTimeout(dibujar, 300); return; }
      var css = getComputedStyle(document.body);
      var suave = css.getPropertyValue('--nm-suave').trim(), borde = css.getPropertyValue('--nm-borde').trim();
      S.grafico = new Chart(cv, {
        type: 'bar',
        data: {
          labels: lista.map(function (p) { return /^\d+$/.test(String(p.semana)) ? 'Sem ' + p.semana : String(p.semana); }),
          datasets: [{ label: 'Importe', data: lista.map(function (p) { return numero(p.importe) || 0; }),
            backgroundColor: S.oscuro ? '#8EB69B' : '#235347', borderRadius: 6, maxBarThickness: 38 }]
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return bs(c.parsed.y); } } } },
          scales: {
            x: { grid: { display: false }, ticks: { color: suave, font: { family: 'Questrial' } } },
            y: { grid: { color: borde }, border: { display: false }, ticks: { color: suave, font: { family: 'Questrial' }, callback: function (v) { return 'Bs ' + v; } } }
          }
        }
      });
    }
    dibujar();
  };

  /* ── Trámites ── */
  function claseTramite(t) {
    var e = String(t.estado || '').toUpperCase(), r = String(t.resolucion || '').toUpperCase();
    if (/^RECHAZ|^ANULAD|VENCID/.test(e) || /^RECHAZ|^ANULAD/.test(r)) return 'mal';
    if (/^RESUELT|^CERRAD|VIGENTE|PAGAD|ABONAD/.test(e) || /^APROBAD/.test(r)) return 'ok';
    return 'pend';
  }
  function chipEstado(t) {
    var e = t.estado || (t.resolucion ? '' : 'Recibido');
    var h = '';
    if (e) h += '<span class="chip ' + (t.estado ? claseTramite({ estado: t.estado }) : 'neutro') + '">' + esc(e) + '</span> ';
    if (t.resolucion) h += '<span class="chip ' + claseTramite({ resolucion: t.resolucion }) + '">' + esc(t.resolucion) + '</span>';
    return h;
  }
  PAGINAS.tramites = function () {
    var tr = S.datos.tramites || [], forms = (S.publico && S.publico.formularios) || [];
    return titulo('Mis trámites', 'Los formularios que enviaste y en qué estado están. Se actualiza en cuanto CONTAX revisa tu caso.') +
      (forms.length ? '<div class="card"><div class="h2">Iniciar un trámite</div><div class="grid3">' +
        forms.map(function (f) {
          return '<div class="form-card"><div><b>' + esc(f.nombre) + '</b>' + (f.descripcion ? '<p>' + esc(f.descripcion) + '</p>' : '') + '</div>' +
            '<a class="btn chico" href="' + esc(prellenar(f.url)) + '" target="_blank" rel="noopener">' + ic('doc') + 'Abrir formulario</a></div>';
        }).join('') + '</div></div>' : '') +
      '<div class="card"><div class="h2">Historial de trámites <small>' + tr.length + '</small></div>' +
        (tr.length ? tr.map(function (t) {
          var filas = [];
          if (t.asunto) filas.push([t.etAsunto || 'Caso', t.asunto]);
          if (t.detalle) filas.push([t.etDetalle || 'Detalle', t.detalle]);
          if (t.motivo) filas.push(['Motivo', t.motivo]);
          if (t.fechaRespuesta) filas.push(['Última actualización', t.fechaRespuesta]);
          return '<article class="tramite ' + claseTramite(t) + '"><div class="tramite-cab"><span class="tramite-num">' + esc(t.numero) + '</span>' + chipEstado(t) +
            '<span class="tramite-fecha">' + esc(t.fecha) + '</span><span class="tramite-tipo">' + esc(t.tipo) + '</span></div>' +
            '<div class="tramite-cuerpo">' + filas.map(function (f) { return '<div class="tramite-fila"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; }).join('') +
            (t.comentario ? '<div class="tramite-resp"><b>Respuesta de CONTAX</b>' + conEnlaces(t.comentario) + '</div>' : '') +
            '</div></article>';
        }).join('') : vacio('Aún no tienes trámites', 'Cuando envíes un formulario, su estado aparecerá aquí.')) +
      '</div>';
  };

  /* ── Preguntas frecuentes ── */
  PAGINAS.preguntas = function () {
    var cats = (S.publico && S.publico.preguntas) || [], enc = S.publico && S.publico.encuesta;
    return titulo('Preguntas frecuentes', 'Respuestas rápidas a las dudas más comunes.') +
      '<div class="card"><div class="buscar">' + ic('buscar') + '<input id="buscarFaq" type="search" placeholder="Busca tu duda, por ejemplo: factura" aria-label="Buscar en preguntas"></div>' +
        '<div id="listaFaq">' + (cats.length ? cats.map(function (c) {
          return '<div class="faq-grupo"><div class="faq-cat">' + esc(c.nombre) + '</div>' + c.preguntas.map(function (q) {
            return '<details class="faq"><summary>' + esc(q.p) + '</summary><div>' + conEnlaces(q.r) + '</div></details>';
          }).join('') + '</div>';
        }).join('') : vacio('Todavía no hay preguntas publicadas', 'Escríbenos y con gusto te ayudamos.')) + '</div>' +
        '<div id="faqNada" hidden>' + vacio('No encontramos esa pregunta', 'Escríbenos por WhatsApp y te respondemos.') + '</div>' +
      '</div>' +
      (enc && enc.url ? '<div class="card" style="text-align:center"><div class="h2" style="justify-content:center">' + esc(enc.titulo || '¿Cómo te atendemos?') + '</div>' +
        '<p class="muted" style="max-width:52ch;margin:0 auto 14px">' + esc(enc.texto || '') + '</p>' +
        '<a class="btn" href="' + esc(prellenar(enc.url)) + '" target="_blank" rel="noopener">' + ic('estrella') + esc(String(enc.textoBoton || 'Calificar el servicio').replace(/[^\p{L}\p{N}\s.,¿?¡!]/gu, '').trim()) + '</a></div>' : '');
  };
  DESPUES.preguntas = function () {
    var inp = document.getElementById('buscarFaq');
    if (!inp) return;
    inp.addEventListener('input', function () {
      var q = inp.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      var hay = 0;
      document.querySelectorAll('#listaFaq .faq-grupo').forEach(function (g) {
        var vis = 0;
        g.querySelectorAll('details').forEach(function (d) {
          var t = d.textContent.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
          var ok = !q || t.indexOf(q) >= 0;
          d.hidden = !ok; if (ok) { vis++; if (q) d.open = true; }
        });
        g.hidden = !vis; hay += vis;
      });
      document.getElementById('faqNada').hidden = hay > 0 || !q;
    });
  };

  /* ── Contacto ── */
  PAGINAS.contacto = function () {
    return titulo('Contacto', 'Estamos para ayudarte.') +
      '<div class="grid2">' +
        '<div class="wa-card"><span class="et">Consultas</span><span class="tel">' + telVisible(C.whatsappGeneral) + '</span>' +
          '<p class="muted">Dudas sobre tus pagos, trámites, NIT, Matrícula de Comercio o ROE.</p>' +
          '<a class="btn wa" href="' + wa(C.whatsappGeneral, 'Hola CONTAX, soy ' + (S.datos.nombre || '') + ' (ID ' + (S.datos.id || '') + ').') + '" target="_blank" rel="noopener">' + ic('whatsapp') + 'Escribir por WhatsApp</a></div>' +
        '<div class="wa-card"><span class="et">Solo facturas</span><span class="tel">' + telVisible(C.whatsappFacturas) + '</span>' +
          '<p class="muted">Recibe únicamente facturas en PDF. No atiende llamadas ni consultas.</p>' +
          '<a class="btn sec" href="' + wa(C.whatsappFacturas) + '" target="_blank" rel="noopener">' + ic('doc') + 'Enviar factura</a></div>' +
      '</div>' +
      '<div class="card" style="margin-top:14px"><div class="h2">Antes de escribirnos</div><ul class="reglas">' +
        '<li>' + ic('info') + '<span>Revisa <b>Preguntas</b>: ahí están las dudas más comunes.</span></li>' +
        '<li>' + ic('tramites') + '<span>Para un problema con un pago, abre un trámite de <b>Soporte</b> en <b>Mis trámites</b>. Así queda registrado y ves la respuesta.</span></li>' +
        '<li>' + ic('reloj') + '<span>Tus datos en el portal se actualizan cada 15 minutos.</span></li>' +
      '</ul></div>';
  };

  /* ── Instalar en el celular ── */
  var eventoInstalar = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); eventoInstalar = e; });
  PAGINAS.instalar = function () {
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return titulo('Instalar en tu celular', 'Tenlo como una app más, con su ícono en tu pantalla.') +
      (eventoInstalar ? '<div class="card"><button class="btn" data-accion="instalar">' + ic('instalar') + 'Instalar ahora</button></div>' : '') +
      '<div class="grid2">' +
        '<div class="card"><div class="h2">iPhone ' + (ios ? '<span class="chip ok">Tu celular</span>' : '') + '</div><ol class="pasos">' +
          '<li>Abre este portal en <b>Safari</b>.</li><li>Toca el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li>' +
          '<li>Elige <b>Agregar a pantalla de inicio</b>.</li><li>Toca <b>Agregar</b>. Listo: aparece el ícono de NUMMEROS.</li></ol></div>' +
        '<div class="card"><div class="h2">Android ' + (!ios ? '<span class="chip ok">Tu celular</span>' : '') + '</div><ol class="pasos">' +
          '<li>Abre este portal en <b>Chrome</b>.</li><li>Toca los <b>tres puntos</b> arriba a la derecha.</li>' +
          '<li>Elige <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.</li><li>Confirma. Listo.</li></ol></div>' +
      '</div>';
  };

  /* ── Hoja "Más" del celular ── */
  function abrirMas() {
    var h = document.createElement('div');
    h.className = 'hoja-mas'; h.id = 'hojaMas';
    h.innerHTML = '<div class="fondo" data-accion="cerrarMas"></div><div class="hoja" role="dialog" aria-label="Más opciones"><div class="agarre"></div>' +
      [['resumen', 'Resumen'], ['preguntas', 'Preguntas'], ['contacto', 'Contacto'], ['instalar', 'Instalar en el celular']].map(function (m) {
        return '<button class="nav-link" data-ir="' + m[0] + '">' + ic(m[0]) + '<span>' + m[1] + '</span></button>';
      }).join('') +
      '<button class="nav-link" data-accion="tema">' + ic(S.oscuro ? 'sol' : 'luna') + '<span>' + (S.oscuro ? 'Modo claro' : 'Modo oscuro') + '</span></button>' +
      '<button class="nav-link" data-accion="salir" style="color:var(--nm-error)">' + ic('salir') + '<span>Salir</span></button></div>';
    document.body.appendChild(h);
  }
  function cerrarMas() { var h = document.getElementById('hojaMas'); if (h) h.remove(); }

  /* ── Carrusel de anuncios ── */
  function pintarCarrusel() {
    var lista = (S.publico && S.publico.anuncios) || [];
    var cont = document.getElementById('carrusel');
    if (!cont || !lista.length) return;
    cont.className = 'carrusel';
    cont.setAttribute('aria-label', 'Anuncios de CONTAX');
    cont.innerHTML = lista.map(function (a, i) {
      var img = '<img src="' + esc(a.imagen) + '" alt="' + esc(a.titulo || 'Anuncio de CONTAX') + '" loading="lazy">';
      return '<div class="slide' + (i ? '' : ' on') + '">' + (a.link ? '<a href="' + esc(a.link) + '" target="_blank" rel="noopener">' + img + '</a>' : img) + '</div>';
    }).join('') + (lista.length > 1
      ? '<button class="flecha izq" aria-label="Anterior" data-mover="-1">' + ic('flechaIzq') + '</button><button class="flecha der" aria-label="Siguiente" data-mover="1">' + ic('flechaDer') + '</button>' +
        '<div class="puntos">' + lista.map(function (a, i) { return '<button class="' + (i ? '' : 'on') + '" data-ir-slide="' + i + '" aria-label="Anuncio ' + (i + 1) + '"></button>'; }).join('') + '</div>'
      : '');
    if (lista.length < 2) return;
    var actual = 0;
    function mostrar(n) {
      actual = (n + lista.length) % lista.length;
      cont.querySelectorAll('.slide').forEach(function (s, i) { s.classList.toggle('on', i === actual); });
      cont.querySelectorAll('.puntos button').forEach(function (s, i) { s.classList.toggle('on', i === actual); });
    }
    function reiniciar() { pararCarrusel(); S.carrusel = setInterval(function () { mostrar(actual + 1); }, 5000); }
    cont.addEventListener('click', function (e) {
      var m = e.target.closest('[data-mover]'), p = e.target.closest('[data-ir-slide]');
      if (m) { mostrar(actual + Number(m.getAttribute('data-mover'))); reiniciar(); }
      if (p) { mostrar(Number(p.getAttribute('data-ir-slide'))); reiniciar(); }
    });
    var x0 = null;
    cont.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    cont.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { mostrar(actual + (dx < 0 ? 1 : -1)); reiniciar(); }
      x0 = null;
    });
    reiniciar();
  }
  function pararCarrusel() { if (S.carrusel) { clearInterval(S.carrusel); S.carrusel = null; } }

  /* ── Avisos emergentes de CONTAX ── */
  function mostrarAvisos() {
    var vistos = {};
    try { vistos = JSON.parse(leer('nm_avisos_' + (S.datos.id || '')) || '{}'); } catch (e) {}
    var cola = (S.datos.avisos || []).filter(function (a) {
      if (a.frecuencia === 'CADA INGRESO') return true;
      if (S.lecturas[a.codigo]) return false;
      if (a.frecuencia === 'UNA VEZ' && vistos[a.codigo]) return false;
      return true;
    });
    mostrarAviso(cola, 0, vistos);
  }
  function mostrarAviso(cola, i, vistos) {
    if (i >= cola.length) return;
    var a = cola[i], tipo = /^(INFO|IMPORTANTE|URGENTE)$/.test(a.tipo) ? a.tipo : 'INFO';
    var nombres = { INFO: 'Información', IMPORTANTE: 'Aviso importante', URGENTE: 'Aviso urgente' };
    var obligado = tipo === 'URGENTE' || a.frecuencia === 'HASTA QUE CONFIRME';
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<div class="modal-caja" role="dialog" aria-modal="true" aria-labelledby="avisoTit">' +
      '<div class="modal-cab ' + tipo + '">' + ic(tipo === 'INFO' ? 'info' : 'alerta') + '<span>' + nombres[tipo] + '</span>' + (obligado ? '' : '<button aria-label="Cerrar" data-cerrar>×</button>') + '</div>' +
      (a.imagen ? '<img src="' + esc(a.imagen) + '" alt="">' : '') +
      '<div class="modal-cuerpo">' + (a.titulo ? '<h3 id="avisoTit">' + esc(a.titulo) + '</h3>' : '') + '<p>' + conEnlaces(a.mensaje) + '</p></div>' +
      '<div class="modal-pie">' + (a.botonLink ? '<a class="btn sec" href="' + esc(a.botonLink) + '" target="_blank" rel="noopener">' + esc(a.botonTexto || 'Ver más') + '</a>' : '') +
      '<button class="btn" data-ok>Entendido</button></div>' +
      (cola.length > 1 ? '<div class="modal-cont">Aviso ' + (i + 1) + ' de ' + cola.length + '</div>' : '') + '</div>';
    document.body.appendChild(m);
    function cerrar(confirmo) {
      if (confirmo || a.frecuencia === 'UNA VEZ') {
        vistos[a.codigo] = Date.now();
        guardar('nm_avisos_' + (S.datos.id || ''), JSON.stringify(vistos));
      }
      if (confirmo && a.frecuencia !== 'CADA INGRESO' && !DEMO) {
        db.collection('repartidores').doc(S.usuario.uid).collection('lecturas').doc(a.codigo)
          .set({ fecha: firebase.firestore.FieldValue.serverTimestamp(), titulo: String(a.titulo || '').slice(0, 200) })
          .catch(function (e) { console.warn('No se pudo registrar la lectura', e); });
      }
      m.remove();
      mostrarAviso(cola, i + 1, vistos);
    }
    m.querySelector('[data-ok]').addEventListener('click', function () { cerrar(true); });
    var x = m.querySelector('[data-cerrar]');
    if (x) x.addEventListener('click', function () { cerrar(false); });
    if (!obligado) m.addEventListener('click', function (e) { if (e.target === m) cerrar(false); });
    m.querySelector('[data-ok]').focus();
  }

  /* ══════════ CLICS (un solo escuchador para todo) ══════════ */
  document.addEventListener('click', function (e) {
    var irA = e.target.closest('[data-ir]');
    if (irA) { e.preventDefault(); cerrarMas(); ir(irA.getAttribute('data-ir')); return; }
    var c = e.target.closest('[data-copiar]');
    if (c) {
      var t = c.getAttribute('data-copiar');
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { aviso('Copiado: ' + t); }, function () { aviso(t); });
      return;
    }
    var a = e.target.closest('[data-accion]');
    if (!a) return;
    var acc = a.getAttribute('data-accion');
    if (acc === 'salir') { cerrarMas(); salir(); }
    else if (acc === 'mas') abrirMas();
    else if (acc === 'cerrarMas') cerrarMas();
    else if (acc === 'recargar') location.reload();
    else if (acc === 'instalar' && eventoInstalar) { eventoInstalar.prompt(); eventoInstalar = null; }
    else if (acc === 'tema') {
      S.oscuro = !S.oscuro; guardar('nm_oscuro', S.oscuro ? '1' : '0'); aplicarTema(); cerrarMas();
      if (S.datos) { var p = S.pagina; arrancarApp(); ir(p, true); } else pintarLogin();
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarMas(); });

  /* ══════════ MODO DEMOSTRACIÓN ══════════ */
  function cargarDemo() {
    var hoy = new Date();
    S.datos = {
      id: '27391057', nombre: 'JUAN CARLOS PÉREZ ROCA', celular: leer('nm_ultimo_celular') || '59170000000',
      habilitado: true, poliza: false, actualizado: hoy.toISOString(),
      pendientes: [
        { semana: '41', rango: '06/10 al 12/10', importe: 415.2, estado: 'Pendiente' },
        { semana: '40', rango: '29/09 al 05/10', importe: 512.8, estado: 'Factura recibida' },
        { semana: '39', rango: '22/09 al 28/09', importe: 317.5, estado: 'Falta factura' }
      ],
      historial: [
        { fechaPago: '03/10/2026', semana: '38', rango: '15/09 al 21/09', importe: 486 },
        { fechaPago: '26/09/2026', semana: '37', rango: '08/09 al 14/09', importe: 538.4 },
        { fechaPago: '19/09/2026', semana: '36', rango: '01/09 al 07/09', importe: 402.1 },
        { fechaPago: '12/09/2026', semana: '35', rango: '25/08 al 31/08', importe: 611.9 },
        { fechaPago: '05/09/2026', semana: '34', rango: '18/08 al 24/08', importe: 455 },
        { fechaPago: '29/08/2026', semana: '33', rango: '11/08 al 17/08', importe: 389.7 }
      ],
      tramites: [
        { numero: 'SOP-0142', tipo: 'Soporte – Problemas con pagos', fecha: '08/10/2026 10:12', asunto: 'No me llegó el pago de la semana 37', detalle: '001245', estado: 'En revisión', resolucion: '', comentario: 'Estamos verificando con Milthagor. Te respondemos hasta el viernes.', fechaRespuesta: '09/10/2026' },
        { numero: 'POL-0087', tipo: 'Póliza de Seguro', fecha: '15/09/2026 18:40', asunto: 'Seguros Illimani', etAsunto: 'Aseguradora', detalle: '15/09/2027', etDetalle: 'Vence el', estado: 'Vigente', resolucion: 'APROBADA', comentario: '' }
      ],
      avisos: [{ codigo: 'demo1', titulo: 'Feriado del lunes', mensaje: 'Este lunes no habrá pagos por feriado nacional.\nLos pagos de la semana se realizarán el martes.', tipo: 'IMPORTANTE', frecuencia: 'UNA VEZ' }]
    };
    S.datos.resumen = {
      pendientes: { cantidad: 3, total: 415.2 + 512.8 + 317.5 },
      pagados: { cantidad: 6, total: 486 + 538.4 + 402.1 + 611.9 + 455 + 389.7 }
    };
    S.publico = {
      anuncios: [],
      formularios: [
        { clave: 'soporte', nombre: 'Soporte – Problemas con pagos', descripcion: 'Si un pago no te llegó o el monto no cuadra.', url: '#' },
        { clave: 'polizas', nombre: 'Póliza de seguro', descripcion: 'Presenta o actualiza tu póliza.', url: '#' },
        { clave: 'devolucion', nombre: 'Devolución de saldos', descripcion: 'Solicita la devolución de un saldo a tu favor.', url: '#' }
      ],
      preguntas: [
        { nombre: 'Pagos', preguntas: [
          { p: '¿Qué significa que mi pago está "Pendiente"?', r: 'Que tu pago ya está registrado y en proceso, pero todavía no fue abonado. Cuando se pague, pasa a tu Historial.' },
          { p: 'Mi pago no aparece en el portal, ¿qué hago?', r: 'Revisa que hayas enviado tu factura en PDF al WhatsApp 75854243. Si pasaron más de 48 horas, abre un trámite de Soporte.' } ] },
        { nombre: 'Facturación', preguntas: [
          { p: '¿A qué número envío mis facturas?', r: 'Al WhatsApp 75854243. Esa línea recibe únicamente facturas en PDF.' },
          { p: 'No tengo NIT, ¿pueden ayudarme?', r: 'Sí. CONTAX te ayuda a obtener tu NIT, Matrícula de Comercio y ROE. Escríbenos al WhatsApp 69021969.' } ] }
      ],
      encuesta: { titulo: '¿Cómo te atendemos?', texto: 'Tu opinión nos ayuda a mejorar. Son 2 minutos.', textoBoton: 'Calificar el servicio', url: '#' }
    };
    S.lecturas = {};
    arrancarApp();
  }

  iniciar();
})();
