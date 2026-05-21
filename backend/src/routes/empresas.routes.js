const router = require('express').Router();
const auth   = require('../middlewares/auth.middleware');
const { isSuperadmin } = require('../middlewares/roles.middleware');
const ctrl   = require('../controllers/empresas.controller');

router.use(auth, isSuperadmin);
router.get('/',    ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/',   ctrl.crear);
router.put('/:id', ctrl.actualizar);

module.exports = router;
