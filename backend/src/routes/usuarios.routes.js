const router = require('express').Router();
const auth   = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roles.middleware');
const ctrl   = require('../controllers/usuarios.controller');

router.use(auth, isAdmin);
router.get('/',                   ctrl.listar);
router.post('/',                  ctrl.crear);
router.put('/:id',                ctrl.actualizar);
router.patch('/:id/password',     ctrl.cambiarPassword);

module.exports = router;
