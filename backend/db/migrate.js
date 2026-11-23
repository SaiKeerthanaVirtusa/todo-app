const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const db = require("../src/config/db");

async function migrate() {
  try {
    await db.query(readFileSync(join(__dirname, "schema.sql"), "utf8"));
    console.log("PostgreSQL schema is ready.");
  } finally {
    await db.end();
  }
}

migrate().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
