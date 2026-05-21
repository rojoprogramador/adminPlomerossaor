const router = require('express').Router();
const auth   = require('../middlewares/auth.middleware');
const { isAdminOrAgente } = require('../middlewares/roles.middleware');
const ctrl   = require('../controllers/clientes.controller');

router.use(auth);
router.get('/',                    ctrl.listar);
router.get('/buscar-telefono',     ctrl.buscarPorTelefono);
router.get('/:id',                 ctrl.obtener);
router.get('/:id/historial',       ctrl.historial);
router.post('/',                   isAdminOrAgente, ctrl.crear);
router.put('/:id',                 isAdminOrAgente, ctrl.actualizar);

module.exports = router;
