require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, Usuario } = require('../src/models');

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    const hash = await bcrypt.hash('Ortega93', 10);
    const [usuario, created] = await Usuario.findOrCreate({
      where: { email: 'camilobrsc718@gmail.com' },
      defaults: {
        nombre:        'Camilo',
        email:         'camilobrsc718@gmail.com',
        password_hash: hash,
        rol:           'superadmin',
        empresa_id:    null,
        activo:        true,
      },
    });

    if (created) {
      console.log('✓ Superadmin creado');
    } else {
      console.log('→ Superadmin ya existe');
    }
    console.log('  Email:    camilobrsc718@gmail.com');
    console.log('  Password: Ortega93');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
