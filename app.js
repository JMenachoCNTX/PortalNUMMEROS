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
    grafico: null,
    admin: false,         // sesión de administrador
    contenido: null,      // anuncios, avisos y preguntas tal como se editan
    adminPreguntado: false
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
    panel: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    imagen: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    megafono: '<path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z"/><path d="M17 8.5a5 5 0 0 1 0 7"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    candado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    descargar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    mas2: '<path d="M12 5v14M5 12h14"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    borrar: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    arriba: '<path d="m6 15 6-6 6 6"/>',
    abajo: '<path d="m6 9 6 6 6-6"/>',
    ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    subir: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    factura: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    campana: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    enviar: '<path d="M4 12 20 4l-6 16-3-7z"/>',
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
  /* Texto de los avisos: **negrita**, párrafos, viñetas y enlaces; sin emojis */
  function formatoAviso(t) {
    t = String(t || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '');
    return t.split(/\n\s*\n/).map(function (bloque) {
      var lineas = bloque.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lineas.length) return '';
      var f = function (l) {
        return esc(l).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*\*/g, '')
          .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      };
      if (lineas.every(function (l) { return /^[-•*]\s+/.test(l); }))
        return '<ul>' + lineas.map(function (l) { return '<li>' + f(l.replace(/^[-•*]\s+/, '')) + '</li>'; }).join('') + '</ul>';
      return '<p>' + lineas.map(f).join('<br>') + '</p>';
    }).join('');
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
      if (!u) { S.datos = null; S.admin = false; pintarLogin(); return; }
      u.getIdTokenResult().then(function (t) {
        S.admin = !!(t.claims && t.claims.admin);
        cargarDatos();
      }, function () { S.admin = false; cargarDatos(); });
    });
  }

  /* ── Animación de carga al entrar (mínimo 5 segundos) ── */
  var CARGA_MS = 5000, cargaDesde = 0, cargaPaso = null;
  var PASOS = ['Verificando tu acceso…', 'Sincronizando tus pagos…', 'Revisando tus facturas y trámites…', 'Preparando tu resumen…'];
  var N_PATH = 'M0 427 L0 728 L136 728 L136 634 Z M410 0 L410 85 L546 292 L546 0 Z M0 0 L148 0 L410 458.5 L410 341 L546 548 L546 728 L401.71 728 L136 263 L136 379 L0 172 Z';
  function mostrarCarga() {
    if (document.getElementById('nmCarga')) return;
    cargaDesde = Date.now();
    pararCarrusel();
    app.innerHTML = '<div class="nm-carga" id="nmCarga" role="status" aria-live="polite"><div class="nm-patron" aria-hidden="true"></div>' +
      '<svg class="nm-n" viewBox="0 0 546 728" role="img" aria-label="Cargando"><clipPath id="nmLlenado"><rect class="nm-ola" x="0" y="728" width="546" height="728"><animate attributeName="y" values="728;520;300;90;0" keyTimes="0;0.25;0.5;0.8;1" dur="' + (CARGA_MS / 1000) + 's" fill="freeze" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1"/></rect></clipPath>' +
      '<path class="nm-n-base" d="' + N_PATH + '"></path><path class="nm-n-fill" clip-path="url(#nmLlenado)" d="' + N_PATH + '"></path></svg>' +
      '<p class="nm-titulo">Actualizando datos</p><p class="nm-paso" id="nmPaso">' + PASOS[0] + '</p></div>';
    var i = 0;
    clearInterval(cargaPaso);
    cargaPaso = setInterval(function () {
      var el = document.getElementById('nmPaso');
      if (!el) { clearInterval(cargaPaso); return; }
      i = Math.min(i + 1, PASOS.length - 1);
      el.classList.remove('entra'); void el.offsetWidth; el.textContent = PASOS[i]; el.classList.add('entra');
    }, CARGA_MS / PASOS.length);
  }
  /* Espera a que la animación cumpla su tiempo antes de mostrar el portal */
  function trasCarga(fn) {
    var falta = cargaDesde ? Math.max(0, CARGA_MS - (Date.now() - cargaDesde)) : 0;
    setTimeout(function () { clearInterval(cargaPaso); cargaDesde = 0; fn(); }, falta);
  }

  function cargarDatos() {
    mostrarCarga();
    // El administrador ve el portal con los datos del usuario de prueba
    var uid = S.admin ? idSeguro(C.accesoAdmin) : S.usuario.uid;
    Promise.all([
      db.collection('repartidores').doc(uid).get(),
      db.collection('publico').doc('portal').get(),
      db.collection('publico').doc('contenido').get(),
      db.collection('repartidores').doc(uid).collection('lecturas').get()
    ]).then(function (r) {
      if (!r[0].exists) {
        pintarMensaje('Tus datos se están preparando',
          'Tu cuenta existe, pero todavía no llegaron tus datos. Vuelve a intentar en unos minutos. Si el problema sigue, escríbenos.');
        return;
      }
      S.datos = r[0].data();
      S.publico = r[1].exists ? r[1].data() : {};
      aplicarContenido(r[2].exists ? r[2].data() : {});
      S.lecturas = {};
      r[3].forEach(function (d) { S.lecturas[d.id] = true; });
      trasCarga(arrancarApp);
    }).catch(function (e) {
      console.error(e);
      pintarMensaje('No pudimos cargar tus datos', 'Revisa tu conexión a internet e intenta de nuevo.');
    });
  }

  /* Anuncios, avisos y preguntas (se editan en el panel de administrador) */
  function hoyISO() {
    var d = new Date(), z = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }
  function vigente(it) {
    var h = hoyISO();
    return it && it.activo !== false && (!it.desde || h >= it.desde) && (!it.hasta || h <= it.hasta);
  }
  function aplicaAviso(a, d) {
    switch (a.paraQuien) {
      case 'NO HABILITADOS': return d.habilitado === false;
      case 'SIN POLIZA': return !d.poliza;
      case 'CON PENDIENTES': return (d.pendientes || []).length > 0;
      case 'IDS': return String(a.ids || '').split(/[,;\s]+/).some(function (x) { return x && idSeguro(x).toUpperCase() === idSeguro(d.id).toUpperCase(); });
      default: return true;
    }
  }
  function aplicarContenido(c) {
    S.contenido = c || {};
    S.publico = S.publico || {};
    S.publico.anuncios = (S.contenido.anuncios || []).filter(function (a) { return vigente(a) && a.imagen; })
      .sort(function (a, b) { return (a.orden || 999) - (b.orden || 999); });
    var cats = [], porCat = {};
    (S.contenido.preguntas || []).forEach(function (q) {
      if (!vigente(q) || !q.p || !q.r) return;
      var c = q.categoria || 'General';
      if (!porCat[c]) { porCat[c] = []; cats.push(c); }
      porCat[c].push(q);
    });
    S.publico.preguntas = cats.map(function (c) {
      return { nombre: c, preguntas: porCat[c].sort(function (a, b) { return (a.orden || 999) - (b.orden || 999); }).map(function (q) { return { p: q.p, r: q.r }; }) };
    });
    var peso = { URGENTE: 0, IMPORTANTE: 1, INFO: 2 };
    if (S.datos) S.datos.avisos = (S.contenido.avisos || []).filter(function (a) { return vigente(a) && aplicaAviso(a, S.datos); })
      .sort(function (a, b) { return (peso[a.tipo] == null ? 2 : peso[a.tipo]) - (peso[b.tipo] == null ? 2 : peso[b.tipo]); });
  }

  function pintarMensaje(titulo, texto) {
    clearInterval(cargaPaso); cargaDesde = 0;
    app.innerHTML = '<div class="nm-pantalla"><div class="nm-patron" aria-hidden="true"></div>' +
      '<img src="marca/logos/nummeros-logotipo-apilado-' + (S.oscuro ? 'claro' : 'principal') + '.svg" alt="NUMMEROS">' +
      '<div style="max-width:380px"><div class="nm-login-titulo">' + esc(titulo) + '</div><p class="muted" style="margin-top:6px">' + esc(texto) + '</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' +
      '<button class="btn" data-accion="recargar">Intentar de nuevo</button>' +
      '<a class="btn sec" href="' + wa(C.whatsappGeneral, 'Hola, no puedo ver mis datos en el Portal CONTAX.') + '" target="_blank" rel="noopener">Escribir por WhatsApp</a>' +
      '<button class="btn sec" data-accion="salir">Salir</button></div></div>';
  }

  /* ══════════ INICIO DE SESIÓN ══════════ */
  /* Fotografía oficial "Los clásicos de los números" (las mismas del manual de marca) */
  var P_ = { nombre: 'Pitágoras', rasgo: 'Los números del día a día' }, E_ = { nombre: 'Euclides', rasgo: 'El orden' }, A_ = { nombre: 'Arquímedes', rasgo: 'El equilibrio' };
  function foto(img, quien, frase, pos) { return { img: img, nombre: quien.nombre, rasgo: quien.rasgo, frase: frase, pos: pos }; }
  var FOTOS = [
    foto('pitagoras-tablet', P_, 'Tus pagos de cada semana, siempre al día.', '50% 30%'),
    foto('pitagoras-celular', P_, 'Tus números, desde el celular.', '68% 30%'),
    foto('pitagoras-senalando', P_, 'Aquí está todo lo que te toca cobrar.', '75% 22%'),
    foto('pitagoras-inventario', P_, 'Cada semana registrada, en su lugar.', '62% 30%'),
    foto('euclides-laptop', E_, 'Tus facturas y trámites, bien ordenados.', '55% 30%'),
    foto('euclides-lentes', E_, 'Revisamos cada factura con lupa.', '58% 22%'),
    foto('euclides-compas', E_, 'Mira cómo crecen tus cobros.', '72% 40%'),
    foto('euclides-caminando', E_, 'Tu portal te acompaña a donde vayas.', '50% 22%'),
    foto('arquimedes-balanza', A_, 'Lo que facturas y lo que cobras, cuadrado.', '50% 30%'),
    foto('arquimedes-cafeteria', A_, 'Cuentas claras en cada venta.', '62% 35%'),
    foto('los-tres-reunion', { nombre: 'Los clásicos', rasgo: 'Los tres juntos' }, 'Trabajando para que tus números cuadren.', '50% 40%')
  ];
  var FOTOS_OSCURO = [
    foto('arquimedes-pensando', A_, 'Lo que facturas y lo que cobras, cuadrado.', '62% 30%'),
    foto('arquimedes-eureka', A_, '¡Eureka! Tu pago ya está registrado.', '72% 40%')
  ];
  /* 4 fotos al azar para la pantalla de ingreso (el carrusel rota 4) */
  function fotosAlAzar(lista, n) {
    var l = lista.slice();
    for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = l[i]; l[i] = l[j]; l[j] = t; }
    while (l.length < n) l = l.concat(l);
    return l.slice(0, n);
  }
  function insignia(p) {
    return '<div class="nm-nombre"><i><img src="marca/logos/nummeros-isotipo-blanco.svg" alt=""></i>' + p.nombre + '<span>' + p.rasgo + '</span></div>';
  }

  function pintarLogin(error) {
    pararCarrusel();
    var fotos = fotosAlAzar(S.oscuro ? FOTOS_OSCURO : FOTOS, 4);
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
            '<p class="nm-login-ayuda"><button type="button" class="enlace" data-accion="sinid">No sé mi ID de Yango</button> · <a href="' + wa(C.whatsappGeneral, 'Hola, no puedo entrar al Portal CONTAX.') + '" target="_blank" rel="noopener">Otro problema para entrar</a></p>' +
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
    if (window.NM_CHAT) window.NM_CHAT.quitar();
    if (window.NM_FACTURAS) window.NM_FACTURAS.salir();
    S.datos = null; S.avisosVistos = false;
    if (DEMO) { guardar('nm_demo_sesion', '0'); pintarLogin(); return; }
    auth.signOut();
  }

  /* ══════════ ESTRUCTURA DE LA APP ══════════ */
  var MENU = [
    { sec: 'Mis pagos' },
    { id: 'inicio', t: 'Inicio', i: 'inicio' },
    { id: 'pendientes', t: 'Pendientes', i: 'pendientes' },
    { id: 'facturas', t: 'Mis facturas', i: 'doc' },
    { id: 'historial', t: 'Historial', i: 'historial' },
    { id: 'reporte', t: 'Reporte', i: 'resumen' },
    { sec: 'Ayuda' },
    { id: 'tramites', t: 'Mis trámites', i: 'tramites' },
    { id: 'servicios', t: 'Ayuda con tu facturación', i: 'factura', seccion: 'servicios' },
    { id: 'tutoriales', t: 'Tutoriales', i: 'video', seccion: 'tutoriales' },
    { id: 'preguntas', t: 'Preguntas', i: 'preguntas' },
    { id: 'contacto', t: 'Contacto', i: 'contacto' },
    { id: 'notificaciones', t: 'Notificaciones', i: 'campana' },
    { id: 'instalar', t: 'Instalar en el celular', i: 'instalar' }
  ];
  var TABS = [
    { id: 'inicio', t: 'Inicio', i: 'inicio' },
    { id: 'pendientes', t: 'Pendientes', i: 'pendientes' },
    { id: 'facturas', t: 'Facturas', i: 'doc' },
    { id: 'tramites', t: 'Trámites', i: 'tramites' },
    { id: 'mas', t: 'Más', i: 'mas' }
  ];

  var MENU_ADMIN = [
    { sec: 'Administración' },
    { id: 'admin', t: 'Panel', i: 'panel' },
    { id: 'admin-anuncios', t: 'Anuncios', i: 'imagen' },
    { id: 'admin-avisos', t: 'Avisos', i: 'megafono' },
    { id: 'admin-preguntas', t: 'Preguntas', i: 'preguntas' },
    { id: 'admin-registros', t: 'Chats y lecturas', i: 'chat' }
  ];
  function seccionVisible(k) { return !k || (C.secciones && C.secciones[k]) || S.admin; }
  function seccionOculta(k) { return k && !(C.secciones && C.secciones[k]); }
  function menu() {
    var m = MENU.filter(function (x) { return seccionVisible(x.seccion); });
    return S.admin ? m.concat(MENU_ADMIN) : m;
  }

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
        '<span class="hdr-emp"><b>Portal CONTAX</b>' + (S.admin ? 'Administrador' : esc(d.nombre || '') + ' · ID ' + esc(d.id || '')) + '</span></button>' +
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
      '<nav class="tabbar" id="tabbar" aria-label="Menú"></nav>' +
      /* Franja con nombre completo e ID: así CONTAX sabe quién es cuando envían una captura */
      '<div class="id-movil" aria-label="Tus datos">' + (S.admin ? '<b>ADMINISTRADOR</b>' :
        '<b>' + esc(String(d.nombre || '').toUpperCase()) + '</b><span>ID ' + esc(d.id || '') + '</span>') + '</div>';
    var h = (location.hash || '').replace('#/', '');
    if (h === 'resumen') h = 'reporte';
    if (S.admin && !window.NM_ADMIN) { cargarScript('admin.js?v=' + C.version, function () { ir(PAGINAS[h] ? h : 'admin', true); }); }
    ir(PAGINAS[h] ? h : 'inicio', true);
    if (window.NM_CHAT && ((C.ia && C.ia.url) || DEMO)) window.NM_CHAT.montar();
    if (window.NM_NOTIF) setTimeout(window.NM_NOTIF.renovar, 2500);
    if (S.datos.id === C.accesoAdmin && !S.admin && !S.adminPreguntado && !DEMO) { S.adminPreguntado = true; setTimeout(preguntarAdmin, 300); return; }
    if (!S.avisosVistos && !S.admin) { S.avisosVistos = true; setTimeout(mostrarAvisos, 500); }
  }

  function cargarScript(src, listo) {
    var s = document.createElement('script');
    s.src = src; s.onload = listo || null;
    s.onerror = function () { aviso('No se pudo cargar una parte del portal. Revisa tu conexión.'); };
    document.head.appendChild(s);
  }

  /* Clave extra: solo aparece para el usuario de prueba */
  function preguntarAdmin() {
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<form class="modal-caja" role="dialog" aria-modal="true" aria-labelledby="admTit" novalidate>' +
      '<div class="modal-cab"><div class="nm-patron oscuro" aria-hidden="true"></div>' +
        '<div class="modal-fila"><img class="iso" src="marca/logos/nummeros-isotipo-blanco.svg" alt=""><span class="modal-chip">' + ic('candado') + 'Acceso restringido</span></div>' +
        '<h3 id="admTit">Clave de administrador</h3></div>' +
      '<div class="modal-cuerpo"><p>Si tienes la clave, escríbela para editar anuncios, avisos y preguntas. Si no, sigue como usuario de prueba.</p>' +
        '<div class="fm-campo"><label for="admClave">Clave</label><input id="admClave" type="password" autocomplete="current-password" required></div>' +
        '<div class="nm-login-err" id="admErr" role="alert"></div></div>' +
      '<div class="modal-pie"><button type="button" class="btn sec" data-seguir>Seguir sin clave</button><button class="btn" type="submit" id="admBtn">Entrar</button></div>' +
      '<div class="modal-firma"><b>CONTAX · NUMMEROS</b><span>Panel de administrador</span></div></form>';
    document.body.appendChild(m);
    var inp = m.querySelector('#admClave');
    inp.focus();
    m.querySelector('[data-seguir]').addEventListener('click', function () {
      m.remove(); if (!S.avisosVistos) { S.avisosVistos = true; mostrarAvisos(); }
    });
    m.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var err = m.querySelector('#admErr'), btn = m.querySelector('#admBtn');
      if (!inp.value) { err.textContent = 'Escribe la clave.'; return; }
      btn.disabled = true; btn.textContent = 'Verificando…'; err.textContent = '';
      auth.signInWithEmailAndPassword(C.correoAdmin, inp.value).then(function () {
        m.remove();   // onAuthStateChanged recarga el portal en modo administrador
      }, function (ex) {
        btn.disabled = false; btn.textContent = 'Entrar';
        err.textContent = /too-many/.test(ex && ex.code) ? 'Demasiados intentos. Espera unos minutos.' : 'Clave incorrecta.';
        inp.value = ''; inp.focus();
      });
    });
  }

  function pintarMenus() {
    var n = cuentas();
    document.getElementById('nav').innerHTML = menu().map(function (m) {
      if (m.sec) return '<span class="nav-sec">' + m.sec + '</span>';
      var c = n[m.id] ? '<span class="cuenta">' + n[m.id] + '</span>' : '';
      if (seccionOculta(m.seccion)) c = '<span class="cuenta oculta">Oculta</span>';
      return '<button class="nav-link' + (S.pagina === m.id ? ' active' : '') + '" data-ir="' + m.id + '">' + ic(m.i) + '<span>' + m.t + '</span>' + c + '</button>';
    }).join('') +
      '<div class="nav-pie"><img src="marca/logos/nummeros-logotipo-firma-' + (S.oscuro ? 'claro' : 'principal') + '.svg" alt="NUMMEROS by CONTAX">Portal CONTAX · v' + esc(C.version) + '</div>';
    var enMas = ['historial', 'reporte', 'preguntas', 'contacto', 'notificaciones', 'instalar', 'servicios', 'tutoriales'].indexOf(S.pagina) >= 0 || /^admin/.test(S.pagina);
    document.getElementById('tabbar').innerHTML = TABS.map(function (t) {
      var on = t.id === S.pagina || (t.id === 'mas' && enMas);
      return '<button class="' + (on ? 'on' : '') + '" ' + (t.id === 'mas' ? 'data-accion="mas"' : 'data-ir="' + t.id + '"') + '><i>' + ic(t.i) + '</i>' + t.t + '</button>';
    }).join('');
  }

  function ir(p, sinHistorial) {
    if (!PAGINAS[p]) p = 'inicio';
    if ((p === 'servicios' || p === 'tutoriales') && !seccionVisible(p)) p = 'inicio';
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
            '<button class="nm-kpi" data-ir="reporte"><small>Total cobrado</small><b>' + bs(pag.total) + '</b><em>' + pag.cantidad + ' pago' + (pag.cantidad === 1 ? '' : 's') + '</em></button>' +
          '</div>' +
        '</section>' +
        (function () {
          // Una escultura distinta cada vez que entra
          var lista = S.oscuro ? FOTOS_OSCURO : FOTOS, f = lista[Math.floor(Math.random() * lista.length)];
          return '<figure class="nm-inicio-foto"><img src="marca/clasicos/' + f.img + '.jpg"' + (f.pos ? ' style="object-position:' + f.pos + '"' : '') + ' alt="' + f.nombre + ', escultura griega de mármol">' +
            '<figcaption>' + insignia(f) + '<div class="nm-frase">' + f.frase + '</div></figcaption></figure>';
        })() +
      '</div>' +
      (window.NM_NOTIF ? window.NM_NOTIF.tarjeta() : '') +
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
  DESPUES.inicio = function () { pintarCarrusel(); animarCifras(document.getElementById('pagina')); };

  PAGINAS.pendientes = function () {
    var d = S.datos, lista = d.pendientes || [], r = (d.resumen || {}).pendientes || { total: 0 };
    return titulo('Pagos pendientes', 'Semanas registradas que todavía no fueron abonadas.') +
      alertaHabilitacion() +
      '<div class="grid2">' +
        '<div class="card"><div class="h2">Datos para facturar</div>' +
          '<div class="dato"><span>Razón social</span><div><b>' + esc(C.facturacion.razonSocial) + '</b><button class="copiar" data-copiar="' + esc(C.facturacion.razonSocial) + '">Copiar</button></div></div>' +
          '<div class="dato"><span>NIT</span><div><b class="num">' + esc(C.facturacion.nit) + '</b><button class="copiar" data-copiar="' + esc(C.facturacion.nit) + '">Copiar</button></div></div>' +
          '<div style="margin-top:14px"><button class="btn ancho" data-ir="facturas">' + ic('doc') + 'Subir mi factura en PDF</button></div>' +
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
                '<td data-et="Estado">' + chipPendiente(p.estado) + '</td><td class="monto" data-et="Importe">' + bs(p.importe) + '</td></tr>';
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

  /* ── Cifras que giran como un contador y se detienen en el valor real ── */
  var CIFRAS_MS = 3000;
  function animarCifras(cont) {
    if (!cont || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var tira = ''; for (var v = 0; v < 3; v++) for (var d = 0; d < 10; d++) tira += d + '<br>';
    cont.querySelectorAll('.nm-kpi b').forEach(function (b) {
      var real = b.textContent;
      if (!/\d/.test(real)) return;
      var n = 0, html = '';
      for (var i = 0; i < real.length; i++) {
        var c = real.charAt(i);
        if (/\d/.test(c)) html += '<span class="nm-rod"><span class="nm-tira" data-d="' + c + '" style="transition-duration:' + (CIFRAS_MS - 700 + (n++ % 4) * 230) + 'ms">' + tira + '</span></span>';
        else html += '<span class="nm-sep">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>';
      }
      b.setAttribute('aria-label', real);
      b.classList.add('nm-cifra');
      b.innerHTML = html;
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        b.querySelectorAll('.nm-tira').forEach(function (t) { t.style.transform = 'translateY(-' + ((20 + Number(t.getAttribute('data-d'))) * 1.1).toFixed(2) + 'em)'; });
      }); });
      setTimeout(function () { if (document.body.contains(b)) { b.textContent = real; b.classList.remove('nm-cifra'); b.removeAttribute('aria-label'); } }, CIFRAS_MS + 250);
    });
  }

  /* ── Reporte completo (se descarga en PDF con reporte.js) ── */
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var PERIODOS = [['todo', 'Todo'], ['anio', 'Este año'], ['6m', 'Últimos 6 meses'], ['3m', 'Últimos 3 meses']];
  function fechaDe(t) {
    var m = String(t || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return null;
    return new Date(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }
  function datosReporte(periodo) {
    var d = S.datos || {}, hoy = new Date(), desde = null;
    if (periodo === 'anio') desde = new Date(hoy.getFullYear(), 0, 1);
    if (periodo === '6m') desde = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);
    if (periodo === '3m') desde = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
    var hist = (d.historial || []).filter(function (p) { var f = fechaDe(p.fechaPago); return !desde || (f && f >= desde); });
    var total = hist.reduce(function (s, p) { return s + (numero(p.importe) || 0); }, 0);
    var mejor = hist.reduce(function (m, p) { return !m || (numero(p.importe) || 0) > (numero(m.importe) || 0) ? p : m; }, null);
    var porMes = {}, orden = [];
    hist.forEach(function (p) {
      var f = fechaDe(p.fechaPago); if (!f) return;
      var k = f.getFullYear() + '-' + (f.getMonth() < 9 ? '0' : '') + (f.getMonth() + 1);
      if (!porMes[k]) { porMes[k] = { clave: k, nombre: MESES[f.getMonth()] + ' ' + f.getFullYear(), corto: MESES[f.getMonth()].slice(0, 3) + ' ' + String(f.getFullYear()).slice(2), pagos: 0, total: 0 }; orden.push(k); }
      porMes[k].pagos++; porMes[k].total += numero(p.importe) || 0;
    });
    var meses = orden.sort().map(function (k) { return porMes[k]; });
    var pend = d.pendientes || [];
    return {
      periodo: periodo, nombrePeriodo: (PERIODOS.filter(function (x) { return x[0] === periodo; })[0] || PERIODOS[0])[1],
      desde: desde, hasta: hoy, datos: d, historial: hist, meses: meses, pendientes: pend, tramites: d.tramites || [],
      total: total, cantidad: hist.length, promedio: hist.length ? total / hist.length : null, mejor: mejor,
      totalPendiente: pend.reduce(function (s, p) { return s + (numero(p.importe) || 0); }, 0),
      sincronizado: ultimaSync()
    };
  }
  PAGINAS.reporte = function () {
    var R = datosReporte(S.periodo || 'todo'), d = R.datos;
    var fila = function (k, v) { return '<div class="dato"><span>' + k + '</span><div><b>' + v + '</b></div></div>'; };
    return titulo('Reporte', 'Toda tu información con CONTAX en un solo lugar.',
        '<button class="btn" data-accion="pdf">' + ic('descargar') + 'Descargar PDF</button>') +
      '<div class="segmento" role="tablist" aria-label="Período del reporte">' + PERIODOS.map(function (p) {
        return '<button role="tab" aria-selected="' + (R.periodo === p[0]) + '" class="' + (R.periodo === p[0] ? 'on' : '') + '" data-periodo="' + p[0] + '">' + p[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="grid2">' +
        '<div class="card"><div class="h2">Mis datos</div>' +
          fila('Nombre', esc(d.nombre)) + fila('ID de Yango', '<span class="num">' + esc(d.id) + '</span>') +
          fila('Celular', '<span class="num">' + esc(telVisible(d.celular || '')) + '</span>') +
          fila('Pago habilitado por la app', d.habilitado === false ? '<span class="chip mal">No habilitado</span>' : '<span class="chip ok">Habilitado</span>') +
          fila('Póliza de seguro', d.poliza ? '<span class="chip ok">Presentada</span>' : '<span class="chip pend">No presentada</span>') +
        '</div>' +
        '<div class="nm-kpis rep-kpis">' +
          '<div class="nm-kpi"><small>Total cobrado</small><b>' + bs(R.total) + '</b><em>' + esc(R.nombrePeriodo.toLowerCase()) + '</em></div>' +
          '<div class="nm-kpi"><small>Pagos recibidos</small><b class="num">' + R.cantidad + '</b><em>semanas pagadas</em></div>' +
          '<div class="nm-kpi"><small>Promedio por pago</small><b>' + bs(R.promedio) + '</b><em>' + (R.mejor ? 'mejor: ' + bs(R.mejor.importe) : 'sin pagos aún') + '</em></div>' +
          '<div class="nm-kpi"><small>Por cobrar</small><b>' + bs(R.totalPendiente) + '</b><em>' + R.pendientes.length + ' semana' + (R.pendientes.length === 1 ? '' : 's') + '</em></div>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="h2">Cobrado por mes <small>' + esc(R.nombrePeriodo) + '</small></div>' +
        (R.meses.length ? '<div class="grafico"><canvas id="grafico" aria-label="Gráfico de lo cobrado por mes"></canvas></div>' +
          '<div class="tabla-caja tabla-movil" style="margin-top:14px"><table><thead><tr><th>Mes</th><th class="num">Pagos</th><th class="monto">Total</th></tr></thead><tbody>' +
          R.meses.slice().reverse().map(function (m) { return '<tr><td data-et="Mes"><b>' + m.nombre + '</b></td><td data-et="Pagos" class="num">' + m.pagos + '</td><td class="monto" data-et="Total">' + bs(m.total) + '</td></tr>'; }).join('') +
          '</tbody></table></div>'
        : vacio('No hay pagos en este período', 'Prueba con "Todo".')) +
      '</div>' +
      '<div class="card"><div class="h2">Pagos pendientes <small>' + R.pendientes.length + '</small></div>' +
        (R.pendientes.length ? '<div class="tabla-caja tabla-movil"><table><thead><tr><th>Semana</th><th>Período</th><th>Estado</th><th class="monto">Importe</th></tr></thead><tbody>' +
          R.pendientes.map(function (p) { return '<tr><td data-et="Semana" class="num"><b>' + esc(p.semana) + '</b></td><td data-et="Período">' + esc(p.rango) + '</td><td data-et="Estado">' + chipPendiente(p.estado) + '</td><td class="monto" data-et="Importe">' + bs(p.importe) + '</td></tr>'; }).join('') +
          '</tbody><tfoot><tr><td colspan="3">Total por cobrar</td><td class="monto" data-et="Total por cobrar">' + bs(R.totalPendiente) + '</td></tr></tfoot></table></div>'
          : vacio('No tienes pagos pendientes')) +
      '</div>' +
      '<div class="card"><div class="h2">Pagos recibidos <small>' + R.cantidad + '</small></div>' +
        (R.cantidad ? '<div class="tabla-caja tabla-movil"><table><thead><tr><th>Fecha de pago</th><th>Semana</th><th>Período</th><th class="monto">Importe</th></tr></thead><tbody>' +
          R.historial.map(function (p) { return '<tr><td data-et="Fecha de pago"><b>' + esc(p.fechaPago) + '</b></td><td data-et="Semana" class="num">' + esc(p.semana) + '</td><td data-et="Período">' + esc(p.rango) + '</td><td class="monto" data-et="Importe">' + bs(p.importe) + '</td></tr>'; }).join('') +
          '</tbody><tfoot><tr><td colspan="3">Total cobrado</td><td class="monto" data-et="Total cobrado">' + bs(R.total) + '</td></tr></tfoot></table></div>'
          : vacio('No hay pagos en este período')) +
      '</div>' +
      '<div class="card"><div class="h2">Trámites <small>' + R.tramites.length + '</small></div>' +
        (R.tramites.length ? '<div class="tabla-caja tabla-movil"><table><thead><tr><th>Número</th><th>Tipo</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>' +
          R.tramites.map(function (t) { return '<tr><td data-et="Número"><b class="num">' + esc(t.numero) + '</b></td><td data-et="Tipo">' + esc(t.tipo) + '</td><td data-et="Fecha">' + esc(String(t.fecha || '').slice(0, 10)) + '</td><td data-et="Estado">' + chipEstado(t) + '</td></tr>'; }).join('') +
          '</tbody></table></div>' : vacio('No tienes trámites')) +
      '</div>';
  };
  DESPUES.reporte = function () {
    animarCifras(document.getElementById('pagina'));
    var R = datosReporte(S.periodo || 'todo');
    var cv = document.getElementById('grafico');
    if (!cv || !R.meses.length) return;
    function dibujar() {
      if (!window.Chart) { setTimeout(dibujar, 300); return; }
      if (!document.body.contains(cv)) return;
      var css = getComputedStyle(document.body);
      var suave = css.getPropertyValue('--nm-suave').trim(), borde = css.getPropertyValue('--nm-borde').trim();
      S.grafico = new Chart(cv, {
        type: 'bar',
        data: {
          labels: R.meses.map(function (m) { return m.corto; }),
          datasets: [{ label: 'Cobrado', data: R.meses.map(function (m) { return Math.round(m.total * 100) / 100; }),
            backgroundColor: S.oscuro ? '#8EB69B' : '#235347', borderRadius: 6, maxBarThickness: 42 }]
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
  /* Estado de un pago pendiente (sin emojis, con color) */
  function chipPendiente(e) {
    e = String(e || '').replace(/[\u2600-\u27BF\uFE0F\u200D]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '').trim() || 'Pendiente';
    var u = e.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var c = /RETEN|RECHAZ|FALTA|NO HABIL|OBSERV|ANULAD/.test(u) ? 'mal' : (/HABILITAD|APROBAD|RECIBID|PAGAD|LISTO/.test(u) ? 'ok' : 'pend');
    return '<span class="chip ' + c + '">' + esc(e) + '</span>';
  }
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

  /* ── Ayuda con tu facturación (servicios de CONTAX) ── */
  function marcaOculta(k) { return seccionOculta(k) ? '<div class="aviso alerta">' + ic('candado') + '<div><b>Vista previa: esta pestaña está oculta para los repartidores</b>Cuando esté lista, se publica cambiando secciones.' + k + ' a true en config.js.</div></div>' : ''; }
  var PLANES = [
    { id: 'facturacion', nombre: 'Facturación semanal', resumen: 'Nosotros emitimos tus facturas cada semana. Tú solo cobras.',
      incluye: ['Emitimos tu factura a Milthagor con el monto exacto de cada semana', 'La enviamos por ti, sin plazos perdidos', 'Te avisamos cuando está emitida', 'Guardamos tus facturas como respaldo'] },
    { id: 'completo', nombre: 'Servicio completo', destacado: true, resumen: 'Facturación + declaraciones de impuestos. Te olvidas de todo.',
      incluye: ['Todo lo del plan de Facturación semanal', 'Declaraciones mensuales de impuestos (IVA e IT)', 'Control de vencimientos para evitar multas', 'Atención prioritaria por WhatsApp'] }
  ];
  PAGINAS.servicios = function () {
    var d = S.datos || {};
    function pedir(plan) { return wa(C.whatsappGeneral, 'Hola CONTAX, soy ' + (d.nombre || '') + ' (ID ' + (d.id || '') + '). Quiero información del servicio "' + plan + '".'); }
    return marcaOculta('servicios') + titulo('Ayuda con tu facturación', 'Deja tus facturas e impuestos en manos de CONTAX y dedícate a repartir.') +
      '<section class="srv-hero"><div class="nm-patron oscuro" aria-hidden="true"></div><div class="srv-hero-txt"><small>CONTAX · Consultora contable</small>' +
        '<h2>¿Se te pasa el jueves sin enviar tu factura?</h2><p>Si no facturas a tiempo, tu pago se corre a la semana siguiente. Con nuestro servicio, tus facturas salen siempre a tiempo.</p></div></section>' +
      '<div class="srv-planes">' + PLANES.map(function (p) {
        return '<article class="srv-plan' + (p.destacado ? ' destacado' : '') + '">' + (p.destacado ? '<span class="srv-tag">Recomendado</span>' : '') +
          '<h3>' + p.nombre + '</h3><p class="muted">' + p.resumen + '</p><div class="srv-precio">Consulta el precio</div>' +
          '<ul>' + p.incluye.map(function (x) { return '<li>' + ic('check') + '<span>' + x + '</span></li>'; }).join('') + '</ul>' +
          '<a class="btn ' + (p.destacado ? '' : 'sec') + ' ancho" href="' + pedir(p.nombre) + '" target="_blank" rel="noopener">' + ic('whatsapp') + 'Quiero este servicio</a></article>';
      }).join('') + '</div>' +
      '<div class="card"><div class="h2">¿Aún no tienes NIT?</div><p style="margin-bottom:14px">Te ayudamos a sacar tu <b>NIT</b>, tu <b>Matrícula de Comercio</b> y tu <b>ROE</b> para que puedas facturar.</p>' +
        '<a class="btn sec" href="' + pedir('Trámite de NIT, Matrícula y ROE') + '" target="_blank" rel="noopener">' + ic('whatsapp') + 'Quiero sacar mi NIT</a></div>';
  };

  /* ── Tutoriales (videos e imágenes) ── */
  var TUTORIALES = [
    { titulo: 'Cómo entrar al portal', texto: 'Con tu celular y tu ID de Yango.', tipo: 'Video' },
    { titulo: 'Instala el portal en tu celular', texto: 'Tenlo como una app más, en iPhone o Android.', tipo: 'Video' },
    { titulo: 'Activa las notificaciones', texto: 'Para enterarte cuando se carga tu semana.', tipo: 'Imágenes' },
    { titulo: 'Cómo emitir tu factura en el SIAT', texto: 'Paso a paso, a Milthagor S.R.L., NIT 550276028.', tipo: 'Video' },
    { titulo: 'Cómo pedir soporte por un pago', texto: 'Abre un trámite y sigue su respuesta.', tipo: 'Imágenes' },
    { titulo: 'Descarga tu reporte en PDF', texto: 'Todos tus pagos en un documento.', tipo: 'Imágenes' }
  ];
  function videoEmbebido(url) {
    var m = String(url || '').match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/);
    return m ? '<iframe src="https://www.youtube-nocookie.com/embed/' + m[1] + '" title="Video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe>' : '';
  }
  PAGINAS.tutoriales = function () {
    var lista = (S.contenido && S.contenido.tutoriales && S.contenido.tutoriales.length) ? S.contenido.tutoriales.filter(vigente) : TUTORIALES;
    return marcaOculta('tutoriales') + titulo('Tutoriales', 'Aprende a usar el portal y a facturar, en videos cortos e imágenes.') +
      '<div class="tut-grid">' + lista.map(function (t) {
        var media = videoEmbebido(t.video) || (t.imagen ? '<img src="' + esc(t.imagen) + '" alt="" loading="lazy">' : '<div class="tut-pronto">' + ic(t.tipo === 'Imágenes' ? 'imagen' : 'video') + '<span>Próximamente</span></div>');
        return '<article class="tut"><div class="tut-media">' + media + '</div><div class="tut-txt"><span class="chip neutro">' + esc(t.tipo || (t.video ? 'Video' : 'Imágenes')) + '</span><b>' + esc(t.titulo) + '</b><p class="muted">' + esc(t.texto || '') + '</p></div></article>';
      }).join('') + '</div>';
  };

  /* ── Contacto ── */
  PAGINAS.contacto = function () {
    return titulo('Contacto', 'Estamos para ayudarte.') +
      '<div class="grid2">' +
        '<div class="wa-card"><span class="et">Consultas</span><span class="tel">' + telVisible(C.whatsappGeneral) + '</span>' +
          '<p class="muted">Dudas sobre tus pagos, trámites, NIT, Matrícula de Comercio o ROE.</p>' +
          '<a class="btn wa" href="' + wa(C.whatsappGeneral, 'Hola CONTAX, soy ' + (S.datos.nombre || '') + ' (ID ' + (S.datos.id || '') + ').') + '" target="_blank" rel="noopener">' + ic('whatsapp') + 'Escribir por WhatsApp</a></div>' +
        '<div class="wa-card"><span class="et">Facturas</span><span class="tel">Desde el portal</span>' +
          '<p class="muted">Las facturas se suben en PDF en <b>Mis facturas</b>. Ahí ves al instante si fue aprobada u observada.</p>' +
          '<button class="btn sec" data-ir="facturas">' + ic('doc') + 'Subir factura</button></div>' +
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

  /* Botón ocupado: anillo que gira con la N al centro y el texto "Descargando" (mínimo 2 segundos) */
  function anilloBoton(btn, texto) {
    var original = btn.innerHTML;
    btn.disabled = true; btn.classList.add('ocupado');
    btn.innerHTML = '<span class="nm-anillo nm-anillo-chico"><svg class="nm-giro" viewBox="0 0 36 36" aria-hidden="true">' +
      '<circle class="nm-pista" cx="18" cy="18" r="15.9"></circle><circle class="nm-arco" cx="18" cy="18" r="15.9"></circle></svg>' +
      '<span class="nm-n-centro"><svg viewBox="0 0 546 728" aria-hidden="true"><path d="' + N_PATH + '"></path></svg></span></span>' + esc(texto || 'Descargando');
    var desde = Date.now();
    return function listo() {
      setTimeout(function () { btn.disabled = false; btn.classList.remove('ocupado'); btn.innerHTML = original; }, Math.max(0, 2000 - (Date.now() - desde)));
    };
  }
  function descargarPDF(btn) {
    var R = datosReporte(S.periodo || 'todo');
    var listo = anilloBoton(btn, 'Descargando'), desde = Date.now();
    function generar() {
      // La animación dura al menos 2 segundos antes de bajar el archivo
      setTimeout(function () {
        window.NM_PDF.generar(R, API).then(listo, function (e) { console.error(e); listo(); aviso('No se pudo generar el PDF. Intenta de nuevo.'); });
      }, Math.max(0, 1700 - (Date.now() - desde)));
    }
    if (window.NM_PDF) generar(); else cargarScript('reporte.js?v=' + C.version, generar);
  }

  /* ── Hoja "Más" del celular ── */
  function abrirMas() {
    var h = document.createElement('div');
    h.className = 'hoja-mas'; h.id = 'hojaMas';
    h.innerHTML = '<div class="fondo" data-accion="cerrarMas"></div><div class="hoja" role="dialog" aria-label="Más opciones"><div class="agarre"></div>' +
      [['historial', 'Historial', 'historial'], ['reporte', 'Reporte', 'resumen'], ['servicios', 'Ayuda con tu facturación', 'factura', 'servicios'], ['tutoriales', 'Tutoriales', 'video', 'tutoriales'], ['preguntas', 'Preguntas', 'preguntas'], ['contacto', 'Contacto', 'contacto'], ['notificaciones', 'Notificaciones', 'campana'], ['instalar', 'Instalar en el celular', 'instalar']].map(function (m) {
        if (!seccionVisible(m[3])) return '';
        return '<button class="nav-link" data-ir="' + m[0] + '">' + ic(m[2]) + '<span>' + m[1] + '</span>' + (seccionOculta(m[3]) ? '<span class="cuenta oculta">Oculta</span>' : '') + '</button>';
      }).join('') +
      (S.admin ? '<span class="nav-sec">Administración</span>' + MENU_ADMIN.slice(1).map(function (m) {
        return '<button class="nav-link" data-ir="' + m.id + '">' + ic(m.i) + '<span>' + m.t + '</span></button>';
      }).join('') : '') +
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
      '<div class="modal-cab ' + tipo + '"><div class="nm-patron oscuro" aria-hidden="true"></div>' +
        '<div class="modal-fila"><img class="iso" src="marca/logos/nummeros-isotipo-blanco.svg" alt="">' +
        '<span class="modal-chip">' + ic(tipo === 'INFO' ? 'info' : 'alerta') + nombres[tipo] + '</span>' +
        (obligado ? '' : '<button class="modal-x" aria-label="Cerrar" data-cerrar>×</button>') + '</div>' +
        '<h3 id="avisoTit">' + esc(a.titulo || nombres[tipo]) + '</h3></div>' +
      (a.imagen ? '<img src="' + esc(a.imagen) + '" alt="">' : '') +
      (a.mensaje ? '<div class="modal-cuerpo">' + formatoAviso(a.mensaje) + '</div>' : '') +
      '<div class="modal-pie">' + (a.botonLink ? '<a class="btn sec" href="' + esc(a.botonLink) + '" target="_blank" rel="noopener">' + esc(a.botonTexto || 'Ver más') + '</a>' : '') +
      '<button class="btn" data-ok>Entendido</button></div>' +
      '<div class="modal-firma"><b>CONTAX · NUMMEROS</b><span>' + (cola.length > 1 ? 'Aviso ' + (i + 1) + ' de ' + cola.length : 'Comunicado oficial') + '</span></div></div>';
    document.body.appendChild(m);
    function cerrar(confirmo) {
      if (confirmo || a.frecuencia === 'UNA VEZ') {
        vistos[a.codigo] = Date.now();
        guardar('nm_avisos_' + (S.datos.id || ''), JSON.stringify(vistos));
      }
      if (confirmo && a.frecuencia !== 'CADA INGRESO' && !DEMO && !S.admin && !a.previa) {
        db.collection('repartidores').doc(S.usuario.uid).collection('lecturas').doc(a.codigo)
          .set({ fecha: firebase.firestore.FieldValue.serverTimestamp(), titulo: String(a.titulo || '').slice(0, 200),
            codigo: a.codigo, id: String(S.datos.id || ''), nombre: String(S.datos.nombre || '').slice(0, 120) })
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
    var per = e.target.closest('[data-periodo]');
    if (per) { S.periodo = per.getAttribute('data-periodo'); ir('reporte', true); return; }
    var a = e.target.closest('[data-accion]');
    if (!a) return;
    var acc = a.getAttribute('data-accion');
    if (acc === 'salir') { cerrarMas(); salir(); }
    else if (acc === 'mas') abrirMas();
    else if (acc === 'cerrarMas') cerrarMas();
    else if (acc === 'recargar') location.reload();
    else if (acc === 'pdf') descargarPDF(a);
    else if (acc === 'sinid') {
      var celSinId = limpiarCelular((document.getElementById('cel') || {}).value || '');
      var txtSinId = 'Hola CONTAX, no recuerdo mi ID de Yango para entrar al Portal CONTAX.' + (/^591\d{8}$/.test(celSinId) ? ' Mi celular registrado es ' + telVisible(celSinId) + '.' : '') + ' Mi nombre completo es: ';
      window.open(wa(C.whatsappGeneral, txtSinId), '_blank', 'noopener');
    }
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
      avisos: [{ codigo: 'demo1', titulo: 'COMUNICADO OFICIAL - FACTURACIÓN SEMANA 40', mensaje: 'Estimados Repartidores,\n\nNuestro portal **ya se encuentra actualizado** con la información de facturación de la **Semana 40 (Del 28 de Septiembre al 04 de Octubre 2026)**.\n\nAdicionalmente, podrán revisar si cuentan con **facturas pendientes** de emisión para sus pagos correspondientes.', tipo: 'IMPORTANTE', frecuencia: 'CADA INGRESO' }]
    };
    S.datos.resumen = {
      pendientes: { cantidad: 3, total: 415.2 + 512.8 + 317.5 },
      pagados: { cantidad: 6, total: 486 + 538.4 + 402.1 + 611.9 + 455 + 389.7 }
    };
    S.publico = {
      totalRepartidores: 3376,
      formularios: [
        { clave: 'soporte', nombre: 'Soporte – Problemas con pagos', descripcion: 'Si un pago no te llegó o el monto no cuadra.', url: '#' },
        { clave: 'polizas', nombre: 'Póliza de seguro', descripcion: 'Presenta o actualiza tu póliza.', url: '#' },
        { clave: 'devolucion', nombre: 'Devolución de saldos', descripcion: 'Solicita la devolución de un saldo a tu favor.', url: '#' }
      ],
      preguntas: [
        { nombre: 'Pagos', preguntas: [
          { p: '¿Qué significa que mi pago está "Pendiente"?', r: 'Que tu pago ya está registrado y en proceso, pero todavía no fue abonado. Cuando se pague, pasa a tu Historial.' },
          { p: 'Mi pago no aparece en el portal, ¿qué hago?', r: 'Revisa en Mis facturas que tu factura esté Aprobada. Si pasaron más de 48 horas, abre un trámite de Soporte.' } ] },
        { nombre: 'Facturación', preguntas: [
          { p: '¿Dónde envío mis facturas?', r: 'En la sección Mis facturas del portal: subes el PDF y ves su estado al instante.' },
          { p: 'No tengo NIT, ¿pueden ayudarme?', r: 'Sí. CONTAX te ayuda a obtener tu NIT, Matrícula de Comercio y ROE. Escríbenos al WhatsApp 69021969.' } ] }
      ],
      encuesta: { titulo: '¿Cómo te atendemos?', texto: 'Tu opinión nos ayuda a mejorar. Son 2 minutos.', textoBoton: 'Calificar el servicio', url: '#' }
    };
    S.lecturas = {};
    S.admin = /[?&]admin\b/.test(location.search);
    aplicarContenido({
      anuncios: [
        { id: 'a1', activo: true, orden: 1, titulo: 'Contax Consultora', fuente: 'subida:a1', imagen: 'anuncios/1XLpL88BPof26oe3QF5_uesfbYb-tIp6o.png', link: '' },
        { id: 'a2', activo: true, orden: 2, titulo: 'Yango', fuente: 'subida:a2', imagen: 'anuncios/1JevTkXmhsnqU5YlGFN-QdjSu9-5KJ1g_.png', link: '' },
        { id: 'a3', activo: false, orden: 3, titulo: 'Junkers Car Wash', fuente: 'subida:a3', imagen: 'anuncios/1N-DSwktSwuFcOBW_DQQVUK2VRnis5y4p.png', link: 'https://wa.me/59169021969', hasta: '2026-12-31' }
      ],
      avisos: S.datos.avisos.map(function (a) { return Object.assign({ id: 'v1', activo: true, paraQuien: 'TODOS' }, a); }),
      preguntas: [].concat.apply([], S.publico.preguntas.map(function (c, i) { return c.preguntas.map(function (q, j) { return { id: 'q' + i + j, activo: true, categoria: c.nombre, p: q.p, r: q.r, orden: j + 1 }; }); }))
    });
    mostrarCarga();
    if (S.admin && !window.NM_ADMIN) { cargarScript('admin.js', function () { trasCarga(arrancarApp); }); return; }
    trasCarga(arrancarApp);
  }

  /* Lo que usan admin.js, reporte.js y chat.js */
  var API = window.NM = {
    S: S, C: C, DEMO: DEMO, db: function () { return db; }, auth: function () { return auth; },
    esc: esc, ic: ic, bs: bs, numero: numero, titulo: titulo, vacio: vacio, aviso: aviso, ir: ir,
    PAGINAS: PAGINAS, DESPUES: DESPUES, formatoAviso: formatoAviso, telVisible: telVisible,
    aplicarContenido: aplicarContenido, vigente: vigente, idSeguro: idSeguro, cargarScript: cargarScript,
    fechaTexto: fechaTexto, chipEstado: chipEstado, anilloBoton: anilloBoton,
    previaAviso: function (a) { mostrarAviso([Object.assign({ previa: true, codigo: 'previa' }, a)], 0, {}); },
    refrescar: function () { var p = S.pagina; arrancarApp(); ir(p, true); }
  };

  iniciar();
})();
