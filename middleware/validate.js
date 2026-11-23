const { MET_VALUES, INTENSITY_MULTIPLIERS } = require("../config/constants");
const AppError = require("../errors/AppError");

function sanitizeText(value, maxLength = 120) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").trim().slice(0, maxLength);
}

function validateWorkoutPayload(req, res, next) {
  const { activity, duration, distance, intensity, note } = req.body;

  if (!MET_VALUES[activity]) {
    return next(new AppError("Unsupported workout activity selected.", 400, "INVALID_ACTIVITY"));
  }

  if (!INTENSITY_MULTIPLIERS[intensity]) {
    return next(new AppError("Invalid perceived intensity level.", 400, "INVALID_INTENSITY"));
  }

  const parsedDuration = Number(duration);
  if (!Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 180) {
    return next(new AppError("Duration must be an integer between 1 and 180 minutes.", 400, "INVALID_DURATION"));
  }

  const parsedDistance = distance === undefined || distance === "" ? 0 : Number(distance);
  if (Number.isNaN(parsedDistance) || parsedDistance < 0 || parsedDistance > 100) {
    return next(new AppError("Distance must be between 0 and 100 km.", 400, "INVALID_DISTANCE"));
  }

  req.cleanWorkout = {
    activity,
    duration: parsedDuration,
    distance: parsedDistance,
    intensity,
    note: sanitizeText(note, 120)
  };

  next();
}

module.exports = {
  sanitizeText,
  validateWorkoutPayload
};
