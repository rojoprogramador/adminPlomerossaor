const router = require('express').Router();
const auth   = require('../middlewares/auth.middleware');
const { isAdmin, isAdminOrAgente } = require('../middlewares/roles.middleware');
const ctrl   = require('../controllers/pagos.controller');

router.use(auth);

// Pagos técnicos
router.get('/tecnicos',              isAdmin,         ctrl.listarTecnicos);
router.patch('/tecnicos/:id/entregar', isAdmin,       ctrl.entregarPago);

// Pagos agente SC
router.get('/agentes',                  isAdmin, ctrl.listarAgentes);
router.post('/agentes/calcular-semana', isAdmin, ctrl.calcularSemana);
router.patch('/agentes/:id/pagar',      isAdmin, ctrl.pagarAgente);

module.exports = router;
