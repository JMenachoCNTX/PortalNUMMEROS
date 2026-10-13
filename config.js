/* ══════════════════════════════════════════════════════════
   CONFIGURACIÓN DEL PORTAL CONTAX
   Lo único que normalmente se cambia a mano está aquí.
   ══════════════════════════════════════════════════════════ */
window.PORTAL = {
  version: '3.0',

  /* Datos de tu proyecto de Firebase (Consola de Firebase → ⚙ Configuración
     del proyecto → Tus apps → Web). Estos datos NO son secretos: Google los
     diseñó para ir en la página. Mientras digan 'PEGAR', el portal funciona
     en MODO DEMOSTRACIÓN con datos de ejemplo. */
  firebase: {
    apiKey: 'AIzaSyBh_NxhM5h6x--ZwxwoUCYf0yhW7Mt9k_A',
    authDomain: 'portal-nummeros.firebaseapp.com',
    projectId: 'portal-nummeros',
    storageBucket: 'portal-nummeros.firebasestorage.app',
    messagingSenderId: '924886635369',
    appId: '1:924886635369:web:48f940d324d4dfb518e3f8'
  },

  /* Cómo se arma el usuario de cada repartidor en Firebase.
     IMPORTANTE: debe ser igual a sync/config.mjs. No lo cambies después
     de la primera sincronización. */
  dominioUsuarios: 'repartidores.portalnummeros.app',

  whatsappGeneral: '59169021969',   // consultas
  whatsappFacturas: '59175854243',  // solo recibe facturas en PDF

  facturacion: {
    razonSocial: 'MILTHAGOR S.R.L.',
    nit: '550276028'
  },

  reglasPago: [
    'Las facturas se reciben hasta el jueves antes de las 18:00. Si llegan después y están correctas, se pagan la semana siguiente.',
    'Los pagos los realiza Milthagor S.R.L., por lo general los viernes. A veces se adelantan al jueves después de las 19:00.',
    'Envía tu factura en PDF al WhatsApp de facturas. Esa línea no atiende llamadas ni consultas.'
  ]
};
