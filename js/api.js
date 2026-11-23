const TOKEN_KEY = "fitsquad_auth_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

export const api = {
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload) => request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  getDashboard: (period = "weekly", page = 1) =>
    request(`/api/dashboard?period=${encodeURIComponent(period)}&page=${page}&limit=6`),
  logWorkout: (payload) => request("/api/workouts", { method: "POST", body: JSON.stringify(payload) }),
  createSquad: (payload) => request("/api/squads", { method: "POST", body: JSON.stringify(payload) }),
  joinSquad: (code) => request("/api/squads/join", { method: "POST", body: JSON.stringify({ code }) })
};
