const express = require("express");
const crypto = require("crypto");
const { hashPassword, verifyPassword } = require("../services/dataStore");
const { sanitizeText } = require("../middleware/validate");
const AppError = require("../errors/AppError");

function createAuthRoutes(repo, requireAuth, authLimiter) {
  const router = express.Router();

  router.post("/register", authLimiter, (req, res, next) => {
    const username = sanitizeText(req.body.username, 24).toLowerCase();
    const name = sanitizeText(req.body.name, 32);
    const password = String(req.body.password || "");
    const squadId = sanitizeText(req.body.squadId, 24) || "iron";

    if (username.length < 3 || name.length < 2) {
      return next(new AppError("Username (min 3 chars) and display name (min 2 chars) are required.", 400, "VALIDATION_ERROR"));
    }
    if (password.length < 6) {
      return next(new AppError("Password must be at least 6 characters long.", 400, "WEAK_PASSWORD"));
    }

    if (repo.findUserByUsername(username)) {
      return next(new AppError("That username is already taken.", 409, "USERNAME_TAKEN"));
    }

    const db = repo.getDb();
    const targetSquad = repo.findSquadById(squadId) || db.squads[0];
    const newUser = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      username,
      name,
      avatar: "🏃",
      squadId: targetSquad.id,
      passwordHash: hashPassword(password)
    };

    const token = crypto.randomBytes(24).toString("hex");
    db.users.push(newUser);
    db.sessions[token] = {
      userId: newUser.id,
      expiresAt: Date.now() + 7 * 86400000
    };
    repo.commit(db);

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        avatar: newUser.avatar,
        squadId: newUser.squadId
      }
    });
  });

  router.post("/login", authLimiter, (req, res, next) => {
    const username = sanitizeText(req.body.username, 24).toLowerCase();
    const password = String(req.body.password || "");

    const user = repo.findUserByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return next(new AppError("Invalid username or password.", 401, "INVALID_CREDENTIALS"));
    }

    const db = repo.getDb();
    const token = crypto.randomBytes(24).toString("hex");
    db.sessions[token] = {
      userId: user.id,
      expiresAt: Date.now() + 7 * 86400000
    };
    repo.commit(db);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        squadId: user.squadId
      }
    });
  });

  router.post("/logout", requireAuth, (req, res) => {
    const db = repo.getDb();
    delete db.sessions[req.token];
    repo.commit(db);
    res.json({ message: "Logged out successfully." });
  });

  return router;
}

module.exports = createAuthRoutes;
