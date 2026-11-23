const express = require("express");
const crypto = require("crypto");
const { DAILY_MINUTE_CAP } = require("../config/constants");
const { calculateWorkoutPoints, evaluateUserBadges } = require("../services/pointsEngine");
const { sanitizeText, validateWorkoutPayload } = require("../middleware/validate");
const AppError = require("../errors/AppError");

function getPeriodCutoff(period) {
  const days = period === "daily" ? 1 : period === "monthly" ? 30 : 7;
  return Date.now() - days * 86400000;
}

function createApiRoutes(repo, requireAuth, broadcastEvent) {
  const router = express.Router();

  router.get("/dashboard", requireAuth, (req, res) => {
    const period = ["daily", "weekly", "monthly"].includes(req.query.period)
      ? req.query.period
      : "weekly";
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(25, Math.max(1, parseInt(req.query.limit, 10) || 6));

    const db = repo.getDb();
    const currentUser = req.user;
    const activeSquad = repo.findSquadById(currentUser.squadId) || db.squads[0];
    const cutoff = getPeriodCutoff(period);

    const periodWorkouts = db.workouts.filter((w) => w.date >= cutoff);

    // Squad leaderboard ranking
    const leaderboard = db.squads
      .map((sq) => {
        const points = periodWorkouts
          .filter((w) => w.squadId === sq.id)
          .reduce((sum, w) => sum + w.points, 0);
        return { ...sq, points };
      })
      .sort((a, b) => b.points - a.points);

    const squadRank = leaderboard.findIndex((s) => s.id === activeSquad.id) + 1;
    const squadPeriodPoints = leaderboard.find((s) => s.id === activeSquad.id)?.points || 0;

    // Indexed squad members lookup
    const members = repo
      .getSquadMembers(activeSquad.id)
      .map((member) => {
        const points = periodWorkouts
          .filter((w) => w.userId === member.id)
          .reduce((sum, w) => sum + w.points, 0);
        return {
          id: member.id,
          name: member.name,
          avatar: member.avatar,
          points
        };
      })
      .sort((a, b) => b.points - a.points);

    // Pre-sorted indexed personal workouts
    const allUserWorkouts = repo.getUserWorkouts(currentUser.id);
    const personalPeriodPoints = periodWorkouts
      .filter((w) => w.userId === currentUser.id)
      .reduce((sum, w) => sum + w.points, 0);

    const totalPages = Math.max(1, Math.ceil(allUserWorkouts.length / limit));
    const safePage = Math.min(page, totalPages);
    const paginatedWorkouts = allUserWorkouts.slice((safePage - 1) * limit, safePage * limit);

    const allTimeSquadPoints = db.workouts
      .filter((w) => w.squadId === activeSquad.id)
      .reduce((sum, w) => sum + w.points, 0);
    const unlockedBadges = evaluateUserBadges(allUserWorkouts, allTimeSquadPoints);

    // 7-day activity trend
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const start = d.getTime();
      const end = start + 86400000;

      const dayWorkouts = db.workouts.filter((w) => w.date >= start && w.date < end);
      trend.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        userPoints: dayWorkouts
          .filter((w) => w.userId === currentUser.id)
          .reduce((sum, w) => sum + w.points, 0),
        squadPoints: dayWorkouts
          .filter((w) => w.squadId === activeSquad.id)
          .reduce((sum, w) => sum + w.points, 0)
      });
    }

    res.json({
      user: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        squadId: activeSquad.id
      },
      squad: activeSquad,
      stats: {
        personalPoints: personalPeriodPoints,
        squadPoints: squadPeriodPoints,
        squadRank,
        totalSquads: db.squads.length,
        totalWorkouts: allUserWorkouts.length
      },
      leaderboard,
      members,
      unlockedBadges,
      trend,
      workouts: {
        items: paginatedWorkouts,
        page: safePage,
        totalPages,
        totalItems: allUserWorkouts.length
      }
    });
  });

  router.post("/workouts", requireAuth, validateWorkoutPayload, (req, res, next) => {
    const { activity, duration, distance, intensity, note } = req.cleanWorkout;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const minutesLoggedToday = repo
      .getUserWorkouts(req.user.id)
      .filter((w) => w.date >= startOfToday.getTime())
      .reduce((sum, w) => sum + w.duration, 0);

    if (minutesLoggedToday + duration > DAILY_MINUTE_CAP) {
      return next(
        new AppError(
          `Daily limit exceeded. You have ${DAILY_MINUTE_CAP - minutesLoggedToday} minutes remaining today.`,
          400,
          "DAILY_CAP_EXCEEDED"
        )
      );
    }

    const points = calculateWorkoutPoints(activity, duration, intensity);
    const workout = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      squadId: req.user.squadId,
      activity,
      duration,
      distance,
      intensity,
      points,
      note,
      date: Date.now()
    };

    const db = repo.getDb();
    db.workouts.push(workout);
    repo.commit(db);

    // Broadcast live activity update via SSE
    if (broadcastEvent) {
      broadcastEvent("workout_logged", {
        userName: req.user.name,
        squadId: req.user.squadId,
        activity,
        points
      });
    }

    res.status(201).json({ workout });
  });

  router.post("/squads", requireAuth, (req, res, next) => {
    const name = sanitizeText(req.body.name, 32);
    const motto = sanitizeText(req.body.motto, 80) || "Stronger together";
    const goal = Math.max(100, Math.min(10000, Number(req.body.goal) || 1800));

    if (name.length < 3) {
      return next(new AppError("Squad name must be at least 3 characters.", 400, "INVALID_SQUAD_NAME"));
    }

    const db = repo.getDb();
    const id = `squad-${crypto.randomUUID().slice(0, 6)}`;
    const newSquad = { id, name, motto, goal };

    db.squads.push(newSquad);
    const userRecord = db.users.find((u) => u.id === req.user.id);
    if (userRecord) userRecord.squadId = id;

    repo.commit(db);
    res.status(201).json({ squad: newSquad });
  });

  router.post("/squads/join", requireAuth, (req, res, next) => {
    const code = sanitizeText(req.body.code, 24).toLowerCase();
    if (!code) {
      return next(new AppError("Please provide a valid squad invite code.", 400, "MISSING_INVITE_CODE"));
    }

    const db = repo.getDb();
    const targetSquad = db.squads.find((s) => s.id.toLowerCase() === code);

    if (!targetSquad) {
      return next(new AppError("No squad found with that invite code.", 404, "SQUAD_NOT_FOUND"));
    }

    const userRecord = db.users.find((u) => u.id === req.user.id);
    if (userRecord) userRecord.squadId = targetSquad.id;

    repo.commit(db);
    res.json({ squad: targetSquad });
  });

  return router;
}

module.exports = createApiRoutes;
