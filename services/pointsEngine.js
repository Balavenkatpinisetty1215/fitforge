const { MET_VALUES, INTENSITY_MULTIPLIERS } = require("../config/constants");
const AppError = require("../errors/AppError");

function calculateWorkoutPoints(activity, durationMinutes, intensity) {
  const met = MET_VALUES[activity];
  const multiplier = INTENSITY_MULTIPLIERS[intensity];

  if (!met || !multiplier || typeof durationMinutes !== "number" || durationMinutes <= 0) {
    throw new AppError("Invalid workout parameters for point calculation.", 400, "INVALID_WORKOUT_PARAMS");
  }

  return Math.round(durationMinutes * met * multiplier * 0.1);
}

function evaluateUserBadges(userWorkouts, squadTotalPoints) {
  const unlocked = [];

  if (userWorkouts.length >= 1) unlocked.push("first");

  const maxRunDistance = userWorkouts
    .filter((w) => w.activity === "Running")
    .reduce((max, w) => Math.max(max, Number(w.distance) || 0), 0);

  if (maxRunDistance >= 5) unlocked.push("5k");
  if (maxRunDistance >= 10) unlocked.push("10k");
  if (userWorkouts.length >= 10) unlocked.push("consistency");

  const uniqueActiveDays = new Set(
    userWorkouts.map((w) => new Date(w.date).toDateString())
  );
  if (uniqueActiveDays.size >= 7) unlocked.push("streak");

  const personalTotalPoints = userWorkouts.reduce((sum, w) => sum + w.points, 0);
  if (personalTotalPoints >= 100) unlocked.push("century");
  if (squadTotalPoints >= 500) unlocked.push("team");

  const distinctActivities = new Set(userWorkouts.map((w) => w.activity));
  if (distinctActivities.size >= 4) unlocked.push("all");

  return unlocked;
}

module.exports = {
  calculateWorkoutPoints,
  evaluateUserBadges
};
