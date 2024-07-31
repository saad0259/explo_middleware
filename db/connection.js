const sql = require("mssql");

const config = {
  port: parseInt(process.env.DB_PORT, 10),
  server: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE,
  requestTimeout: 60000,
  options: {
    encrypt: true,
    trustedConnection: true,
    trustServerCertificate: true,
    timeout: 60000,
    enableArithAbort: true,
    connectionTimeout: 60000,
  },
  pool: {
    max: 10,
    min: 5,
    idleTimeoutMillis: 60000,
  },
};

const pool = new sql.ConnectionPool(config).connect();

module.exports = pool;
