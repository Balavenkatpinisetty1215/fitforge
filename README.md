# FitSquad — Real-Time Social Fitness Challenge Platform

FitSquad is a 3-tier full-stack web application that turns individual workouts into live, team-based fitness challenges. Users log workouts scored via Metabolic Equivalent of Task (MET) values, track squad goals, unlock milestone badges, and receive instant leaderboard updates across connected clients via Server-Sent Events (SSE).

---

## Architecture & Design Patterns

1. **Presentation Tier (`public/`)**
   - `index.html` & `css/styles.css`: Responsive dark-mode interface with real-time sync status indicator.
   - `js/app.js`, `js/api.js`, `js/charts.js`: Modular ES6 frontend using safe DOM construction (`createElement` / `textContent`), HTML5 Canvas charts, and `EventSource` live event listeners.

2. **Application Tier (`server.js` & `src/`)**
   - `src/routes/sseRoutes.js`: Real-time Server-Sent Events (SSE) hub broadcasting workout completions to connected squad members.
   - `src/routes/authRoutes.js`: Token-based authentication (`/register`, `/login`, `/logout`) using salted `crypto.scrypt` password hashes and timing-safe comparisons.
   - `src/routes/apiRoutes.js`: RESTful endpoints for workout logging (with 180-minute daily cap enforcement), squad creation/joining, and paginated history.
   - `src/middleware/rateLimit.js`: Sliding-window IP rate limiter protecting global and authentication endpoints.
   - `src/errors/AppError.js`: Structured operational error handling returning consistent HTTP status codes and machine-readable error identifiers.

3. **Data & Repository Tier (`src/services/repository.js` & `src/services/dataStore.js`)**
   - In-memory indexed repository (`usersById`, `usersByUsername`, `usersBySquad`, `workoutsByUser`) backed by atomic JSON persistence (`data/db.json`) for fast $O(1)$ lookups and pre-sorted pagination.

---

## Setup & Running Instructions

### Prerequisites
- **Node.js** (v18.0.0 or higher)

### 1. Install Dependencies
Open a terminal inside the project directory and run:
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
The server will start on **`http://localhost:3000`**.

### 3. Demo Login Credentials
On first startup, the repository automatically seeds five squads and twenty demo members. You can sign in immediately using:
- **Username:** `aarav` (or `maya`, `kabir`, `arjun`, `aditya`)
- **Password:** `FitSquad123!`

*(Alternatively, switch to the **Register** tab to create a new account.)*

---

## Running Automated Tests

Run the unit and integration test suite using Node's native test runner (`node:test`):
```bash
npm test
```
The suite validates:
- MET point engine calculations and badge unlock rules (`tests/pointsEngine.test.js`)
- Authentication enforcement, 180-minute daily cap, structured error codes, SSE live stream handshake, and sliding-window rate limiting (`tests/api.integration.test.js`)
