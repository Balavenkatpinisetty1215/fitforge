const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MET_VALUES, INTENSITY_MULTIPLIERS } = require("../config/constants");

const DATA_FILE = path.join(__dirname, "../../data/db.json");

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, key] = storedHash.split(":");
  const hashBuffer = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, "hex");
  if (hashBuffer.length !== keyBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, keyBuffer);
}

function createSeedDatabase() {
  const seedSquads = [
    { id: "iron", name: "Iron Legion", motto: "Earn your strength, together.", goal: 2000 },
    { id: "pace", name: "Pace Makers", motto: "One more kilometre.", goal: 1800 },
    { id: "beast", name: "Weekend Beasts", motto: "Small steps. Big energy.", goal: 2200 },
    { id: "zen", name: "Zen Striders", motto: "Consistency over intensity.", goal: 1600 },
    { id: "volt", name: "Team Voltage", motto: "Power every day.", goal: 1900 }
  ];

  const memberNames = [
    ["Aarav", "Maya", "Rohan", "Isha"],
    ["Kabir", "Anaya", "Dev", "Tara"],
    ["Arjun", "Meera", "Vihaan", "Diya"],
    ["Aditya", "Sana", "Neil", "Kiara"],
    ["Reyansh", "Aisha", "Krish", "Nisha"]
  ];

  const avatars = ["🏃", "🚴", "💪", "⚡", "🔥", "🧘", "🏋️", "🌟"];
  const defaultPasswordHash = hashPassword("FitSquad123!");

  const users = [];
  seedSquads.forEach((sq, sIdx) => {
    memberNames[sIdx].forEach((name, uIdx) => {
      users.push({
        id: `${sq.id}-${uIdx + 1}`,
        username: name.toLowerCase(),
        name,
        avatar: avatars[(sIdx * 4 + uIdx) % avatars.length],
        squadId: sq.id,
        passwordHash: defaultPasswordHash
      });
    });
  });

  const activities = Object.keys(MET_VALUES);
  const intensities = Object.keys(INTENSITY_MULTIPLIERS);
  const workouts = [];

  for (let i = 0; i < 70; i++) {
    const sIdx = i % 5;
    const uIdx = (i * 3) % 4;
    const activity = activities[i % 4];
    const duration = 20 + ((i * 7) % 35);
    const intensity = intensities[i % 3];
    const dayOffset = (i % 14) + 1;
    const points = Math.round(duration * MET_VALUES[activity] * INTENSITY_MULTIPLIERS[intensity] * 0.1);

    workouts.push({
      id: `seed-${i + 1}`,
      userId: `${seedSquads[sIdx].id}-${uIdx + 1}`,
      squadId: seedSquads[sIdx].id,
      activity,
      duration,
      distance: activity === "Running" ? (i % 3 === 0 ? 5.2 : 2.4) : activity === "Cycling" ? 8 : 0,
      intensity,
      points,
      note: "Logged training session",
      date: Date.now() - dayOffset * 86400000
    });
  }

  return {
    squads: seedSquads,
    users,
    workouts,
    sessions: {}
  };
}

class DataStore {
  constructor(filePath = DATA_FILE) {
    this.filePath = filePath;
    this.ensureInitialized();
  }

  ensureInitialized() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      this.write(createSeedDatabase());
    }
  }

  read() {
    const raw = fs.readFileSync(this.filePath, "utf-8");
    return JSON.parse(raw);
  }

  write(data) {
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

module.exports = {
  DataStore,
  hashPassword,
  verifyPassword
};
