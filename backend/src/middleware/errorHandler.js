const config = require("../config/env");

/**
 * Centralized error handling middleware
 * Ensures no sensitive information or internal stack traces are leaked in production
 */
function errorHandler(err, req, res, next) {
  // Handle JSON parse errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Malformed JSON payload in request body.",
      errors: [err.message],
    });
  }

  const databaseErrors = {
    ECONNREFUSED: "PostgreSQL is unreachable. Start PostgreSQL and check DATABASE_URL.",
    "3D000": "The PostgreSQL database does not exist. Create it and run npm run db:migrate.",
    "28P01": "PostgreSQL rejected the credentials. Check DATABASE_URL.",
    "42P01": "The PostgreSQL schema is missing. Run npm run db:migrate in backend.",
  };
  const databaseMessage = databaseErrors[err.code];
  const statusCode = databaseMessage ? 503 : err.statusCode || err.status || 500;
  const message = databaseMessage || (statusCode >= 500 ? "Internal Server Error" : err.message);

  const response = {
    success: false,
    message,
    ...(statusCode < 500 && Array.isArray(err.errors) && { errors: err.errors }),
  };

  // Only include stack trace in non-production environments if explicitly not production
  if (!config.isProduction && err.stack) {
    response.stack = err.stack;
  }

  // Log error details on server side
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.code || err.message || err);

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
