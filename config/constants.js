const MET_VALUES = {
  Running: 9.8,
  Cycling: 8.0,
  "Push-ups": 8.0,
  Gym: 6.0
};

const INTENSITY_MULTIPLIERS = {
  Low: 0.8,
  Moderate: 1.0,
  High: 1.25
};

const DAILY_MINUTE_CAP = 180;

module.exports = {
  MET_VALUES,
  INTENSITY_MULTIPLIERS,
  DAILY_MINUTE_CAP
};
