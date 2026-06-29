const router = require('express').Router();
const auth    = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roles.middleware');
const { listar, crear } = require('../controllers/ajustes.controller');

router.get('/',  auth, listar);
router.post('/', auth, isAdmin, crear);

module.exports = router;
