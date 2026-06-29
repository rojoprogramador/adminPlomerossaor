const XLSX    = require('xlsx');
const { Op }  = require('sequelize');
const {
  Servicio, PagoTecnico, DeudaTecnico, Garantia,
  Tecnico, TipoServicio, Ciudad, Gasto,
} = require('../models');
const { ok, err, serverErr } = require('../utils/respuesta');

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
// GET /api/reportes/dashboard?desde=&hasta=&ciudad_id=
const dashboard = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { desde, hasta, ciudad_id } = req.query;

    const nowBogota = new Date().toLocaleString('en-CA', { timeZone: 'America/Bogota' }).split(',')[0];
    const fechaDesdeStr = desde || (nowBogota.slice(0, 7) + '-01');
    const fechaHastaStr = hasta || nowBogota;

    const whereServicio = {
      empresa_id,
      estado: { [Op.in]: ['completado', 'convertida'] },
      fecha: { [Op.between]: [fechaDesdeStr, fechaHastaStr] },
    };
    if (ciudad_id) whereServicio.ciudad_id = ciudad_id;

    const [pagos, gastosRegistrados] = await Promise.all([
      PagoTecnico.findAll({
        include: [{
          model: Servicio, as: 'servicio',
          where: whereServicio,
          attributes: ['id', 'fecha', 'es_visita', 'es_garantia', 'ciudad_id', 'tipo_servicio_id'],
          include: [{ model: TipoServicio, as: 'tipo_servicio', attributes: ['id', 'nombre'] }],
        }, {
          model: Tecnico, as: 'tecnico', attributes: ['id', 'nombre', 'tipo_pago', 'salario_mensual'],
        }],
      }),
      Gasto.findAll({
        where: { empresa_id, fecha: { [Op.between]: [fechaDesdeStr, fechaHastaStr] } },
      }),
    ]);

    // Totales globales
    const totales = pagos.reduce((acc, p) => {
      acc.bruto           += parseFloat(p.valor_bruto)    || 0;
      acc.costos          += (parseFloat(p.costo_materiales) || 0) + (parseFloat(p.costo_herramienta) || 0);
      acc.neto            += parseFloat(p.valor_neto)     || 0;
      acc.nomina_tecnicos += parseFloat(p.monto_tecnico)  || 0;
      acc.utilidad_bruta  += parseFloat(p.monto_empresa) || 0;
      acc.cantidad        += 1;
      return acc;
    }, { bruto: 0, costos: 0, neto: 0, nomina_tecnicos: 0, utilidad_bruta: 0, cantidad: 0 });

    const total_gastos_operacionales = gastosRegistrados.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
    totales.gastos_operacionales = total_gastos_operacionales;
    totales.utilidad_neta_real   = totales.utilidad_bruta - total_gastos_operacionales;

    // Por técnico
    const por_tecnico = {};
    pagos.forEach(p => {
      const key = p.tecnico_id;
      if (!por_tecnico[key]) por_tecnico[key] = { tecnico: p.tecnico, cantidad: 0, bruto: 0, costos: 0, neto: 0, a_pagar: 0, monto_empresa: 0 };
      por_tecnico[key].cantidad++;
      por_tecnico[key].bruto         += parseFloat(p.valor_bruto)   || 0;
      por_tecnico[key].costos        += (parseFloat(p.costo_materiales) || 0) + (parseFloat(p.costo_herramienta) || 0);
      por_tecnico[key].neto          += parseFloat(p.valor_neto)    || 0;
      por_tecnico[key].a_pagar       += parseFloat(p.monto_tecnico) || 0;
      por_tecnico[key].monto_empresa += parseFloat(p.monto_empresa) || 0;
    });

    // Por tipo de servicio
    const por_tipo = {};
    pagos.forEach(p => {
      const ts = p.servicio?.tipo_servicio;
      if (!ts) return;
      if (!por_tipo[ts.id]) por_tipo[ts.id] = { tipo: ts, cantidad: 0, bruto: 0, neto: 0 };
      por_tipo[ts.id].cantidad++;
      por_tipo[ts.id].bruto += parseFloat(p.valor_bruto) || 0;
      por_tipo[ts.id].neto  += parseFloat(p.valor_neto)  || 0;
    });

    return ok(res, {
      periodo: { desde: fechaDesdeStr, hasta: fechaHastaStr },
      totales,
      por_tecnico:       Object.values(por_tecnico),
      por_tipo_servicio: Object.values(por_tipo),
    });
  } catch (e) { return serverErr(res, e); }
};

// ── CIERRE DEL DÍA ────────────────────────────────────────────────────────────
// GET /api/reportes/cierre-dia?fecha=YYYY-MM-DD&tecnico_id=
const cierreDia = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const fecha      = req.query.fecha || new Date().toLocaleString('en-CA', { timeZone: 'America/Bogota' }).split(',')[0];
    const where      = { empresa_id, fecha };
    if (req.query.tecnico_id) where.tecnico_id = req.query.tecnico_id;

    const servicios = await Servicio.findAll({
      where,
      include: [
        { model: Tecnico,      as: 'tecnico',      attributes: ['id', 'nombre'] },
        { model: TipoServicio, as: 'tipo_servicio', attributes: ['id', 'nombre', 'categoria'] },
        { model: Ciudad,       as: 'ciudad',        attributes: ['id', 'nombre'] },
        { model: PagoTecnico,  as: 'pago_tecnico' },
        { model: DeudaTecnico, as: 'deuda' },
        { model: Garantia,     as: 'garantia',      attributes: ['id', 'estado', 'fecha_vence'] },
      ],
      order: [['created_at', 'ASC']],
    });

    const completados          = servicios.filter(s => ['completado', 'convertida'].includes(s.estado));
    const pendientes           = servicios.filter(s => ['pendiente', 'en_progreso'].includes(s.estado));
    const visitas_no_convertidas = servicios.filter(s => s.es_visita && !['convertida', 'cancelado'].includes(s.estado));

    const totales = completados.reduce((acc, s) => {
      const p = s.pago_tecnico;
      if (!p) return acc;
      acc.bruto           += parseFloat(p.valor_bruto)    || 0;
      acc.costos          += (parseFloat(p.costo_materiales) || 0) + (parseFloat(p.costo_herramienta) || 0);
      acc.neto            += parseFloat(p.valor_neto)     || 0;
      acc.nomina_tecnicos += parseFloat(p.monto_tecnico)  || 0;
      acc.utilidad_empresa += parseFloat(p.monto_empresa) || 0;
      return acc;
    }, { bruto: 0, costos: 0, neto: 0, nomina_tecnicos: 0, utilidad_empresa: 0 });

    const deudas_del_dia = completados
      .filter(s => s.deuda)
      .map(s => ({ servicio_id: s.id, tecnico: s.tecnico, monto_pendiente: s.deuda.monto_pendiente }));

    const garantias_activadas = completados
      .filter(s => s.garantia)
      .map(s => ({ servicio_id: s.id, tecnico: s.tecnico, fecha_vence: s.garantia.fecha_vence }));

    return ok(res, {
      fecha,
      resumen: {
        total_servicios:   servicios.length,
        completados:       completados.length,
        pendientes:        pendientes.length,
        visitas_sin_convertir: visitas_no_convertidas.length,
      },
      totales,
      deudas_generadas:   deudas_del_dia,
      garantias_activadas,
      servicios_pendientes: pendientes,
      visitas_no_convertidas,
      detalle: completados,
    });
  } catch (e) { return serverErr(res, e); }
};

// ── CIERRE MENSUAL ────────────────────────────────────────────────────────────
// GET /api/reportes/cierre-mensual?mes=1-12&anio=YYYY
const cierreMensual = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const mes  = parseInt(req.query.mes)  || (new Date().getMonth() + 1);
    const anio = parseInt(req.query.anio) || new Date().getFullYear();

    if (mes < 1 || mes > 12) return err(res, 'Mes inválido (1-12)');

    const ultimoDia = new Date(anio, mes, 0).getDate();
    const fechaDesdeStr = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const fechaHastaStr = `${anio}-${String(mes).padStart(2, '0')}-${ultimoDia}`;

    const [servicios, gastosDelMes] = await Promise.all([
      Servicio.findAll({
        where: {
          empresa_id,
          fecha: { [Op.between]: [fechaDesdeStr, fechaHastaStr] },
        },
        include: [
          { model: Tecnico,      as: 'tecnico',      attributes: ['id', 'nombre'] },
          { model: TipoServicio, as: 'tipo_servicio', attributes: ['id', 'nombre', 'categoria'] },
          { model: Ciudad,       as: 'ciudad',        attributes: ['id', 'nombre'] },
          { model: PagoTecnico,  as: 'pago_tecnico' },
          { model: DeudaTecnico, as: 'deuda' },
          { model: Garantia,     as: 'garantia',      attributes: ['id', 'estado', 'fecha_vence'] },
        ],
        order: [['fecha', 'ASC'], ['created_at', 'ASC']],
      }),
      Gasto.findAll({
        where: { empresa_id, fecha: { [Op.between]: [fechaDesdeStr, fechaHastaStr] } },
      }),
    ]);

    // 'convertida' = visita resuelta sin pago propio; solo 'completado' genera PagoTecnico
    const completados            = servicios.filter(s => s.estado === 'completado');
    const visitas_convertidas    = servicios.filter(s => s.estado === 'convertida');
    const pendientes             = servicios.filter(s => ['pendiente', 'en_progreso'].includes(s.estado));
    const visitas_no_convertidas = servicios.filter(s => s.es_visita && !['convertida', 'cancelado'].includes(s.estado));

    const totales = completados.reduce((acc, s) => {
      const p = s.pago_tecnico;
      if (!p) return acc;
      acc.bruto            += parseFloat(p.valor_bruto)    || 0;
      acc.costos           += (parseFloat(p.costo_materiales) || 0) + (parseFloat(p.costo_herramienta) || 0);
      acc.neto             += parseFloat(p.valor_neto)     || 0;
      acc.nomina_tecnicos  += parseFloat(p.monto_tecnico)  || 0;
      acc.utilidad_empresa += parseFloat(p.monto_empresa)  || 0;
      return acc;
    }, { bruto: 0, costos: 0, neto: 0, nomina_tecnicos: 0, utilidad_empresa: 0 });

    const gastos_operacionales = gastosDelMes.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
    totales.gastos_operacionales = gastos_operacionales;
    totales.utilidad_neta        = totales.utilidad_empresa - gastos_operacionales;

    const deudas_generadas = completados
      .filter(s => s.deuda)
      .map(s => ({ servicio_id: s.id, tecnico: s.tecnico, monto_pendiente: s.deuda.monto_pendiente }));

    const garantias_activadas = completados
      .filter(s => s.garantia)
      .map(s => ({ servicio_id: s.id, tecnico: s.tecnico, fecha_vence: s.garantia.fecha_vence }));

    // Por técnico (solo completados con pago real)
    const porTecnicoMap = {};
    completados.forEach(s => {
      const p = s.pago_tecnico;
      if (!p) return;
      const tid = s.tecnico_id;
      if (!porTecnicoMap[tid]) porTecnicoMap[tid] = {
        tecnico: s.tecnico, cantidad: 0,
        bruto: 0, costos: 0, neto: 0, a_pagar: 0, monto_empresa: 0,
      };
      porTecnicoMap[tid].cantidad++;
      porTecnicoMap[tid].bruto         += parseFloat(p.valor_bruto)      || 0;
      porTecnicoMap[tid].costos        += (parseFloat(p.costo_materiales) || 0) + (parseFloat(p.costo_herramienta) || 0);
      porTecnicoMap[tid].neto          += parseFloat(p.valor_neto)       || 0;
      porTecnicoMap[tid].a_pagar       += parseFloat(p.monto_tecnico)    || 0;
      porTecnicoMap[tid].monto_empresa += parseFloat(p.monto_empresa)    || 0;
    });

    return ok(res, {
      periodo: { mes, anio, desde: fechaDesdeStr, hasta: fechaHastaStr },
      resumen: {
        total_servicios:      servicios.length,
        completados:          completados.length,
        visitas_convertidas:  visitas_convertidas.length,
        pendientes:           pendientes.length,
        visitas_sin_convertir: visitas_no_convertidas.length,
      },
      totales,
      por_tecnico:       Object.values(porTecnicoMap),
      deudas_generadas,
      garantias_activadas,
    });
  } catch (e) { return serverErr(res, e); }
};

// ── CIERRE SEMANAL ────────────────────────────────────────────────────────────
// GET /api/reportes/cierre-semanal?fecha=YYYY-MM-DD  (cualquier día de la semana)
const cierreSemanal = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const nowBogota  = new Date().toLocaleString('en-CA', { timeZone: 'America/Bogota' }).split(',')[0];
    const referencia = req.query.fecha || nowBogota;

    const d = new Date(referencia + 'T12:00:00');
    const diffToMonday = d.getDay() === 0 ? -6 : 1 - d.getDay();
    const lunes   = new Date(d); lunes.setDate(d.getDate() + diffToMonday);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    const toStr   = x => x.toISOString().split('T')[0];
    const fechaDesdeStr = toStr(lunes);
    const fechaHastaStr = toStr(domingo);

    const servicios = await Servicio.findAll({
      where: { empresa_id, fecha: { [Op.between]: [fechaDesdeStr, fechaHastaStr] } },
      include: [
        { model: Tecnico,      as: 'tecnico',      attributes: ['id', 'nombre'] },
        { model: TipoServicio, as: 'tipo_servicio', attributes: ['id', 'nombre'] },
        { model: PagoTecnico,  as: 'pago_tecnico' },
      ],
      order: [['fecha', 'ASC'], ['created_at', 'ASC']],
    });

    const completados = servicios.filter(s => s.estado === 'completado');
    const pendientes  = servicios.filter(s => ['pendiente', 'en_progreso', 'en_cotizacion'].includes(s.estado));

    const totales = completados.reduce((acc, s) => {
      const p = s.pago_tecnico;
      if (!p) return acc;
      acc.bruto            += parseFloat(p.valor_bruto)    || 0;
      acc.costos           += (parseFloat(p.costo_materiales) || 0) + (parseFloat(p.costo_herramienta) || 0);
      acc.neto             += parseFloat(p.valor_neto)     || 0;
      acc.nomina_tecnicos  += parseFloat(p.monto_tecnico)  || 0;
      acc.utilidad_empresa += parseFloat(p.monto_empresa)  || 0;
      return acc;
    }, { bruto: 0, costos: 0, neto: 0, nomina_tecnicos: 0, utilidad_empresa: 0 });

    const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const por_dia = Array.from({ length: 7 }, (_, i) => {
      const dia = new Date(lunes); dia.setDate(lunes.getDate() + i);
      const fechaDia  = toStr(dia);
      const svsDia    = servicios.filter(s => s.fecha === fechaDia);
      const compDia   = svsDia.filter(s => s.estado === 'completado');
      const { bruto, utilidad } = compDia.reduce((a, s) => {
        const p = s.pago_tecnico;
        if (p) { a.bruto += parseFloat(p.valor_bruto) || 0; a.utilidad += parseFloat(p.monto_empresa) || 0; }
        return a;
      }, { bruto: 0, utilidad: 0 });
      return { fecha: fechaDia, dia: DIAS[i], total: svsDia.length, completados: compDia.length, bruto, utilidad };
    });

    const porTecnicoMap = {};
    completados.forEach(s => {
      const p = s.pago_tecnico;
      if (!p) return;
      const tid = s.tecnico_id;
      if (!porTecnicoMap[tid]) porTecnicoMap[tid] = { tecnico: s.tecnico, cantidad: 0, bruto: 0, a_pagar: 0, monto_empresa: 0 };
      porTecnicoMap[tid].cantidad++;
      porTecnicoMap[tid].bruto         += parseFloat(p.valor_bruto)   || 0;
      porTecnicoMap[tid].a_pagar       += parseFloat(p.monto_tecnico) || 0;
      porTecnicoMap[tid].monto_empresa += parseFloat(p.monto_empresa) || 0;
    });

    return ok(res, {
      periodo: { desde: fechaDesdeStr, hasta: fechaHastaStr },
      resumen: { total_servicios: servicios.length, completados: completados.length, pendientes: pendientes.length },
      totales,
      por_dia,
      por_tecnico: Object.values(porTecnicoMap),
    });
  } catch (e) { return serverErr(res, e); }
};

// ── NÓMINA MENSUAL ────────────────────────────────────────────────────────────
// GET /api/reportes/nomina?mes=1-12&anio=YYYY
const nomina = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const mes  = parseInt(req.query.mes)  || (new Date().getMonth() + 1);
    const anio = parseInt(req.query.anio) || new Date().getFullYear();

    if (mes < 1 || mes > 12) return err(res, 'Mes inválido (1-12)');

    const ultimoDia = new Date(anio, mes, 0).getDate();
    const desde = new Date(`${anio}-${String(mes).padStart(2, '0')}-01T00:00:00-05:00`);
    const hasta = new Date(`${anio}-${String(mes).padStart(2, '0')}-${ultimoDia}T23:59:59-05:00`);

    const tecnicos = await Tecnico.findAll({ where: { empresa_id }, attributes: ['id', 'nombre', 'saldo_deuda'] });
    const tecnico_ids = tecnicos.map(t => t.id);

    const pagos = await PagoTecnico.findAll({
      where: {
        tecnico_id: { [Op.in]: tecnico_ids },
        fecha_registro: { [Op.between]: [desde, hasta] },
      },
      include: [{
        model: Servicio, as: 'servicio',
        attributes: ['id', 'fecha', 'es_visita'],
      }],
    });

    const porTecnico = {};
    tecnicos.forEach(t => {
      porTecnico[t.id] = { tecnico: t, cantidad: 0, bruto: 0, costos: 0, neto: 0, a_pagar: 0, pagado: 0, pendiente: 0 };
    });

    pagos.forEach(p => {
      const row = porTecnico[p.tecnico_id];
      if (!row) return;
      row.cantidad++;
      row.bruto   += parseFloat(p.valor_bruto)   || 0;
      row.costos  += (parseFloat(p.costo_materiales) || 0) + (parseFloat(p.costo_herramienta) || 0);
      row.neto    += parseFloat(p.valor_neto)    || 0;
      row.a_pagar += parseFloat(p.monto_tecnico) || 0;
      if (p.estado_entrega === 'entregado') row.pagado    += parseFloat(p.monto_tecnico) || 0;
      else                                  row.pendiente += parseFloat(p.monto_tecnico) || 0;
    });

    const resumen_global = Object.values(porTecnico).reduce((acc, r) => {
      acc.bruto   += r.bruto;
      acc.costos  += r.costos;
      acc.neto    += r.neto;
      acc.a_pagar += r.a_pagar;
      return acc;
    }, { bruto: 0, costos: 0, neto: 0, a_pagar: 0 });

    return ok(res, {
      periodo: { mes, anio, desde, hasta },
      resumen_global,
      por_tecnico: Object.values(porTecnico).filter(r => r.cantidad > 0),
    });
  } catch (e) { return serverErr(res, e); }
};

// ── GARANTÍAS POR TÉCNICO ─────────────────────────────────────────────────────
// GET /api/reportes/garantias-tecnico?desde=&hasta=
const garantiasTecnico = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { desde, hasta } = req.query;

    const nowBogota = new Date().toLocaleString('en-CA', { timeZone: 'America/Bogota' }).split(',')[0];
    const fechaDesde = desde ? new Date(desde + 'T00:00:00-05:00') : new Date(nowBogota.slice(0, 7) + '-01T00:00:00-05:00');
    const fechaHasta = hasta ? new Date(hasta + 'T23:59:59-05:00') : new Date(nowBogota + 'T23:59:59-05:00');

    const tecnicos = await Tecnico.findAll({
      where: { empresa_id },
      attributes: ['id', 'nombre'],
    });
    const tecnico_ids = tecnicos.map(t => t.id);

    // Servicios completados en el período
    const servicios = await Servicio.findAll({
      where: {
        empresa_id,
        estado:          'completado',
        es_visita:       false,
        es_garantia:     false,
        fecha_completado: { [Op.between]: [fechaDesde, fechaHasta] },
      },
      attributes: ['id', 'tecnico_id'],
    });

    // Garantías reclamadas en el período
    const garantiasReclamadas = await Garantia.findAll({
      where: {
        tecnico_id: { [Op.in]: tecnico_ids },
        estado:     { [Op.in]: ['reclamada', 'resuelta'] },
        fecha_atencion: { [Op.between]: [fechaDesde.toISOString().split('T')[0], fechaHasta.toISOString().split('T')[0]] },
      },
      attributes: ['id', 'tecnico_id', 'estado'],
    });

    const resultado = tecnicos.map(t => {
      const svs      = servicios.filter(s => s.tecnico_id === t.id).length;
      const reclamadas = garantiasReclamadas.filter(g => g.tecnico_id === t.id).length;
      const porcentaje = svs > 0 ? Math.round((reclamadas / svs) * 100) : 0;
      return { tecnico: t, servicios_realizados: svs, garantias_reclamadas: reclamadas, porcentaje_reclamacion: porcentaje };
    }).filter(r => r.servicios_realizados > 0);

    return ok(res, {
      periodo: { desde: fechaDesde, hasta: fechaHasta },
      por_tecnico: resultado,
    });
  } catch (e) { return serverErr(res, e); }
};

// ── EXPORTAR EXCEL ────────────────────────────────────────────────────────────
// GET /api/reportes/exportar-excel?desde=&hasta=&ciudad_id=&tecnico_id=
const exportarExcel = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { desde, hasta, ciudad_id, tecnico_id } = req.query;

    const nowBogota = new Date().toLocaleString('en-CA', { timeZone: 'America/Bogota' }).split(',')[0];
    const fechaDesde = desde ? new Date(desde + 'T00:00:00-05:00') : new Date(nowBogota.slice(0, 7) + '-01T00:00:00-05:00');
    const fechaHasta = hasta ? new Date(hasta + 'T23:59:59-05:00') : new Date(nowBogota + 'T23:59:59-05:00');

    const where = { 
      empresa_id, 
      fecha_completado: { [Op.between]: [fechaDesde, fechaHasta] }, 
      estado: { [Op.in]: ['completado', 'convertida'] } 
    };
    if (ciudad_id)  where.ciudad_id  = ciudad_id;
    if (tecnico_id) where.tecnico_id = tecnico_id;

    const servicios = await Servicio.findAll({
      where,
      include: [
        { model: Tecnico,      as: 'tecnico',       attributes: ['nombre'] },
        { model: TipoServicio, as: 'tipo_servicio',  attributes: ['nombre'] },
        { model: Ciudad,       as: 'ciudad',         attributes: ['nombre'] },
        { model: PagoTecnico,  as: 'pago_tecnico' },
      ],
      order: [['fecha_completado', 'ASC']],
    });

    const filas = servicios.map(s => ({
      id:                   s.id,
      fecha:                s.fecha,
      fecha_completado:     s.fecha_completado ? s.fecha_completado.toISOString().split('T')[0] : '',
      tecnico:              s.tecnico?.nombre   || '',
      tipo_servicio:        s.tipo_servicio?.nombre || '',
      ciudad:               s.ciudad?.nombre    || '',
      cliente:              s.nombre_cliente_anon || '',
      telefono:             s.telefono_cliente_anon || '',
      valor_bruto:          parseFloat(s.pago_tecnico?.valor_bruto)    || 0,
      costo_materiales:     parseFloat(s.pago_tecnico?.costo_materiales) || 0,
      costo_herramienta:    parseFloat(s.pago_tecnico?.costo_herramienta) || 0,
      valor_neto:           parseFloat(s.pago_tecnico?.valor_neto)     || 0,
      monto_tecnico:        parseFloat(s.pago_tecnico?.monto_tecnico)  || 0,
      monto_empresa:        parseFloat(s.pago_tecnico?.monto_empresa)  || 0,
      medio_pago:           s.medio_pago || '',
      es_visita:            s.es_visita  ? 'Sí' : 'No',
      es_garantia:          s.es_garantia ? 'Sí' : 'No',
      observaciones:        s.observaciones || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);
    XLSX.utils.book_append_sheet(wb, ws, 'Servicios');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const nombre = `servicios_${fechaDesde.toISOString().split('T')[0]}_${fechaHasta.toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    return res.send(buffer);
  } catch (e) { return serverErr(res, e); }
};

// ── MEDIOS DE PAGO ────────────────────────────────────────────────────────────
// GET /api/reportes/medios-pago?desde=&hasta=
const mediosPago = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { desde, hasta } = req.query;

    const nowBogota = new Date().toLocaleString('en-CA', { timeZone: 'America/Bogota' }).split(',')[0];
    const fechaDesde = desde ? new Date(desde + 'T00:00:00-05:00') : new Date(nowBogota.slice(0, 7) + '-01T00:00:00-05:00');
    const fechaHasta = hasta ? new Date(hasta + 'T23:59:59-05:00') : new Date(nowBogota + 'T23:59:59-05:00');

    const pagos = await PagoTecnico.findAll({
      include: [{
        model: Servicio, as: 'servicio',
        where: { 
          empresa_id, 
          estado: { [Op.in]: ['completado', 'convertida'] }, 
          fecha_completado: { [Op.between]: [fechaDesde, fechaHasta] } 
        },
        attributes: ['medio_pago'],
      }],
    });

    const agrupado = {};
    pagos.forEach(p => {
      const medio = p.servicio?.medio_pago || 'sin_especificar';
      if (!agrupado[medio]) agrupado[medio] = { medio_pago: medio, cantidad: 0, bruto: 0, neto: 0, monto_empresa: 0 };
      agrupado[medio].cantidad++;
      agrupado[medio].bruto        += parseFloat(p.valor_bruto)   || 0;
      agrupado[medio].neto         += parseFloat(p.valor_neto)    || 0;
      agrupado[medio].monto_empresa += parseFloat(p.monto_empresa) || 0;
    });

    const total_neto = Object.values(agrupado).reduce((s, r) => s + r.neto, 0);
    const resultado  = Object.values(agrupado).map(r => ({
      ...r,
      porcentaje: total_neto > 0 ? Math.round((r.neto / total_neto) * 100) : 0,
    }));

    return ok(res, {
      periodo: { desde: fechaDesde, hasta: fechaHasta },
      total_servicios: pagos.length,
      por_medio: resultado,
    });
  } catch (e) { return serverErr(res, e); }
};

// ── REPORTE DE COSTOS ─────────────────────────────────────────────────────────
// GET /api/reportes/costos?desde=&hasta=
const costos = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { desde, hasta } = req.query;

    const nowBogota = new Date().toLocaleString('en-CA', { timeZone: 'America/Bogota' }).split(',')[0];
    const fechaDesde = desde ? new Date(desde + 'T00:00:00-05:00') : new Date(nowBogota.slice(0, 7) + '-01T00:00:00-05:00');
    const fechaHasta = hasta ? new Date(hasta + 'T23:59:59-05:00') : new Date(nowBogota + 'T23:59:59-05:00');
    const fechaDesdeStr = fechaDesde.toISOString().split('T')[0];
    const fechaHastaStr = fechaHasta.toISOString().split('T')[0];

    const [pagos, gastosRegistrados] = await Promise.all([
      PagoTecnico.findAll({
        include: [{
          model: Servicio, as: 'servicio',
          where: { 
            empresa_id, 
            estado: { [Op.in]: ['completado', 'convertida'] }, 
            fecha_completado: { [Op.between]: [fechaDesde, fechaHasta] } 
          },
          attributes: ['id', 'tiene_materiales', 'tiene_herramienta'],
          include: [{ model: TipoServicio, as: 'tipo_servicio', attributes: ['id', 'nombre'] }],
        }],
      }),
      Gasto.findAll({
        where: { empresa_id, fecha: { [Op.between]: [fechaDesdeStr, fechaHastaStr] } },
        order: [['fecha', 'ASC']],
      }),
    ]);

    const totales = pagos.reduce((acc, p) => {
      acc.bruto             += parseFloat(p.valor_bruto)       || 0;
      acc.costo_materiales  += parseFloat(p.costo_materiales)  || 0;
      acc.costo_herramienta += parseFloat(p.costo_herramienta) || 0;
      acc.neto              += parseFloat(p.valor_neto)        || 0;
      acc.nomina_tecnicos   += parseFloat(p.monto_tecnico)     || 0;
      acc.utilidad_bruta    += parseFloat(p.monto_empresa)     || 0;
      if (parseFloat(p.costo_materiales)  > 0) acc.con_materiales++;
      if (parseFloat(p.costo_herramienta) > 0) acc.con_herramienta++;
      return acc;
    }, { bruto: 0, costo_materiales: 0, costo_herramienta: 0, neto: 0, nomina_tecnicos: 0, utilidad_bruta: 0, con_materiales: 0, con_herramienta: 0 });

    // Agrupar gastos por categoría
    const gastos_por_categoria = {};
    let total_gastos_manuales = 0;
    gastosRegistrados.forEach(g => {
      const cat = g.categoria;
      if (!gastos_por_categoria[cat]) gastos_por_categoria[cat] = { categoria: cat, total: 0, items: [] };
      gastos_por_categoria[cat].total += parseFloat(g.monto) || 0;
      gastos_por_categoria[cat].items.push(g);
      total_gastos_manuales += parseFloat(g.monto) || 0;
    });

    const total_costos_directos = totales.costo_materiales + totales.costo_herramienta;
    const utilidad_neta = totales.utilidad_bruta - total_gastos_manuales;

    const resumen = {
      ...totales,
      total_costos_directos,
      total_gastos_manuales,
      utilidad_neta,
      pct_costos_directos: totales.bruto > 0 ? Math.round((total_costos_directos      / totales.bruto) * 100) : 0,
      pct_nomina:          totales.bruto > 0 ? Math.round((totales.nomina_tecnicos     / totales.bruto) * 100) : 0,
      pct_gastos_manuales: totales.bruto > 0 ? Math.round((total_gastos_manuales       / totales.bruto) * 100) : 0,
      pct_utilidad_neta:   totales.bruto > 0 ? Math.round((utilidad_neta               / totales.bruto) * 100) : 0,
    };

    // Breakdown por tipo de servicio
    const por_tipo = {};
    pagos.forEach(p => {
      const ts = p.servicio?.tipo_servicio;
      if (!ts) return;
      if (!por_tipo[ts.id]) por_tipo[ts.id] = { tipo: ts, cantidad: 0, bruto: 0, costos: 0, neto: 0 };
      por_tipo[ts.id].cantidad++;
      por_tipo[ts.id].bruto  += parseFloat(p.valor_bruto)  || 0;
      por_tipo[ts.id].costos += (parseFloat(p.costo_materiales) || 0) + (parseFloat(p.costo_herramienta) || 0);
      por_tipo[ts.id].neto   += parseFloat(p.valor_neto)   || 0;
    });

    return ok(res, {
      periodo:           { desde: fechaDesde, hasta: fechaHasta },
      resumen,
      gastos_por_categoria: Object.values(gastos_por_categoria),
      gastos_detalle:    gastosRegistrados,
      por_tipo_servicio: Object.values(por_tipo),
    });
  } catch (e) { return serverErr(res, e); }
};

module.exports = { dashboard, cierreDia, cierreSemanal, cierreMensual, nomina, garantiasTecnico, exportarExcel, mediosPago, costos };
