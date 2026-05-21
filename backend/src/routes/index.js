const router = require('express').Router();

// Fase 1
router.use('/auth',           require('./auth.routes'));
router.use('/empresas',       require('./empresas.routes'));
router.use('/ciudades',       require('./ciudades.routes'));
router.use('/usuarios',       require('./usuarios.routes'));
router.use('/clientes',       require('./clientes.routes'));
router.use('/tecnicos',       require('./tecnicos.routes'));
router.use('/servicios',      require('./servicios.routes'));

// Fase 2
router.use('/garantias',      require('./garantias.routes'));
router.use('/deudas',         require('./deudas.routes'));
router.use('/pagos',          require('./pagos.routes'));
router.use('/agentes',        require('./agentes.routes'));
router.use('/tipos-servicio', require('./tipos-servicio.routes'));
router.use('/reportes',       require('./reportes.routes'));
router.use('/gastos',         require('./gastos.routes'));

module.exports = router;
