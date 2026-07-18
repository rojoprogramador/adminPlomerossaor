const { sequelize, Servicio, Tecnico } = require('../models');
const { Op } = require('sequelize');

// Obtener estadísticas diarias: número de trabajos y visitas por día, y agrupado por técnico
const getDailyStats = async (req, res) => {
  try {
    const { empresa_id } = req.usuario;
    const { start_date, end_date } = req.query; // opcional

    let dateFilter = {};
    if (start_date && end_date) {
      dateFilter = { fecha: { [Op.between]: [start_date, end_date] } };
    }

    // Totales por día
    const dailyTotals = await Servicio.findAll({
      where: { empresa_id, ...dateFilter },
      attributes: [
        'fecha',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_servicios'],
        [sequelize.literal(`SUM(CASE WHEN es_visita = true THEN 1 ELSE 0 END)`), 'total_visitas'],
        [sequelize.literal(`SUM(CASE WHEN es_visita = false THEN 1 ELSE 0 END)`), 'total_trabajos'],
        [sequelize.fn('SUM', sequelize.col('valor')), 'ingresos_totales']
      ],
      group: ['fecha'],
      order: [['fecha', 'ASC']]
    });

    // Totales por técnico y día
    const techDailyTotals = await Servicio.findAll({
      where: { empresa_id, ...dateFilter },
      attributes: [
        'fecha',
        'tecnico_id',
        [sequelize.fn('COUNT', sequelize.col('Servicio.id')), 'total_servicios'],
        [sequelize.literal(`SUM(CASE WHEN es_visita = true THEN 1 ELSE 0 END)`), 'total_visitas'],
        [sequelize.literal(`SUM(CASE WHEN es_visita = false THEN 1 ELSE 0 END)`), 'total_trabajos']
      ],
      include: [{ model: Tecnico, as: 'tecnico', attributes: ['nombre'] }],
      group: ['fecha', 'tecnico_id', 'tecnico.id'],
      order: [['fecha', 'ASC'], ['tecnico_id', 'ASC']]
    });

    res.json({ dailyTotals, techDailyTotals });
  } catch (error) {
    console.error('Error en getDailyStats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas diarias' });
  }
};

// Obtener estadísticas mensuales
const getMonthlyStats = async (req, res) => {
  try {
    const { empresa_id } = req.usuario;

    const monthlyTotals = await Servicio.findAll({
      where: { empresa_id },
      attributes: [
        [sequelize.fn('TO_CHAR', sequelize.col('fecha'), 'YYYY-MM'), 'mes'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_servicios'],
        [sequelize.literal(`SUM(CASE WHEN es_visita = true THEN 1 ELSE 0 END)`), 'total_visitas'],
        [sequelize.literal(`SUM(CASE WHEN es_visita = false THEN 1 ELSE 0 END)`), 'total_trabajos'],
        [sequelize.fn('SUM', sequelize.col('valor')), 'ingresos_totales']
      ],
      group: [sequelize.fn('TO_CHAR', sequelize.col('fecha'), 'YYYY-MM')],
      order: [[sequelize.fn('TO_CHAR', sequelize.col('fecha'), 'YYYY-MM'), 'ASC']]
    });

    res.json({ monthlyTotals });
  } catch (error) {
    console.error('Error en getMonthlyStats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas mensuales' });
  }
};

// Simulador de Salario Fijo vs Porcentaje
const simulateSalary = async (req, res) => {
  try {
    const { empresa_id } = req.usuario;
    const { tecnico_id, mes_anio, salario_fijo_propuesto } = req.body; 
    // mes_anio en formato 'YYYY-MM'

    if (!tecnico_id || !mes_anio || !salario_fijo_propuesto) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const [year, month] = mes_anio.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // ultimo dia del mes

    // Buscar todos los servicios de ese técnico en ese mes
    const servicios = await Servicio.findAll({
      where: { 
        empresa_id, 
        tecnico_id,
        fecha: { [Op.between]: [startDate, endDate] }
      },
      attributes: ['id', 'valor', 'tiene_materiales', 'costo_materiales', 'tiene_herramienta', 'costo_herramienta', 'es_visita', 'tecnico_recibe_total', 'porcentaje_tecnico_override']
    });

    const tecnico = await Tecnico.findByPk(tecnico_id);

    let comisionTotal = 0;
    let ingresosTotalesEmpresa = 0;

    // Calculamos lo que ganó el técnico en ese periodo
    servicios.forEach(s => {
      let valorNeto = parseFloat(s.valor || 0);
      if (s.tiene_materiales) valorNeto -= parseFloat(s.costo_materiales || 0);
      if (s.tiene_herramienta) valorNeto -= parseFloat(s.costo_herramienta || 0);

      ingresosTotalesEmpresa += valorNeto;

      if (s.tecnico_recibe_total) {
        comisionTotal += valorNeto;
      } else {
        // En la vida real, sacarías el % general de la tabla TipoServicio.
        // Pero para el simulador, asumiremos un 40% o el override si lo tiene.
        let porcentaje = s.porcentaje_tecnico_override ? parseFloat(s.porcentaje_tecnico_override) : 40; 
        comisionTotal += valorNeto * (porcentaje / 100);
      }
    });

    const diferencia = comisionTotal - parseFloat(salario_fijo_propuesto);
    const convieneFijo = diferencia > 0; // Si la comision que le pagas es mayor al sueldo fijo, conviene fijo.

    res.json({
      tecnico: tecnico.nombre,
      periodo: mes_anio,
      total_trabajos: servicios.length,
      ingresos_generados_netos: ingresosTotalesEmpresa,
      comision_pagada_historica: comisionTotal,
      salario_fijo_propuesto: parseFloat(salario_fijo_propuesto),
      diferencia_a_favor_empresa: diferencia,
      conviene_fijo: convieneFijo
    });

  } catch (error) {
    console.error('Error en simulateSalary:', error);
    res.status(500).json({ error: 'Error en simulación' });
  }
};

module.exports = {
  getDailyStats,
  getMonthlyStats,
  simulateSalary
};
