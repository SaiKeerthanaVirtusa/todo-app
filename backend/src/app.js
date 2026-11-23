const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const config = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const { requireSession } = require("./middleware/session");
const todoRoutes = require("./routes/todoRoutes");
const notFoundHandler = require("./middleware/notFoundHandler");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ============================================
// Security & Middleware Configuration
// ============================================

// CORS Configuration - configured for Next.js frontend origin
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (
      config.corsOrigin.includes("*") ||
      config.corsOrigin.includes(origin) ||
      (!config.isProduction && /^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/.test(origin))
    ) {
      return callback(null, true);
    }

    return callback(new Error(`Origin '${origin}' not allowed by CORS policy.`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

// HTTP Request Logging (disabled during automated unit tests)
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// API Routes
// ============================================

// API Root Status
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    name: "VIT Team 3 To-Do Application API",
    version: "1.0.0",
    description: "Modular Express.js REST API for To-Do Application",
    documentation: "/api/todos",
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// To-Do Resource Routes
app.use("/api/auth", authRoutes);
app.use("/api/todos", requireSession, (req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method) && !req.is("application/json")) {
    return res.status(415).json({ success: false, message: "Send an application/json body." });
  }
  next();
}, todoRoutes);

// ============================================
// Error Handling
// ============================================

// Unmatched route handler (404)
app.use(notFoundHandler);

// Centralized error handler (500 / custom)
app.use(errorHandler);

module.exports = app;
