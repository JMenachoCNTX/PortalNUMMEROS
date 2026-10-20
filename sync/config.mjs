/* ══════════════════════════════════════════════════════════
   CONFIGURACIÓN DE LA SINCRONIZACIÓN  Google Sheets → Firebase
   (es lo mismo que estaba arriba en PortalCONTAX.gs)
   ══════════════════════════════════════════════════════════ */

// Archivo principal de Google Sheets
export const SPREADSHEET_ID = '16msr7Jhd0gmsUkzk-lIEmJyhgI-J03Rf9ah7Mmq0K_0';
// Si las preguntas frecuentes están en otro archivo, pon su ID aquí. Vacío = archivo principal.
export const FAQ_SPREADSHEET_ID = '';

export const ZONA_HORARIA = 'America/La_Paz';

// Debe ser IGUAL a dominioUsuarios en config.js (la página). No lo cambies después de la primera sincronización.
export const DOMINIO_USUARIOS = 'repartidores.portalnummeros.app';

// Hojas y columnas (A = 1)
export const HOJAS = {
  login: { nombre: 'BDYANGO', id: 'B', nombreCol: 'C', celular: 'D' },
  pendientes: { nombre: 'PPendientes', semana: 'C', rango: 'D', id: 'E', importe: 'G', estado: 'M' },
  // Historial completo de pagos (antes se leía la hoja "Pagos", que solo muestra el último mes).
  // Para volver a la hoja "Pagos": { nombre: 'Pagos', filaInicio: 2, fechaPago: 'A', semana: 'B', rango: 'C', id: 'D', importe: 'F' }
  pagos: { nombre: 'HistPagosMTG', filaInicio: 3, fechaPago: 'B', semana: 'C', rango: 'D', id: 'E', importe: 'G' },
  habilitados: { nombre: 'Habilitados' },   // si el ID está en la columna A = NO habilitado
  asegurados: { nombre: 'ASEGURADOS' },     // si el ID está en la columna A = presentó póliza
  anuncios: { nombre: 'Anuncios' },         // A Activo | B Imagen | C Link | D Orden | E Desde | F Hasta | G Título
  avisos: { nombre: 'Avisos' },             // Se ubica por encabezados: Activo | Título / Mensaje (1a línea = título) | Imagen | Tipo | Frecuencia | Para quién | Desde | Hasta | Botón (texto + link)
  faq: { nombre: 'FAQ' }                    // A Activo | B Categoría | C Pregunta | D Respuesta | E Orden
};

/* Encuesta de satisfacción. En el link puedes usar IDYANGO, NOMBRE y CELULAR:
   el portal los reemplaza con los datos del repartidor. Vacío = no se muestra. */
export const ENCUESTA = {
  titulo: '¿Cómo te atendemos?',
  texto: 'Tu opinión nos ayuda a mejorar. Son 2 minutos y es anónima para los demás repartidores.',
  textoBoton: 'Calificar el servicio',
  url: 'https://docs.google.com/forms/d/e/1FAIpQLSfTEcsjlPua54bxPTAjpCJkcfOxmpR54gq1n07ZwJ9Auii0fw/viewform?usp=pp_url&entry.655443225=NOMBRE&entry.1153826338=IDYANGO'
};

/* MIS TRÁMITES — una llave { } por cada formulario.
   archivoId: ID del Google Sheet donde ustedes marcan el estado (vacío = solo se muestra el botón).
   campos: nombre del encabezado tal cual, o la letra de la columna. '' si no existe. */
export const TRAMITES = [
  {
    clave: 'soporte',
    nombre: 'Soporte – Problemas con pagos',
    descripcion: 'Si un pago no te llegó o el monto no cuadra.',
    prefijo: 'SOP',
    archivoId: '1qb6_k4LQ55fmgw47qwjasJLFIA_6528tMig4sTDc8fA',
    hoja: 'Seguimiento',
    filaEncabezados: 3,
    formulario: 'https://docs.google.com/forms/d/e/1FAIpQLSfx_dYbc02lhMZZ3S2HD_ND50zex4EAsE0sOcRT3xjfjR5ztA/viewform?usp=pp_url&entry.655443225=NOMBRE&entry.1153826338=IDYANGO',
    campos: {
      id: 'ID Yango', fecha: 'Marca temporal', asunto: 'F', detalle: 'Nro de Factura(s)',
      estado: 'Estado', resolucion: 'Resolución del Caso', motivo: 'Motivo', comentario: 'Comentarios', fechaRespuesta: 'R'
    }
  },
  {
    clave: 'polizas',
    nombre: 'Póliza de seguro',
    descripcion: 'Presenta o actualiza tu póliza de seguro.',
    prefijo: 'POL',
    archivoId: '189CUq48yMfDQChseuCttUHA_xTw1C0bGFfPJnTC_gRM',
    hoja: 'Verificación',
    filaEncabezados: 2,
    formulario: 'https://docs.google.com/forms/d/e/1FAIpQLSf4diFdbEGstK-rTOKGxK2Y5H7Ibue0NRV6pMIh4wb2Hj_Dkg/viewform?usp=pp_url&entry.655443225=NOMBRE&entry.1153826338=IDYANGO',
    campos: {
      id: 'D', fecha: 'A', asunto: 'F', detalle: 'G', estado: 'N', resolucion: 'J', motivo: '', comentario: 'L', fechaRespuesta: ''
    },
    etiquetas: { asunto: 'Aseguradora', detalle: 'Vence el' }
  },
  {
    clave: 'devolucion',
    nombre: 'Devolución de saldos',
    descripcion: 'Solicita la devolución de un saldo a tu favor.',
    prefijo: 'DEV',
    archivoId: '',   // cuando la hoja "Seguimiento" esté lista: '1bNWcWJW9By0i6uGl1A-FJjqFrhqsXCCma0emFrXuyqM'
    hoja: 'Seguimiento',
    filaEncabezados: 2,
    formulario: 'https://docs.google.com/forms/d/e/1FAIpQLScE03R_Lao_g3hj2Afd01VU3R8-h5CWceHQYRl8Khr88hbP0g/viewform?usp=pp_url&entry.655443225=NOMBRE&entry.1153826338=IDYANGO',
    campos: { id: 'D', fecha: 'A', asunto: '', detalle: '', estado: '', resolucion: '', motivo: 'E', comentario: '', fechaRespuesta: '' },
    etiquetas: { asunto: 'Semana', detalle: 'Total a abonar' }
  },
  {
    clave: 'desactivacion',
    nombre: 'Pagos semanales por desactivación',
    descripcion: 'Si te desactivaron y tienes pagos semanales por cobrar.',
    prefijo: 'DES',
    archivoId: '1bNWcWJW9By0i6uGl1A-FJjqFrhqsXCCma0emFrXuyqM',
    hoja: 'Seguimiento Pagos Semanales',
    filaEncabezados: 2,
    formulario: 'https://docs.google.com/forms/d/e/1FAIpQLSeI6IsAzS2XYhw1Kt_F7WRQOpQtCVntHLwmhI3P9mK7q5qcAg/viewform?usp=pp_url&entry.655443225=NOMBRE&entry.1153826338=IDYANGO',
    campos: { id: 'D', fecha: 'A', asunto: 'I', detalle: 'N', estado: 'O', resolucion: 'G', motivo: 'E', comentario: 'H', fechaRespuesta: 'P' },
    etiquetas: { asunto: 'Semana', detalle: 'Total a abonar' }
  }
];

// Seguridad: si BDYANGO trae menos de este porcentaje de los repartidores de la vez anterior,
// la sincronización se detiene (para no borrar a todos si la hoja se vacía por error).
export const MINIMO_REPARTIDORES = 0.6;

/* Usuarios de prueba: NO están en BDYANGO. Entran al portal con datos de ejemplo.
   Para quitarlos, borra la línea y espera la siguiente sincronización. */
export const USUARIOS_PRUEBA = [
  { id: '1234', celular: '78015123', nombre: 'USUARIO DE PRUEBA' }
];
export const CORREO_ADMIN = 'admin@portalnummeros.app';
