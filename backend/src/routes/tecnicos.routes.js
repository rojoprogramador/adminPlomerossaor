const router = require('express').Router();
const auth   = require('../middlewares/auth.middleware');
const { isAdmin, isAdminOrAgente } = require('../middlewares/roles.middleware');
const ctrl      = require('../controllers/tecnicos.controller');
const docsCtrl  = require('../controllers/documentos_tecnicos.controller');

router.use(auth);
router.get('/',            ctrl.listar);
router.get('/:id',         ctrl.obtener);
router.get('/:id/nomina',  ctrl.nomina);
router.get('/:id/deudas',  ctrl.deudas);
router.post('/',           isAdmin, ctrl.crear);
router.put('/:id',         isAdmin, ctrl.actualizar);

// Documentos — vista global (debe ir ANTES de /:id/documentos)
router.get('/documentos/todos',         isAdminOrAgente, docsCtrl.listarTodos);

// Documentos del técnico
router.get('/:id/documentos',           isAdminOrAgente, docsCtrl.listar);
router.post('/:id/documentos',          isAdminOrAgente, docsCtrl.crear);
router.put('/:id/documentos/:docId',    isAdminOrAgente, docsCtrl.actualizar);
router.delete('/:id/documentos/:docId', isAdminOrAgente, docsCtrl.eliminar);

module.exports = router;
