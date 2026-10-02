# Mission Control: team handoff

Who works where, which API names the frontend expects, and what's still fake.

**Search tags in the code** (Ctrl+Shift+F in VS Code):

| Tag | Meaning | Who |
|---|---|---|
| `TODO(3D)` | 3D scene work still to do | 3D / render dev |
| `TODO(API)` | Waiting on a backend endpoint | Backend team |
| `TODO(UI)` | Frontend feature not built yet | Frontend |
| `PLACEHOLDER` | Fake content or data to replace later | Anyone |

---

## 0. Project facts

- **Two launch sites only:**

  | id | Name | Lat | Lon |
  |---|---|---|---|
  | `nova-scotia` | Spaceport Nova Scotia (Canso, NS) | 45.3031 | -60.9828 |
  | `cape-canaveral` | Cape Canaveral SLC-40 (Florida) | 28.5618 | -80.5770 |

  Defined once in `frontend/src/features/mission-control/launchConfig.js`. The backend must use the same ids.
- **User input** is the target orbit: orbit type, inclination (°), altitude (km), and how many days to search. No rocket mass or other vehicle data.
- **Weather is automatic.** The backend fills it in for each window; the user never types it.
- **Physics note:** a rocket can't directly reach an inclination lower than its launch site's latitude. Nova Scotia is at 45.3°, so LEO at 45.1° is *not* directly reachable from there (the panel shows a warning). SSO and Polar are fine from both sites.

---

## 1. 3D render: where to work

**Your file:** `frontend/src/features/mission-control/SceneViewport.jsx`

Page URL: `http://localhost:5173/mission-control`

```
frontend/src/
├── pages/MissionControl.jsx                ← loads data, passes it to you (no need to edit)
├── api/missionApi.js                       ← talks to backend (no need to edit)
└── features/mission-control/
    ├── SceneViewport.jsx   ★ YOUR FILE     ← the 3D canvas, fills the whole page
    ├── HudOverlay.jsx                      ← 2D panels on top (countdown, windows)
    ├── MissionInputPanel.jsx               ← left-side input panel (site, orbit, inclination…)
    ├── launchConfig.js                     ← the 2 launch sites + orbit presets
    ├── MissionControl.module.css           ← .viewport style = your container
    ├── mockData.js                         ← fake data you're seeing right now
    └── README.md                           ← setup steps for three.js / R3F
```

**What you get as props.** All of it is already loaded, so you don't need to fetch anything:

| Prop | Shape | Use it for |
|---|---|---|
| `mission` | `{ name, vehicle, launchSite: {id, name, lat, lon}, targetOrbit, inclinationDeg, altitudeKm }` | Launch site marker, orbit ring tilt + radius |
| `windows` | `[{ id, opensAt, durationMin, weather }]` | Optional: show windows in 3D |
| `selectedId` | `'w1'` | Which window is selected |
| `onSelect` | `(id) => void` | Call it if the user picks a window inside the 3D scene |
| `trajectory` | `[{ tSec, lat, lon, altKm }]` | **The ascent line to draw.** It changes when the selection changes |

**To-do list** (all marked `TODO(3D)` in the file):

1. Install three.js or React Three Fiber (see the README in that folder)
2. Replace the `PLACEHOLDER` globe `<div>` with the real canvas
3. Earth: textured sphere
4. Launch site marker at `mission.launchSite.lat/lon`
5. Trajectory line through `trajectory` points, redrawn when `selectedId` changes
6. Target orbit ring tilted by `mission.inclinationDeg`, radius from `mission.altitudeKm`
7. Camera controls (OrbitControls)
8. Optional: show both launch sites (from `launchConfig.js`), highlighting the selected one

The HUD panels on top already let mouse drag and zoom through to your canvas.
The Mission Inputs panel covers the left ~320px when open, so consider offsetting the globe slightly to the right.

---

## 2. Backend: API names the frontend expects

The frontend calls the backend in **one file only**: `frontend/src/api/missionApi.js`.
Vite forwards every `/api/*` request to Flask at `http://127.0.0.1:5000`.

**Rules**
- Return **JSON in snake_case**. The frontend converts it to camelCase itself.
- Times are **ISO 8601 UTC strings**, e.g. `"2026-10-03T14:20:00Z"`.
- Angles are in **degrees**, altitude in **km**.
- `orbit` is exactly one of `LEO`, `Polar`, `SSO`.
- `site_id` is exactly one of `nova-scotia`, `cape-canaveral`.
- `weather` is exactly one of `green`, `yellow`, `red`.
- On an error, return a 4xx/5xx status. The page shows an error message.

### Endpoints

| Status | Method + path | Purpose |
|---|---|---|
| Exists | `GET /api/test` | Health check (About page button) |
| `TODO(API)` | `GET /api/launch-sites` | List launch sites |
| `TODO(API)` | `GET /api/launch-windows?site_id=nova-scotia&orbit=SSO&inclination_deg=98.1&altitude_km=700&days=7` | Mission + upcoming launch windows for the user's inputs |
| `TODO(API)` | `GET /api/launch-windows/<window_id>/trajectory` | Ascent path for one window |

#### `GET /api/launch-sites`
```json
{
  "sites": [
    { "id": "cape-canaveral", "name": "Cape Canaveral SLC-40", "lat": 28.5618, "lon": -80.577 }
  ]
}
```

#### `GET /api/launch-windows`
Query params (all sent by the Mission Inputs panel):

| Param | Example | Meaning |
|---|---|---|
| `site_id` | `nova-scotia` | `nova-scotia` or `cape-canaveral` |
| `orbit` | `SSO` | `LEO`, `Polar` or `SSO` (label only; use `inclination_deg` for the maths) |
| `inclination_deg` | `98.1` | Target orbit inclination, 0–180 |
| `altitude_km` | `700` | Target orbit altitude, 160–2000 |
| `days` | `7` | How many days ahead to search, 1–30 |
```json
{
  "mission": {
    "name": "Demo Mission",
    "vehicle": "Generic Medium-Lift",
    "launch_site": { "id": "nova-scotia", "name": "Spaceport Nova Scotia", "lat": 45.3031, "lon": -60.9828 },
    "target_orbit": "SSO",
    "inclination_deg": 98.1,
    "altitude_km": 700
  },
  "windows": [
    { "id": "w1", "opens_at": "2026-10-03T14:20:00Z", "duration_min": 12, "weather": "green" }
  ]
}
```
- `windows` must be sorted **soonest first**. The countdown uses `windows[0]`.
- Each `id` must be unique and usable in the trajectory URL.
- `weather` is filled in automatically by the backend (real or mock weather API).
- If the orbit can't be reached from that site, return `"windows": []` (or a 400 with a message).
- The challenge's target inclinations are LEO ≈ 45.1°, Polar 87.9–90°, SSO ≈ 98.1°.

#### `GET /api/launch-windows/<window_id>/trajectory`
```json
{
  "window_id": "w1",
  "points": [
    { "t_sec": 0,  "lat": 28.56, "lon": -80.58, "alt_km": 0 },
    { "t_sec": 10, "lat": 28.79, "lon": -80.08, "alt_km": 10.5 }
  ]
}
```
Points are in time order, starting at liftoff (`t_sec: 0`).

### Switching from fake data to the real backend
1. Build the endpoints above in `backend/flaskr/__init__.py`.
2. In `frontend/src/api/missionApi.js` set `USE_MOCK = false`.
3. Run Flask on port 5000 (`flask --app flaskr run` from `backend/`) and `npm run dev` in `frontend/`.

If you rename an endpoint or a field, update `ENDPOINTS` or the mapper functions at the bottom of `missionApi.js`. Nothing else in the frontend needs to change.

---

## 3. Placeholders: what's fake right now

| What | Where | Replace with |
|---|---|---|
| Mission, launch sites, windows, trajectory | `features/mission-control/mockData.js` | Real API (set `USE_MOCK = false`, then delete the file) |
| `USE_MOCK = true` switch | `api/missionApi.js` | `false` once the backend is live |
| Globe image + "3D scene goes here" text | `SceneViewport.jsx` | Real three.js / R3F scene |
| Window times, durations, weather values | `mockData.js` → `mockLaunchWindowsResponse` (they change with the inputs but aren't real maths) | Backend launch-window calculation |
| Weather colours | Come from mock data | Backend's `weather` field (real or mock weather API) |
| Team roles ("Team member") | `pages/Team.jsx` | Real roles / links |
| Fake trajectory (simple arc, not real physics) | `mockData.js` → `mockTrajectoryResponse` | Backend trajectory endpoint |

**Real and finished:** nav bar, routing, Home / Launch Info / About page text, the Mission Inputs panel (2 sites, orbit type, inclination, altitude, days, reachability warning), countdown timer, window cards and the GO / CAUTION / NO-GO badges (they display whatever the data says).

**Not built yet** (Track 2 bonus ideas): a "Viewing Map" of where the ascent is visible from, and accounting for vehicle flight duration.
