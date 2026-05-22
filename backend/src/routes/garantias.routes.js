const router = require('express').Router();
const auth   = require('../middlewares/auth.middleware');
const { isAdmin, isAdminOrAgente } = require('../middlewares/roles.middleware');
const ctrl   = require('../controllers/garantias.controller');

router.use(auth);
router.get('/',              isAdminOrAgente, ctrl.listar);
router.get('/:id',           isAdminOrAgente, ctrl.obtener);
router.post('/:id/reclamar', isAdminOrAgente, ctrl.reclamar);
router.patch('/:id/cerrar',  isAdminOrAgente, ctrl.cerrar);

module.exports = router;
