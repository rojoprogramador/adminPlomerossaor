const router = require('express').Router();
const auth   = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roles.middleware');
const ctrl   = require('../controllers/ciudades.controller');

router.use(auth);
router.get('/',    ctrl.listar);
router.post('/',   isAdmin, ctrl.crear);
router.put('/:id', isAdmin, ctrl.actualizar);

module.exports = router;
