/* Prueba la lógica con datos inventados (no se conecta a internet).
   Uso:  cd sync && node probar.mjs */
import assert from 'node:assert/strict';
import * as CFG from './config.mjs';
import { armar, correoDe, claveDe, limpiarCelular, numero, ordenFecha, importarContenido, importarArchivo, documentoRepartidor } from './logica.mjs';

const tablas = {
  // A, B=ID, C=Nombre, D=Celular
  login: [
    ['', '27391057', 'JUAN CARLOS PEREZ', '59170000001'],
    ['', '11112222', 'MARIA LOPEZ', '70000002'],          // sin 591 → se agrega
    ['', '', 'SIN ID', '59170000003'],                     // se ignora
    ['', '33334444', 'CELULAR MALO', '123']                // se ignora
  ],
  // C semana, D rango, E id, G importe, M estado
  pendientes: [
    ['', '', '41', '06/10 al 12/10', '27391057', '', 415.2, '', '', '', '', '', 'Pendiente'],
    ['', '', '40', '29/09 al 05/10', '27391057', '', '512,80', '', '', '', '', '', 'Factura recibida'],
    ['', '', '41', '06/10 al 12/10', '99999999', '', 100, '', '', '', '', '', 'Pendiente'] // no existe
  ],
  // HistPagosMTG: A nro, B fecha, C semana, D rango, E id, F nombre, G importe
  pagos: [
    ['1', '26/09/2026', '37', '08/09 al 14/09', '27391057', 'JUAN', '538,40'],
    ['2', '3/10/2026', '38', '15/09 al 21/09', '27391057', 'JUAN', '486,00'],
    ['3', '3/10/2026', '38', '15/09 al 21/09', '11112222', 'MARIA', '1.300,00']
  ],
  habilitados: [['11112222']],
  asegurados: [['27391057']],
  anuncios: [
    ['SI', 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view', 'wa.me/59169021969', 2, '', '', 'Segundo'],
    ['SI', 'https://ejemplo.com/a.jpg', '', 1, '', '', 'Primero'],
    ['NO', 'https://ejemplo.com/b.jpg', '', 1, '', '', 'Apagado'],
    ['SI', 'https://ejemplo.com/c.jpg', '', 1, '01/01/2020', '02/01/2020', 'Vencido']
  ],
  avisos: [
    ['SI', 'Feriado', 'No hay pagos el lunes', '', 'Importante', 'Una vez', 'Todos', '', '', '', ''],
    ['SI', 'Habilítate', 'Cumple tus horas', '', 'Urgente', 'Hasta que confirme', 'No habilitados', '', '', 'Ver', 'wa.me/1'],
    ['SI', 'Solo Juan', 'Hola Juan', '', 'Info', 'Cada ingreso', '27391057, 5555', '', '', '', ''],
    ['NO', 'Apagado', 'x', '', '', '', 'Todos', '', '', '', '']
  ],
  faq: [
    ['SI', 'Pagos', '¿Cuándo me pagan?', 'Los viernes.', 2],
    ['SI', 'Pagos', '¿Qué es pendiente?', 'Que no se abonó.', 1],
    ['NO', 'Pagos', 'Oculta', 'x', 3]
  ],
  tramites: {
    soporte: [
      ['título del formulario'], [''],
      ['Marca temporal', 'Correo', 'Nombre', 'ID Yango', 'x', 'Problema', 'Nro de Factura(s)', 'Estado', 'Resolución del Caso', 'Motivo', 'Comentarios', '', '', '', '', '', '', 'Fecha'],
      ['08/10/2026 10:12:00', '', 'Juan', '27391057', '', 'No me llegó', '001245', 'En revisión', '', '', 'Revisando', '', '', '', '', '', '', '09/10/2026'],
      ['01/10/2026 09:00:00', '', 'Juan', '27391057', '', 'Otro', '0099', 'Resuelto', 'APROBADA', '', '', '', '', '', '', '', '', '']
    ]
  }
};

const { repartidores, publico, avisosLog } = armar(tablas, CFG, {
  hoy: '2026-10-13',
  imagen: v => (String(v).includes('drive.google') ? 'anuncios/1AbCdEfGhIjKlMnOp.jpg' : String(v || '').trim())
});

assert.equal(repartidores.size, 3, 'Deben quedar 2 repartidores válidos + 1 de prueba');
const prueba = repartidores.get('1234');
assert.equal(prueba.celular, '59178015123'); assert.equal(prueba.resumen.pendientes.cantidad, 2);
const juan = repartidores.get('27391057'), maria = repartidores.get('11112222');
assert.equal(maria.celular, '59170000002');
assert.equal(juan.poliza, true); assert.equal(maria.habilitado, false); assert.equal(juan.habilitado, true);
assert.equal(juan.pendientes.length, 2);
assert.equal(juan.resumen.pendientes.total, 928);
assert.equal(juan.historial[0].fechaPago, '3/10/2026', 'El pago más reciente va primero');
assert.equal(juan.resumen.pagados.total, 1024.4);
assert.equal(juan.tramites.length, 2);
assert.equal(juan.tramites[0].numero, 'SOP-0004');
assert.equal(juan.tramites[0].asunto, 'No me llegó');
assert.equal(juan.tramites[0].detalle, '001245');
assert.equal(juan.tramites[0].fechaRespuesta, '09/10/2026');
assert.equal(documentoRepartidor(juan).avisos, undefined, 'Los avisos ya no van en el documento del repartidor');
assert.equal(publico.totalRepartidores, 2);
assert.equal(publico.formularios.length, 4);
assert.equal(avisosLog.length, 1);

// La página y la sincronización arman igual el usuario y la clave
assert.equal(correoDe('27391057', CFG.DOMINIO_USUARIOS), '27391057@repartidores.portalnummeros.app');
assert.equal(claveDe(limpiarCelular('70000001'), '27391057'), 'NM-59170000001-27391057');
assert.equal(numero('1.234,50'), 1234.5);
assert.ok(ordenFecha('03/10/2026') > ordenFecha('26/09/2026'));

// Migración única: hojas Anuncios, Avisos (formato real) y FAQ → contenido del panel
const cont = importarContenido({
  anuncios: tablas.anuncios,
  avisos: [
    ['Activo', 'Título / Mensaje', 'Imagen', 'Tipo', 'Frecuencia', 'Para quién', 'Desde', 'Hasta', 'Botón'],
    ['SI', '**📢 COMUNICADO OFICIAL - SEMANA 40**\n\nEstimados Repartidores,\n\nEl portal **ya está actualizado**.', '', 'Importante', 'Cada Ingreso', 'Todos', '', '', 'Escríbenos https://wa.me/59169021969'],
    ['NO', 'Solo algunos\nHola', '', 'Info', 'Una vez', '27391057, 5555', '', '', '']
  ],
  faq: tablas.faq
});
assert.equal(cont.anuncios.length, 4, 'Se migran todos, también los apagados');
assert.equal(cont.anuncios[0].titulo, 'Primero'); assert.equal(cont.anuncios[0].orden, 1);
assert.equal(cont.anuncios.find(a => a.titulo === 'Apagado').activo, false);
assert.equal(cont.anuncios.find(a => a.titulo === 'Segundo').fuente.includes('drive.google'), true);
const av = cont.avisos[0];
assert.equal(av.titulo, 'COMUNICADO OFICIAL - SEMANA 40');
assert.equal(av.mensaje, 'Estimados Repartidores,\n\nEl portal **ya está actualizado**.');
assert.equal(av.tipo, 'IMPORTANTE'); assert.equal(av.frecuencia, 'CADA INGRESO'); assert.equal(av.paraQuien, 'TODOS');
assert.equal(av.botonTexto, 'Escríbenos'); assert.equal(av.botonLink, 'https://wa.me/59169021969');
assert.equal(cont.avisos[1].paraQuien, 'IDS'); assert.equal(cont.avisos[1].ids, '27391057, 5555'); assert.equal(cont.avisos[1].activo, false);
assert.equal(cont.preguntas.length, 3);
const arch = importarArchivo({
  chatlog: [['Fecha y Hora', 'ID Yango', 'Nombre', 'Pregunta', 'Respuesta', 'Tokens'], ['23/9/2026 1:36:14', '31827409', 'Erick', '¿NIT?', 'Al 550276028', '1307']],
  avisosLeidos: [['22/9/2026 12:00:06', '66314299', 'Cristhian', '59169181162', 'fb9176ceb5', 'Bienvenido']]
});
assert.equal(arch.chats.length, 1); assert.equal(arch.chats[0].tokens, 1307);
assert.equal(arch.lecturas.length, 1); assert.equal(arch.lecturas[0].codigo, 'fb9176ceb5');
assert.equal(arch.lecturas[0].celular, undefined, 'No se guarda el celular en el archivo');

console.log('✔ Todas las pruebas pasaron (' + repartidores.size + ' repartidores de ejemplo).');

// Notificaciones
{
  const { firmaNotif, eventosNotif, unirEventos, aplicaA, bsTexto } = await import('./logica.mjs');
  const r = { uid: '1', pendientes: [{ semana: '41', importe: 415.2 }], historial: [{ semana: '38', importe: 486, fechaPago: '03/10/2026' }], tramites: [{ numero: 'SOP-1', estado: 'En revisión' }] };
  const a = firmaNotif(r);
  assert.deepEqual(eventosNotif(null, a, r), [], 'La primera vez no avisa');
  const r2 = { ...r, pendientes: [{ semana: '42', importe: 512.8 }, ...r.pendientes], historial: [{ semana: '39', importe: 400, fechaPago: '10/10/2026' }, ...r.historial], tramites: [{ numero: 'SOP-1', estado: 'Resuelto', resolucion: 'APROBADA' }] };
  const ev = eventosNotif(a, firmaNotif(r2), r2);
  assert.equal(ev.length, 3);
  assert.equal(ev[0].titulo, 'Semana 42 registrada'); assert.ok(ev[0].cuerpo.includes('Bs 512,80'));
  assert.equal(ev[1].titulo, 'Recibiste tu pago'); assert.ok(ev[1].cuerpo.includes('Semana 39'));
  assert.ok(ev[2].cuerpo.includes('Resuelto · APROBADA'));
  assert.equal(unirEventos(ev).titulo, 'Tienes novedades en el Portal CONTAX');
  assert.equal(eventosNotif(firmaNotif(r2), firmaNotif(r2), r2).length, 0, 'Sin cambios no avisa');
  assert.equal(aplicaA('IDS', '5, 1', r), true); assert.equal(aplicaA('SIN POLIZA', '', { poliza: true }), false);
  assert.equal(bsTexto(1234.5), 'Bs 1.234,50');
  const viejo = { p: a.p, h: 5, t: a.t };   // firma guardada con el formato anterior
  assert.equal(eventosNotif(viejo, firmaNotif(r2), r2).filter(e => /pago/.test(e.titulo)).length, 0, 'Con la firma anterior no avisa pagos viejos');
  const { repararTexto, sinEmojis } = await import('./logica.mjs');
  assert.equal(repararTexto('BaÃ©z'), 'Baéz'); assert.equal(repararTexto('Peña'), 'Peña');
  assert.equal(sinEmojis('Retención ❌').trim(), 'Retención');
  console.log('✔ Notificaciones: pruebas pasaron.');
}
