# Plomeros SAOR — Sistema de Gestión

Sistema de gestión para empresas de plomería. Multi-empresa, con control de servicios, técnicos, garantías, deudas y documentos.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL |
| ORM | Sequelize |
| Auth | JWT |

---

## Estructura del proyecto

```
plomeros-saor/
├── backend/
│   ├── src/
│   │   ├── config/          # DB, constantes
│   │   ├── models/          # Modelos Sequelize (13 tablas)
│   │   ├── controllers/     # Lógica de cada módulo
│   │   ├── routes/          # Endpoints REST
│   │   ├── middlewares/     # Auth, roles, empresa
│   │   ├── services/        # Lógica de negocio (cálculos)
│   │   ├── utils/           # Helpers
│   │   └── uploads/         # Archivos temporales
│   ├── migrations/
│   ├── seeders/
│   └── package.json
└── frontend/                # Next.js 14 (por configurar)
```

---

## Setup del backend

### 1. Requisitos
- Node.js >= 18
- PostgreSQL >= 14

### 2. Instalar dependencias
```bash
cd backend
npm install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL
```

### 4. Crear la base de datos en PostgreSQL
```sql
CREATE DATABASE plomeros_saor;
```

### 5. Correr el servidor en desarrollo
```bash
npm run dev
```
El servidor arranca en `http://localhost:3001`.
En desarrollo, Sequelize sincroniza los modelos automáticamente con `alter: true`.

---

## Variables de entorno (.env)

```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=plomeros_saor
DB_USER=postgres
DB_PASSWORD=tu_password

JWT_SECRET=minimo_32_caracteres_cambia_esto
JWT_EXPIRES_IN=8h

FRONTEND_URL=http://localhost:3000
```

---

## Modelos (13 tablas)

| Modelo | Archivo | Descripción |
|---|---|---|
| Empresa | models/Empresa.js | Raíz multi-empresa |
| Ciudad | models/entidades.js | Cali, Jamundí, Yumbo |
| Usuario | models/entidades.js | Roles: superadmin/admin/agente_sc/tecnico |
| Cliente | models/entidades.js | Todos los campos opcionales |
| Tecnico | models/entidades.js | Con saldo_deuda acumulado |
| AgenteSC | models/entidades.js | Pago semanal los sábados |
| TipoServicio | models/Servicio.js | Catálogo configurable |
| Servicio | models/Servicio.js | Tabla central del sistema |
| Garantia | models/financiero.js | 30 días automáticos |
| PagoTecnico | models/financiero.js | Generado al completar servicio |
| DeudaTecnico | models/financiero.js | Cobros en efectivo pendientes |
| PagoAgente | models/financiero.js | Semanal, cada sábado |
| Documento | models/financiero.js | Recibos y facturas PDF |

---

## Lógica de cálculo de pagos

Ver `src/services/calculoPago.service.js`

**Jerarquía del porcentaje:**
1. `tecnico_recibe_total = true` → 100%
2. `porcentaje_tecnico_override` tiene valor → ese valor
3. `TipoServicio.porcentaje_tecnico` tiene valor → ese valor
4. `Empresa.porcentaje_tecnico` → ese valor
5. Default global → 60%

**Fórmula:**
```
valor_neto = valor_bruto - (tiene_materiales ? costo_materiales : 0) - (tiene_herramienta ? costo_herramienta : 0)
monto_tecnico = valor_neto × porcentaje_aplicado
monto_empresa = valor_neto - monto_tecnico
```

---

## API endpoints principales

```
POST   /api/auth/login
GET    /api/servicios
POST   /api/servicios
PATCH  /api/servicios/:id/completar
PATCH  /api/servicios/:id/convertir
POST   /api/servicios/bulk
POST   /api/servicios/bulk/excel
GET    /api/garantias
POST   /api/garantias/:id/reclamar
GET    /api/pagos/tecnicos
GET    /api/deudas
GET    /api/reportes/dashboard
GET    /api/reportes/cierre-dia
```
