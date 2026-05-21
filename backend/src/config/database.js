const { Sequelize } = require('sequelize');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: isProduction ? { require: true, rejectUnauthorized: false } : false,
      },
      define: {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST || 'localhost',
        port: Number.parseInt(process.env.DB_PORT) || 5432,
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
          client_encoding: 'UTF8',
        },
        define: {
          timestamps: true,
          createdAt: 'created_at',
          updatedAt: 'updated_at',
        },
      }
    );

module.exports = { sequelize };
