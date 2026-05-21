const router = require('express').Router();
const auth   = require('../middlewares/auth.middleware');
const { isAdminOrAgente } = require('../middlewares/roles.middleware');
const ctrl   = require('../controllers/reportes.controller');

router.use(auth, isAdminOrAgente);
router.get('/dashboard',          ctrl.dashboard);
router.get('/cierre-dia',         ctrl.cierreDia);
router.get('/cierre-mensual',     ctrl.cierreMensual);
router.get('/nomina',             ctrl.nomina);
router.get('/garantias-tecnico',  ctrl.garantiasTecnico);
router.get('/exportar-excel',     ctrl.exportarExcel);
router.get('/medios-pago',        ctrl.mediosPago);
router.get('/costos',             ctrl.costos);

module.exports = router;
