const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateWorkoutPoints, evaluateUserBadges } = require("../src/services/pointsEngine");

test("calculateWorkoutPoints computes accurate MET-based scores", () => {
  assert.equal(calculateWorkoutPoints("Running", 30, "High"), 37);
  assert.equal(calculateWorkoutPoints("Gym", 45, "Moderate"), 27);
});

test("calculateWorkoutPoints throws operational AppError on invalid inputs", () => {
  assert.throws(() => calculateWorkoutPoints("Swimming", 30, "High"), {
    code: "INVALID_WORKOUT_PARAMS",
    statusCode: 400
  });
});

test("evaluateUserBadges unlocks expected milestones", () => {
  const sampleWorkouts = [
    { activity: "Running", distance: 10.5, points: 60, date: Date.now() },
    { activity: "Cycling", distance: 15, points: 50, date: Date.now() - 86400000 }
  ];

  const badges = evaluateUserBadges(sampleWorkouts, 600);
  assert.ok(badges.includes("first"));
  assert.ok(badges.includes("5k"));
  assert.ok(badges.includes("10k"));
  assert.ok(badges.includes("century"));
  assert.ok(badges.includes("team"));
  assert.ok(!badges.includes("all"));
});
