/* ══════════════════════════════════════════════════════════
   ASISTENTE CON IA · ventana de chat del Portal CONTAX
   Habla con el intermediario de Cloudflare (config.js → ia.url),
   que verifica la sesión y consulta a DeepSeek.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var N = window.NM, S = N.S, C = N.C, esc = N.esc, ic = N.ic;
  var historial = [];          // { rol: 'usuario' | 'asistente', texto }
  var abierto = false, ocupado = false, preguntasSesion = 0;
  var MAX_SESION = 30;
  var SUGERENCIAS = ['¿Cuánto tengo por cobrar?', '¿A qué NIT emito mi factura?', '¿Cuándo me pagan?', '¿En qué estado está mi trámite?'];

  function bsTexto(n) { return N.bs(n); }
  /* Lo que el asistente sabe del repartidor (solo sus propios datos) */
  function contexto() {
    var d = S.datos || {}, p = S.publico || {}, r = d.resumen || {};
    var l = [];
    l.push('DATOS DEL REPARTIDOR');
    l.push('Nombre: ' + (d.nombre || '') + ' · ID de Yango: ' + (d.id || '') + ' · Celular: ' + N.telVisible(d.celular || ''));
    l.push('Pago habilitado por la app esta semana: ' + (d.habilitado === false ? 'NO (no cumplió las horas mínimas de Yango)' : 'Sí'));
    l.push('Póliza de seguro: ' + (d.poliza ? 'presentada' : 'NO presentada'));
    var pend = d.pendientes || [];
    l.push('Pagos pendientes (' + pend.length + ', total ' + bsTexto((r.pendientes || {}).total || 0) + '):');
    pend.forEach(function (x) { l.push('- Semana ' + x.semana + ' (' + x.rango + '): ' + bsTexto(x.importe) + ' · estado: ' + (x.estado || 'Pendiente')); });
    var hist = d.historial || [];
    l.push('Pagos recibidos (' + hist.length + ', total ' + bsTexto((r.pagados || {}).total || 0) + '). Últimos:');
    hist.slice(0, 10).forEach(function (x) { l.push('- Pagado el ' + x.fechaPago + ' · semana ' + x.semana + ' (' + x.rango + '): ' + bsTexto(x.importe)); });
    var tr = d.tramites || [];
    l.push('Trámites (' + tr.length + '):');
    tr.slice(0, 8).forEach(function (t) {
      l.push('- ' + t.numero + ' · ' + t.tipo + ' · enviado ' + t.fecha + ' · estado: ' + (t.estado || 'Recibido') + (t.resolucion ? ' · resolución: ' + t.resolucion : '') +
        (t.asunto ? ' · ' + (t.etAsunto || 'caso') + ': ' + t.asunto : '') + (t.comentario ? ' · respuesta de CONTAX: ' + String(t.comentario).slice(0, 200) : ''));
    });
    l.push('');
    l.push('INFORMACIÓN DEL PORTAL');
    l.push('Facturar a: ' + C.facturacion.razonSocial + ', NIT ' + C.facturacion.nit + '.');
    l.push('WhatsApp de consultas: ' + N.telVisible(C.whatsappGeneral) + '. Las facturas en PDF se suben en la sección «Mis facturas» del portal (ya no por WhatsApp); ahí ven si fue aprobada u observada. Corte: jueves 18:00.');
    (C.reglasPago || []).forEach(function (t) { l.push('- ' + t); });
    l.push('Los datos del portal se actualizan cada 15 minutos. Para problemas con un pago se abre un trámite de Soporte en "Mis trámites".');
    (p.formularios || []).forEach(function (f) { l.push('Formulario disponible en "Mis trámites": ' + f.nombre + (f.descripcion ? ' (' + f.descripcion + ')' : '')); });
    l.push('Preguntas frecuentes:');
    (p.preguntas || []).forEach(function (c) { c.preguntas.forEach(function (q) { l.push('P: ' + q.p + ' R: ' + q.r); }); });
    l.push('Fecha de hoy: ' + new Date().toLocaleDateString('es-BO'));
    return l.join('\n');
  }

  function montar() {
    if (document.getElementById('chatBtn')) return;
    var b = document.createElement('button');
    b.id = 'chatBtn'; b.className = 'chat-btn'; b.setAttribute('aria-label', 'Abrir el asistente');
    b.innerHTML = ic('chat') + '<span>Asistente</span>';
    b.addEventListener('click', alternar);
    document.body.appendChild(b);
  }
  function quitar() {
    ['chatBtn', 'chatPanel'].forEach(function (id) { var e = document.getElementById(id); if (e) e.remove(); });
    abierto = false;
  }

  function alternar() {
    if (abierto) { cerrar(); return; }
    abierto = true;
    var p = document.createElement('section');
    p.id = 'chatPanel'; p.className = 'chat-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Asistente del Portal CONTAX');
    p.innerHTML = '<header class="chat-cab"><div class="nm-patron oscuro" aria-hidden="true"></div>' +
        '<img src="marca/logos/nummeros-isotipo-blanco.svg" alt=""><div><b>Asistente CONTAX</b><small>Responde con tus datos del portal. Puede equivocarse.</small></div>' +
        '<button class="modal-x" aria-label="Cerrar" data-chat="cerrar">×</button></header>' +
      '<div class="chat-msgs" id="chatMsgs" aria-live="polite"></div>' +
      '<form class="chat-form" id="chatForm"><input id="chatTxt" maxlength="500" autocomplete="off" placeholder="Escribe tu pregunta…" aria-label="Tu pregunta">' +
        '<button class="btn" aria-label="Enviar">' + ic('enviar') + '</button></form>';
    document.body.appendChild(p);
    document.getElementById('chatBtn').classList.add('on');
    pintar();
    p.querySelector('[data-chat="cerrar"]').addEventListener('click', cerrar);
    p.querySelector('#chatForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var i = document.getElementById('chatTxt');
      enviar(i.value); i.value = '';
    });
    p.addEventListener('click', function (e) { var s = e.target.closest('[data-sugerencia]'); if (s) enviar(s.textContent); });
    setTimeout(function () { var i = document.getElementById('chatTxt'); if (i && window.innerWidth > 860) i.focus(); }, 50);
  }
  function cerrar() {
    abierto = false;
    var p = document.getElementById('chatPanel'); if (p) p.remove();
    var b = document.getElementById('chatBtn'); if (b) b.classList.remove('on');
  }

  function pintar() {
    var c = document.getElementById('chatMsgs');
    if (!c) return;
    var nombre = String((S.datos || {}).nombre || '').trim().split(/\s+/)[0] || '';
    nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
    c.innerHTML = '<div class="msg ia"><p>Hola' + (nombre ? ', ' + esc(nombre) : '') + '. Puedo ayudarte con tus pagos, facturas y trámites. ¿Qué necesitas saber?</p></div>' +
      (historial.length ? '' : '<div class="chat-sug">' + SUGERENCIAS.map(function (s) { return '<button type="button" data-sugerencia>' + esc(s) + '</button>'; }).join('') + '</div>') +
      historial.map(function (m) {
        return '<div class="msg ' + (m.rol === 'usuario' ? 'yo' : 'ia') + (m.error ? ' error' : '') + '">' + (m.rol === 'usuario' ? '<p>' + esc(m.texto) + '</p>' : N.formatoAviso(m.texto)) + '</div>';
      }).join('') +
      (ocupado ? '<div class="msg ia escribiendo"><span></span><span></span><span></span></div>' : '');
    c.scrollTop = c.scrollHeight;
  }

  function enviar(texto) {
    texto = String(texto || '').trim();
    if (!texto || ocupado) return;
    if (preguntasSesion >= MAX_SESION) { historial.push({ rol: 'asistente', texto: 'Llegaste al máximo de preguntas por hoy en esta sesión. Si necesitas más ayuda, escríbenos al WhatsApp ' + N.telVisible(C.whatsappGeneral) + '.', error: true }); pintar(); return; }
    preguntasSesion++;
    historial.push({ rol: 'usuario', texto: texto });
    ocupado = true; pintar();
    var token = N.DEMO ? Promise.resolve('demo') : N.auth().currentUser.getIdToken();
    token.then(function (t) {
      if (N.DEMO) return new Promise(function (ok) { setTimeout(function () { ok({ respuesta: 'Esto es una **demostración**. Cuando el asistente esté conectado, aquí verás la respuesta real con tus datos.', tokens: 0 }); }, 900); });
      return fetch(C.ia.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ mensajes: historial.filter(function (m) { return !m.error; }).slice(-8), contexto: contexto() })
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Error'); return j; }); });
    }).then(function (j) {
      historial.push({ rol: 'asistente', texto: j.respuesta });
      registrar(texto, j.respuesta, j.tokens);
    }, function (e) {
      historial.push({ rol: 'asistente', texto: (e && e.message && !/fetch|network|Failed/i.test(e.message)) ? e.message : 'No pude conectarme. Revisa tu internet e intenta de nuevo.', error: true });
    }).then(function () { ocupado = false; pintar(); });
  }

  /* Guarda la conversación para que CONTAX vea qué preguntan (reemplaza la hoja ChatLog) */
  function registrar(pregunta, resp, tokens) {
    if (N.DEMO || !S.usuario) return;
    var d = S.datos || {};
    N.db().collection('chats').add({
      uid: S.usuario.uid, id: S.admin ? 'ADMIN' : String(d.id || ''), nombre: S.admin ? 'Administrador' : String(d.nombre || '').slice(0, 120),
      pregunta: pregunta.slice(0, 600), respuesta: String(resp || '').slice(0, 3000), tokens: Number(tokens) || 0,
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function (e) { console.warn('No se pudo registrar el chat', e); });
  }

  window.NM_CHAT = { montar: montar, quitar: quitar, cerrar: cerrar };
  if (S.datos && ((C.ia && C.ia.url) || N.DEMO)) montar();
})();
