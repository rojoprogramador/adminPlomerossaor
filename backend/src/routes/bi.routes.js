const { Router } = require('express');
const { getDailyStats, getMonthlyStats, getServiceTypeStats, simulateSalary } = require('../controllers/bi.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roles.middleware');

const router = Router();

// Todas las rutas de BI están protegidas y solo accesibles por ADMIN o SUPERADMIN
router.use(authMiddleware, isAdmin);

router.get('/daily', getDailyStats);
router.get('/monthly', getMonthlyStats);
router.get('/service-types', getServiceTypeStats);
router.post('/simulate-salary', simulateSalary);

module.exports = router;
