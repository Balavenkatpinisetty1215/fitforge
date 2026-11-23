const AppError = require("../errors/AppError");

function createAuthMiddleware(repo) {
  return function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || "";
    let token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    // Also allow query token for EventSource (SSE) connections
    if (!token && typeof req.query.token === "string") {
      token = req.query.token.trim();
    }

    if (!token) {
      return next(new AppError("Authentication token is required.", 401, "AUTH_REQUIRED"));
    }

    const session = repo.getSession(token);
    if (!session || session.expiresAt < Date.now()) {
      return next(new AppError("Invalid or expired session token.", 401, "INVALID_SESSION"));
    }

    const user = repo.findUserById(session.userId);
    if (!user) {
      return next(new AppError("User account no longer exists.", 401, "USER_NOT_FOUND"));
    }

    req.user = user;
    req.token = token;
    next();
  };
}

module.exports = createAuthMiddleware;
