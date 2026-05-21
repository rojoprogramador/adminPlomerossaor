const router = require('express').Router();
const auth   = require('../middlewares/auth.middleware');
const { isAdmin, isAdminOrAgente } = require('../middlewares/roles.middleware');
const ctrl   = require('../controllers/deudas.controller');

router.use(auth);
router.get('/',            isAdminOrAgente, ctrl.listar);
router.post('/:id/abonar', isAdmin,         ctrl.abonar);

module.exports = router;
