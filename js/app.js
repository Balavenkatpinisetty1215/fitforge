import { api, getToken, setToken } from "./api.js";
import { renderCharts } from "./charts.js";

const MET_PREVIEW = { Running: 9.8, Cycling: 8.0, "Push-ups": 8.0, Gym: 6.0 };
const MULT_PREVIEW = { Low: 0.8, Moderate: 1.0, High: 1.25 };
const ACTIVITY_EMOJIS = { Running: "🏃", Cycling: "🚴", "Push-ups": "💪", Gym: "🏋️" };

const BADGE_CATALOG = [
  ["first", "First Step", "Log your first workout.", "👟"],
  ["5k", "5K Trailblazer", "Complete a run of 5 km or more.", "🏅"],
  ["10k", "10K Runner", "Complete a run of 10 km or more.", "🏃"],
  ["consistency", "Consistency Beast", "Log 10 workouts.", "🦾"],
  ["streak", "7-Day Streak", "Build a seven-day activity streak.", "🔥"],
  ["century", "Century Club", "Earn 100 fitness points.", "💯"],
  ["team", "Team Player", "Squad earns 500 points.", "🤝"],
  ["all", "All-Rounder", "Try all four workout types.", "🌈"]
];

const state = {
  authMode: "login",
  period: "weekly",
  page: 1,
  latestDashboard: null,
  eventSource: null
};

function showToast(message) {
  const toastEl = document.getElementById("toast");
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3500);
}

function createEl(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

function connectLiveStream() {
  disconnectLiveStream();
  const token = getToken();
  if (!token || typeof EventSource === "undefined") return;

  const source = new EventSource(`/api/live/stream?token=${encodeURIComponent(token)}`);
  source.addEventListener("workout_logged", async (event) => {
    try {
      const payload = JSON.parse(event.data);
      await refreshDashboard();
      if (state.latestDashboard && payload.userName !== state.latestDashboard.user.name) {
        showToast(`⚡ ${payload.userName} just logged ${payload.activity} (+${payload.points} pts)!`);
      }
    } catch (_) {}
  });
  state.eventSource = source;
}

function disconnectLiveStream() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
}

function toggleView(isAuthenticated) {
  document.getElementById("authSection").hidden = isAuthenticated;
  document.getElementById("dashboardSection").hidden = !isAuthenticated;
  document.getElementById("navControls").hidden = !isAuthenticated;
  if (!isAuthenticated) disconnectLiveStream();
}

function renderDashboard(data) {
  state.latestDashboard = data;
  const { user, squad, stats, leaderboard, members, unlockedBadges, trend, workouts } = data;

  document.getElementById("navUserBadge").textContent = `${user.avatar} ${user.name}`;
  document.getElementById("activeSquadName").textContent = squad.name;
  document.getElementById("inviteCodePill").textContent = `Invite Code: ${squad.id.toUpperCase()}`;
  document.getElementById("memberCountPill").textContent = `${members.length} members`;
  document.getElementById("goalPill").textContent = `Weekly goal · ${squad.goal.toLocaleString()} pts`;

  document.getElementById("myPoints").textContent = stats.personalPoints.toLocaleString();
  document.getElementById("squadPoints").textContent = stats.squadPoints.toLocaleString();
  document.getElementById("squadRank").textContent = `#${stats.squadRank}`;
  document.getElementById("totalSquadsSub").textContent = `Among ${stats.totalSquads} squads`;
  document.getElementById("workoutCount").textContent = stats.totalWorkouts;

  const pct = Math.min(100, Math.round((stats.squadPoints / squad.goal) * 100));
  document.getElementById("goalSub").textContent = `${pct}% of weekly goal`;
  document.getElementById("missionName").textContent = squad.name;
  document.getElementById("missionMotto").textContent = squad.motto;
  document.getElementById("goalBar").style.width = `${pct}%`;
  document.getElementById("goalPercent").textContent = `${pct}% completed`;
  document.getElementById("goalRemaining").textContent = `${Math.max(0, squad.goal - stats.squadPoints).toLocaleString()} pts to goal`;

  const lbContainer = document.getElementById("leaderboardList");
  lbContainer.replaceChildren();
  const topScore = leaderboard[0]?.points || 1;

  leaderboard.forEach((item, index) => {
    const isMine = item.id === squad.id;
    const row = createEl("div", `rank-row${isMine ? " mine" : ""}`);
    const num = createEl("div", "rank-num", String(index + 1));

    const main = createEl("div", "rank-main");
    const nameDiv = createEl("div", "rank-name", item.name);
    if (isMine) nameDiv.appendChild(createEl("span", "tag-lime", "YOUR SQUAD"));

    const barWrap = createEl("div", "mini-bar");
    const barFill = createEl("div");
    barFill.style.width = `${Math.min(100, (item.points / topScore) * 100)}%`;
    barWrap.appendChild(barFill);
    main.append(nameDiv, barWrap);

    const scoreDiv = createEl("div", "score", item.points.toLocaleString());
    scoreDiv.appendChild(createEl("small", "", "POINTS"));

    row.append(num, main, scoreDiv);
    lbContainer.appendChild(row);
  });

  const membersContainer = document.getElementById("membersList");
  membersContainer.replaceChildren();

  members.forEach((member, idx) => {
    const row = createEl("div", "member-row");
    const avatar = createEl("div", "avatar", member.avatar);

    const info = createEl("div", "member-info");
    const mName = createEl("div", "member-name", member.name);
    if (member.id === user.id) mName.appendChild(createEl("span", "tag-lime", "YOU"));
    const role = createEl("div", "member-role", idx === 0 ? "Squad pace-setter" : "Squad member");
    info.append(mName, role);

    const pts = createEl("strong", "small", `${member.points} pts`);
    const hfBtn = createEl("button", "highfive-btn", "🙌");
    hfBtn.type = "button";
    hfBtn.addEventListener("click", () => showToast(`🙌 High-five sent to ${member.name}!`));

    row.append(avatar, info, pts, hfBtn);
    membersContainer.appendChild(row);
  });

  const unlockedSet = new Set(unlockedBadges);
  document.getElementById("badgeMemberName").textContent = user.name;
  document.getElementById("badgeCountPill").textContent = `${unlockedSet.size}/${BADGE_CATALOG.length} unlocked`;

  const badgesGrid = document.getElementById("badgesGrid");
  badgesGrid.replaceChildren();

  BADGE_CATALOG.forEach(([id, title, desc, icon]) => {
    const isUnlocked = unlockedSet.has(id);
    const card = createEl("div", `badge ${isUnlocked ? "unlocked" : "locked"}`);
    card.append(
      createEl("div", "badge-icon", icon),
      createEl("div", "badge-name", title),
      createEl("div", "badge-desc", isUnlocked ? "Unlocked" : desc)
    );
    badgesGrid.appendChild(card);
  });

  const workoutsList = document.getElementById("workoutsList");
  workoutsList.replaceChildren();
  document.getElementById("pageIndicator").textContent = `${workouts.page} / ${workouts.totalPages}`;
  document.getElementById("prevPageBtn").disabled = workouts.page <= 1;
  document.getElementById("nextPageBtn").disabled = workouts.page >= workouts.totalPages;

  if (workouts.items.length === 0) {
    workoutsList.appendChild(createEl("p", "muted small", "No workouts logged yet. Start your streak today!"));
  } else {
    workouts.items.forEach((w) => {
      const row = createEl("div", "workout-row");
      const icon = createEl("div", "workout-icon", ACTIVITY_EMOJIS[w.activity] || "🏅");

      const main = createEl("div", "workout-main");
      main.appendChild(createEl("div", "workout-name", w.activity));
      const dateStr = new Date(w.date).toLocaleDateString();
      const noteText = w.note ? ` · ${w.note}` : "";
      main.appendChild(createEl("div", "workout-meta", `${w.duration} min · ${w.intensity} · ${dateStr}${noteText}`));

      const pts = createEl("div", "points-badge", `+${w.points}`);
      row.append(icon, main, pts);
      workoutsList.appendChild(row);
    });
  }

  renderCharts(trend);
}

async function refreshDashboard() {
  try {
    const data = await api.getDashboard(state.period, state.page);
    toggleView(true);
    renderDashboard(data);
  } catch (err) {
    setToken(null);
    toggleView(false);
  }
}

function updatePointsPreview() {
  const activity = document.getElementById("activity").value;
  const duration = Number(document.getElementById("duration").value) || 0;
  const intensity = document.getElementById("intensity").value;
  const est = Math.round(duration * (MET_PREVIEW[activity] || 6) * (MULT_PREVIEW[intensity] || 1) * 0.1);
  document.getElementById("pointsEstimate").textContent = `${est} pts`;
}

function bindEvents() {
  document.querySelectorAll("[data-auth-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.authMode = btn.dataset.authMode;
      document.querySelectorAll("[data-auth-mode]").forEach((b) => b.classList.toggle("active", b === btn));
      const isReg = state.authMode === "register";
      document.getElementById("displayNameGroup").hidden = !isReg;
      document.getElementById("authName").required = isReg;
      document.getElementById("authSubmitBtn").textContent = isReg ? "Create Account" : "Sign In";
    });
  });

  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("authUsername").value;
    const password = document.getElementById("authPassword").value;
    const name = document.getElementById("authName").value;

    try {
      const res = state.authMode === "register"
        ? await api.register({ username, name, password })
        : await api.login({ username, password });

      setToken(res.token);
      state.page = 1;
      await refreshDashboard();
      connectLiveStream();
      showToast(`Welcome back, ${res.user.name}!`);
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    try {
      await api.logout();
    } catch (_) {}
    setToken(null);
    toggleView(false);
    showToast("Signed out.");
  });

  document.querySelectorAll("#periodTabs .tab").forEach((tab) => {
    tab.addEventListener("click", async () => {
      state.period = tab.dataset.period;
      document.querySelectorAll("#periodTabs .tab").forEach((t) => t.classList.toggle("active", t === tab));
      await refreshDashboard();
    });
  });

  document.getElementById("prevPageBtn").addEventListener("click", async () => {
    if (state.page > 1) {
      state.page -= 1;
      await refreshDashboard();
    }
  });

  document.getElementById("nextPageBtn").addEventListener("click", async () => {
    if (state.latestDashboard && state.page < state.latestDashboard.workouts.totalPages) {
      state.page += 1;
      await refreshDashboard();
    }
  });

  document.getElementById("openWorkoutModalBtn").addEventListener("click", () => {
    updatePointsPreview();
    document.getElementById("workoutModal").classList.add("show");
  });

  document.getElementById("openCreateModalBtn").addEventListener("click", () => {
    document.getElementById("createModal").classList.add("show");
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(btn.dataset.closeModal).classList.remove("show");
    });
  });

  ["activity", "duration", "intensity"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updatePointsPreview);
  });

  document.getElementById("workoutForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const res = await api.logWorkout({
        activity: document.getElementById("activity").value,
        duration: Number(document.getElementById("duration").value),
        distance: Number(document.getElementById("distance").value) || 0,
        intensity: document.getElementById("intensity").value,
        note: document.getElementById("note").value
      });
      document.getElementById("workoutModal").classList.remove("show");
      document.getElementById("note").value = "";
      state.page = 1;
      await refreshDashboard();
      showToast(`Workout saved · +${res.workout.points} points!`);
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById("createSquadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const res = await api.createSquad({
        name: document.getElementById("newSquadName").value,
        motto: document.getElementById("newSquadMotto").value,
        goal: Number(document.getElementById("newSquadGoal").value)
      });
      document.getElementById("createModal").classList.remove("show");
      await refreshDashboard();
      showToast(`Squad created · Invite code: ${res.squad.id.toUpperCase()}`);
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById("joinSquadBtn").addEventListener("click", async () => {
    const code = prompt("Enter squad invite code (e.g., IRON, PACE, BEAST, ZEN, VOLT):");
    if (!code) return;
    try {
      const res = await api.joinSquad(code);
      await refreshDashboard();
      showToast(`Joined ${res.squad.name}!`);
    } catch (err) {
      showToast(err.message);
    }
  });

  window.addEventListener("resize", () => {
    if (state.latestDashboard) {
      renderCharts(state.latestDashboard.trend);
    }
  });
}

bindEvents();
if (getToken()) {
  refreshDashboard().then(() => connectLiveStream());
} else {
  toggleView(false);
}
