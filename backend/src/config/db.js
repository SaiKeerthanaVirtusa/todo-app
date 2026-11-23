const { Pool } = require("pg");
require("./env");

module.exports = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
