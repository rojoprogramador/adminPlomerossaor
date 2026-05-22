const router = require('express').Router();
const auth   = require('../middlewares/auth.middleware');
const { isAdmin, isAdminOrAgente } = require('../middlewares/roles.middleware');
const ctrl   = require('../controllers/reportes.controller');

router.use(auth);
// Visibles para admin y agente SC
router.get('/cierre-dia',         isAdminOrAgente, ctrl.cierreDia);
router.get('/garantias-tecnico',  isAdminOrAgente, ctrl.garantiasTecnico);
router.get('/exportar-excel',     isAdminOrAgente, ctrl.exportarExcel);
// Solo admin/superadmin (datos financieros internos)
router.get('/dashboard',          isAdmin, ctrl.dashboard);
router.get('/cierre-mensual',     isAdmin, ctrl.cierreMensual);
router.get('/nomina',             isAdmin, ctrl.nomina);
router.get('/medios-pago',        isAdmin, ctrl.mediosPago);
router.get('/costos',             isAdmin, ctrl.costos);

module.exports = router;
