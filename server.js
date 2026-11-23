const express = require("express");
const path = require("path");
const { DataStore } = require("./src/services/dataStore");
const SquadRepository = require("./src/services/repository");
const createRateLimiter = require("./src/middleware/rateLimit");
const createAuthMiddleware = require("./src/middleware/auth");
const createAuthRoutes = require("./src/routes/authRoutes");
const createApiRoutes = require("./src/routes/apiRoutes");
const createSseHub = require("./src/routes/sseRoutes");
const AppError = require("./src/errors/AppError");

function createApp(customDataPath, options = {}) {
  const app = express();
  const store = new DataStore(customDataPath);
  const repo = new SquadRepository(store);
  const requireAuth = createAuthMiddleware(repo);

  const globalLimiter = createRateLimiter({
    windowMs: 60000,
    maxRequests: options.maxRequestsPerMin || 120
  });
  const authLimiter = createRateLimiter({
    windowMs: 60000,
    maxRequests: options.maxAuthRequestsPerMin || 15,
    message: "Too many authentication attempts. Please wait a minute."
  });

  // Security headers
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    next();
  });

  app.use(express.json({ limit: "64kb" }));
  app.use("/api", globalLimiter);

  // Serve Presentation Tier static files
  app.use(express.static(path.join(__dirname, "public")));

  // Real-Time Server-Sent Events (SSE) hub
  const sseHub = createSseHub(requireAuth);
  app.use("/api/live", sseHub.router);

  // Application Tier routes
  app.use("/api/auth", createAuthRoutes(repo, requireAuth, authLimiter));
  app.use("/api", createApiRoutes(repo, requireAuth, sseHub.broadcastEvent));

  // Handle unmatched API endpoints
  app.use("/api/*", (req, res, next) => {
    next(new AppError(`API endpoint ${req.originalUrl} not found.`, 404, "ENDPOINT_NOT_FOUND"));
  });

  // Structured Global Error Handler
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
      return res.status(400).json({
        error: "Malformed JSON request payload.",
        code: "INVALID_JSON"
      });
    }

    const statusCode = err.isOperational ? err.statusCode : 500;
    const code = err.isOperational ? err.code : "INTERNAL_SERVER_ERROR";
    const message = err.isOperational ? err.message : "An unexpected server error occurred.";

    if (!err.isOperational) {
      console.error("[Unhandled Server Error]:", err);
    }

    res.status(statusCode).json({
      error: message,
      code,
      timestamp: new Date().toISOString()
    });
  });

  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`FitSquad server running at http://localhost:${PORT}`);
  });
}

module.exports = { createApp };
