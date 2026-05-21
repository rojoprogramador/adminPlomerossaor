const router = require('express').Router();
const auth   = require('../middlewares/auth.middleware');
const { isAdmin, isAdminOrAgente } = require('../middlewares/roles.middleware');
const ctrl     = require('../controllers/servicios.controller');
const bulkCtrl = require('../controllers/bulk.controller');

router.use(auth);

// Bulk — must be before /:id to avoid route shadowing
router.get('/bulk/plantilla',  isAdminOrAgente, bulkCtrl.plantilla);
router.post('/bulk',           isAdminOrAgente, bulkCtrl.bulkJSON);
router.post('/bulk/excel',     isAdminOrAgente, bulkCtrl.bulkExcel);

router.get('/',                 ctrl.listar);
router.get('/:id',              ctrl.obtener);
router.post('/',                isAdminOrAgente, ctrl.crear);
router.put('/:id',              isAdminOrAgente, ctrl.actualizar);
router.patch('/:id/completar',  isAdminOrAgente, ctrl.completar);
router.patch('/:id/convertir',  isAdminOrAgente, ctrl.convertir);
router.patch('/:id/cancelar',   isAdminOrAgente, ctrl.cancelar);

module.exports = router;
