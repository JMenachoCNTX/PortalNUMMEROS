/* ══════════════════════════════════════════════════════════
   REPORTE EN PDF · Portal CONTAX
   Se carga solo cuando el repartidor toca "Descargar PDF".
   Arma el PDF en el mismo celular (no usa servidor) con la marca NUMMEROS.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LIBS = [
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
  ];
  var COL = {
    v950: [5, 31, 32], v900: [11, 43, 38], v800: [22, 56, 50], v700: [35, 83, 71], v300: [142, 182, 155], v100: [218, 241, 222],
    fondo: [244, 250, 245], campo: [238, 247, 240], suave: [85, 115, 99], borde: [218, 241, 222],
    aviso: [147, 55, 13], avisoBg: [253, 243, 228], error: [180, 35, 24], errorBg: [253, 236, 234]
  };
  var recursos = null;

  function script(src) {
    return new Promise(function (ok, mal) {
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { mal(new Error('No se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
  }
  function binario(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.arrayBuffer(); }).then(function (b) {
      var u = new Uint8Array(b), s = '', paso = 0x8000;
      for (var i = 0; i < u.length; i += paso) s += String.fromCharCode.apply(null, u.subarray(i, i + paso));
      return btoa(s);
    });
  }
  function cargar() {
    if (recursos) return Promise.resolve(recursos);
    var libs = window.jspdf ? Promise.resolve() : script(LIBS[0]).then(function () { return script(LIBS[1]); });
    return Promise.all([
      libs,
      binario('marca/pdf/Akshar-700.ttf'), binario('marca/pdf/Questrial-400.ttf'),
      binario('marca/pdf/logo-horizontal-blanco.png'), binario('marca/pdf/isotipo-principal.png')
    ]).then(function (r) { recursos = { akshar: r[1], questrial: r[2], logo: r[3], iso: r[4] }; return recursos; });
  }

  function generar(R, N) {
    return cargar().then(function (rec) {
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ unit: 'mm', format: 'a4' });
      doc.addFileToVFS('Akshar.ttf', rec.akshar); doc.addFont('Akshar.ttf', 'Akshar', 'bold');
      doc.addFileToVFS('Questrial.ttf', rec.questrial); doc.addFont('Questrial.ttf', 'Questrial', 'normal');
      var W = 210, H = 297, M = 14, d = R.datos;
      var bs = N.bs;
      function color(c, tipo) { doc[tipo === 'fill' ? 'setFillColor' : tipo === 'draw' ? 'setDrawColor' : 'setTextColor'](c[0], c[1], c[2]); }
      function titulo(t) { doc.setFont('Akshar', 'bold'); return t; }
      function cuerpo() { doc.setFont('Questrial', 'normal'); }

      /* ── Encabezado ── */
      color(COL.v900, 'fill'); doc.rect(0, 0, W, 36, 'F');
      color(COL.v300, 'fill'); doc.rect(0, 36, W, 1.4, 'F');
      // Patrón de "N" muy sutil a la derecha
      doc.setGState && doc.setGState(new doc.GState({ opacity: 0.08 }));
      for (var px = 120; px < W; px += 16) for (var py = 2; py + 12 <= 36; py += 16) doc.addImage(rec.iso, 'PNG', px, py, 9, 12);
      doc.setGState && doc.setGState(new doc.GState({ opacity: 1 }));
      doc.addImage(rec.logo, 'PNG', M, 12, 56, 8.9);
      titulo(); doc.setFontSize(17); color([255, 255, 255]);
      doc.text('REPORTE DE PAGOS', W - M, 16, { align: 'right', charSpace: 0.4 });
      cuerpo(); doc.setFontSize(9); color(COL.v100);
      doc.text('Portal CONTAX · ' + R.nombrePeriodo, W - M, 22.5, { align: 'right' });

      /* ── Ficha del repartidor ── */
      var y = 48;
      titulo(); doc.setFontSize(18); color(COL.v800);
      doc.text(String(d.nombre || ''), M, y, { maxWidth: 120 });
      cuerpo(); doc.setFontSize(10); color(COL.suave);
      doc.text('ID de Yango ' + (d.id || '') + '   ·   Celular ' + N.telVisible(d.celular || ''), M, y + 6.5);
      var ahora = new Date(), z = function (x) { return (x < 10 ? '0' : '') + x; };
      var emitido = z(ahora.getDate()) + '/' + z(ahora.getMonth() + 1) + '/' + ahora.getFullYear() + ' ' + z(ahora.getHours()) + ':' + z(ahora.getMinutes());
      doc.setFontSize(9);
      doc.text('Emitido: ' + emitido, W - M, y - 3, { align: 'right' });
      if (R.sincronizado) doc.text('Datos al ' + N.fechaTexto(R.sincronizado), W - M, y + 2, { align: 'right' });
      // Estados
      function etiqueta(x, yy, txt, fondo, letra) {
        titulo(); doc.setFontSize(8);
        var w = doc.getTextWidth(txt) + 7;
        color(fondo, 'fill'); doc.roundedRect(x, yy - 4, w, 6, 3, 3, 'F');
        color(letra); doc.text(txt, x + 3.5, yy);
        return x + w + 3;
      }
      var x = etiqueta(M, y + 14, d.habilitado === false ? 'PAGO NO HABILITADO POR LA APP' : 'PAGO HABILITADO POR LA APP',
        d.habilitado === false ? COL.errorBg : COL.v100, d.habilitado === false ? COL.error : COL.v700);
      etiqueta(x, y + 14, d.poliza ? 'PÓLIZA PRESENTADA' : 'PÓLIZA NO PRESENTADA', d.poliza ? COL.v100 : COL.avisoBg, d.poliza ? COL.v700 : COL.aviso);

      /* ── Indicadores ── */
      y += 22;
      var kpis = [
        ['TOTAL COBRADO', bs(R.total), R.nombrePeriodo],
        ['PAGOS RECIBIDOS', String(R.cantidad), 'semanas pagadas'],
        ['PROMEDIO POR PAGO', bs(R.promedio), R.mejor ? 'Mejor: ' + bs(R.mejor.importe) : 'Sin pagos aún'],
        ['POR COBRAR', bs(R.totalPendiente), R.pendientes.length + ' semana' + (R.pendientes.length === 1 ? '' : 's')]
      ];
      var kw = (W - 2 * M - 3 * 4) / 4;
      kpis.forEach(function (k, i) {
        var kx = M + i * (kw + 4);
        color(COL.campo, 'fill'); doc.roundedRect(kx, y, kw, 24, 2.5, 2.5, 'F');
        color(i === 3 ? COL.aviso : COL.v700, 'fill'); doc.rect(kx, y + 4, 1.2, 16, 'F');
        titulo(); doc.setFontSize(7.5); color(COL.suave); doc.text(k[0], kx + 5, y + 7, { charSpace: 0.3 });
        doc.setFontSize(14); color(COL.v800); doc.text(k[1], kx + 5, y + 15);
        cuerpo(); doc.setFontSize(7.5); color(COL.suave); doc.text(k[2], kx + 5, y + 20.5, { maxWidth: kw - 7 });
      });
      y += 34;

      function seccion(t, sub) {
        if (y > H - 50) { doc.addPage(); y = 20; }
        titulo(); doc.setFontSize(12.5); color(COL.v800); doc.text(t, M, y);
        if (sub) { cuerpo(); doc.setFontSize(8.5); color(COL.suave); doc.text(sub, W - M, y, { align: 'right' }); }
        color(COL.v100, 'draw'); doc.setLineWidth(0.4); doc.line(M, y + 2.5, W - M, y + 2.5);
        y += 6;
      }
      function tabla(cab, filas, pie, alinear) {
        doc.autoTable({
          startY: y, head: [cab], body: filas, foot: pie ? [pie] : undefined, showFoot: 'lastPage',
          margin: { left: M, right: M, bottom: 20 }, theme: 'plain',
          styles: { font: 'Questrial', fontStyle: 'normal', fontSize: 9, textColor: COL.v800, cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 } },
          headStyles: { font: 'Akshar', fontStyle: 'bold', fillColor: COL.v700, textColor: [255, 255, 255], fontSize: 9 },
          footStyles: { font: 'Akshar', fontStyle: 'bold', fillColor: COL.v100, textColor: COL.v800, fontSize: 10 },
          alternateRowStyles: { fillColor: COL.fondo },
          columnStyles: alinear || {},
          didParseCell: function (c) { if (alinear && alinear[c.column.index] && (c.section === 'head' || c.section === 'foot')) c.cell.styles.halign = alinear[c.column.index].halign; }
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      /* ── Gráfico por mes (barras dibujadas) ── */
      if (R.meses.length) {
        seccion('Cobrado por mes', R.nombrePeriodo);
        var meses = R.meses.slice(-12), alto = 42, base = y + alto, maxv = Math.max.apply(null, meses.map(function (m) { return m.total; })) || 1;
        var ancho = (W - 2 * M) / meses.length, barra = Math.min(14, ancho * 0.6);
        color(COL.borde, 'draw'); doc.setLineWidth(0.2);
        [0.5, 1].forEach(function (f) { doc.line(M, base - alto * f, W - M, base - alto * f); });
        meses.forEach(function (m, i) {
          var h = Math.max(0.8, (m.total / maxv) * (alto - 8)), bx = M + i * ancho + (ancho - barra) / 2;
          color(COL.v700, 'fill'); doc.roundedRect(bx, base - h, barra, h, 1, 1, 'F');
          cuerpo(); doc.setFontSize(6.5); color(COL.suave);
          doc.text(m.corto, bx + barra / 2, base + 4, { align: 'center' });
          titulo(); doc.setFontSize(6.5); color(COL.v800);
          doc.text(String(Math.round(m.total)), bx + barra / 2, base - h - 1.5, { align: 'center' });
        });
        color(COL.v300, 'draw'); doc.setLineWidth(0.4); doc.line(M, base, W - M, base);
        y = base + 12;
        tabla(['Mes', 'Pagos', 'Total'], R.meses.slice().reverse().map(function (m) { return [m.nombre, String(m.pagos), bs(m.total)]; }),
          ['Total', String(R.cantidad), bs(R.total)], { 1: { halign: 'center' }, 2: { halign: 'right' } });
      }

      seccion('Pagos pendientes', R.pendientes.length + ' semana' + (R.pendientes.length === 1 ? '' : 's'));
      if (R.pendientes.length) tabla(['Semana', 'Período', 'Estado', 'Importe'], R.pendientes.map(function (p) { return [String(p.semana), p.rango || '', p.estado || 'Pendiente', bs(p.importe)]; }),
        ['Total por cobrar', '', '', bs(R.totalPendiente)], { 0: { halign: 'center' }, 3: { halign: 'right' } });
      else { cuerpo(); doc.setFontSize(9.5); color(COL.suave); doc.text('No tienes pagos pendientes.', M, y + 2); y += 12; }

      seccion('Pagos recibidos', R.cantidad + ' pago' + (R.cantidad === 1 ? '' : 's') + ' · ' + R.nombrePeriodo);
      if (R.cantidad) tabla(['Fecha de pago', 'Semana', 'Período', 'Importe'], R.historial.map(function (p) { return [p.fechaPago || '', String(p.semana), p.rango || '', bs(p.importe)]; }),
        ['Total cobrado', '', '', bs(R.total)], { 1: { halign: 'center' }, 3: { halign: 'right' } });
      else { cuerpo(); doc.setFontSize(9.5); color(COL.suave); doc.text('No hay pagos en este período.', M, y + 2); y += 12; }

      seccion('Trámites', String(R.tramites.length));
      if (R.tramites.length) tabla(['Número', 'Tipo', 'Fecha', 'Estado', 'Respuesta de CONTAX'], R.tramites.map(function (t) {
        return [t.numero, t.tipo, String(t.fecha || '').slice(0, 10), [t.estado || 'Recibido', t.resolucion].filter(Boolean).join(' · '), String(t.comentario || '').slice(0, 180)];
      }), null, { 0: { cellWidth: 22 }, 2: { cellWidth: 22 } });
      else { cuerpo(); doc.setFontSize(9.5); color(COL.suave); doc.text('No tienes trámites registrados.', M, y + 2); y += 12; }

      /* ── Pie en cada página ── */
      var paginas = doc.getNumberOfPages();
      for (var p = 1; p <= paginas; p++) {
        doc.setPage(p);
        color(COL.v100, 'draw'); doc.setLineWidth(0.4); doc.line(M, H - 14, W - M, H - 14);
        doc.addImage(rec.iso, 'PNG', M, H - 11.5, 4.5, 6);
        titulo(); doc.setFontSize(8); color(COL.v700); doc.text('NUMMEROS by CONTAX', M + 6.5, H - 8.6, { charSpace: 0.3 });
        cuerpo(); doc.setFontSize(7); color(COL.suave);
        doc.text('Documento informativo del Portal CONTAX. No reemplaza facturas ni comprobantes de pago.', W / 2 + 8, H - 8.6, { align: 'center' });
        doc.text('Página ' + p + ' de ' + paginas, W - M, H - 8.6, { align: 'right' });
      }

      var f = new Date();
      doc.save('Reporte-CONTAX-' + (d.id || '') + '-' + f.getFullYear() + z(f.getMonth() + 1) + z(f.getDate()) + '.pdf');
    });
  }

  window.NM_PDF = { generar: generar };
})();
