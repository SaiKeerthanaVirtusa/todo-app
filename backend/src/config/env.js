const dotenv = require("dotenv");
const path = require("path");

// Load .env from backend directory if present
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const config = {
  port: parseInt(process.env.PORT, 10) || 5500,
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : ["http://localhost:3000", "http://127.0.0.1:3000"],
  isProduction: process.env.NODE_ENV === "production",
};

module.exports = config;
