require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { sequelize } = require('./models');
const routes = require('./routes');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use((req, res, next) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); next(); });
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV }));

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

const PORT = process.env.PORT || 3001;

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('DB conectada');
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('Modelos sincronizados');
    }
    app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
  } catch (e) {
    console.error('Error al iniciar:', e);
    process.exit(1);
  }
};

start();

module.exports = app;
