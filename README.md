# Mission Control

**Mission Accepted 2026 · Challenge 2**, presented by MDA Space, ShiftKey Labs and the Canadian Space Agency.

Mission Control is an interactive 3D Earth for planning rocket launches. Pick a launch site and a target orbit, and it works out when you can launch. Each window is checked against live weather, other scheduled launches and tracked space debris. You can then simulate the launch: the rocket climbs along its path, reaches orbit and releases the satellite.

**Team:** Eli · Ely · Oliver · Hazem · Jeremy

---

## Features

- **3D globe** of Earth with a star field, miniature launch-site models (Cape Canaveral with its assembly building and launch tower, Spaceport Nova Scotia), a rocket and a satellite.
- **Launch window calculator** for **Cape Canaveral** and **Spaceport Nova Scotia**, targeting **LEO**, **Polar** or **SSO**. Windows cover the next 16 days.
- **Countdown** to the next window for the site you calculated.
- **Weather rating** on every window: **GO / CAUTION / NO-GO**, or **NO FORECAST** beyond 16 days. Click **Why? ▾** to see the reason.
- **Clash check:** windows that overlap an already-scheduled launch at the same site are removed.
- **Launch simulation** with a chase camera that follows the rocket, then the satellite, and slowly pulls back to show the whole orbit. Scroll to zoom; click anywhere to stop following.
- **Space debris check:** the whole ascent path is screened for tracked objects within 10 km. Debris can also be shown on the globe.
- **International Space Station:** live position, orbit line and NASA's live video, refreshed every 15 seconds.
- **Live feeds:** Cape Canaveral launch pad stream and a Nova Scotia weather map (top right, beside the countdown).
- **Guide page** explaining every feature, including the less obvious ones.

## How the backend finds a launch window

1. **Calculate:** from the site's latitude and the orbit's inclination, find the launch heading (`sin Az = cos i / cos φ`) and list launch times. If a RAAN is given, time the moment Earth's rotation carries the pad under the orbit plane.
2. **Avoid scheduled launches:** drop windows that overlap upcoming launches from The Space Devs Launch Library.
3. **Rate the weather with two engines**, both using the Open-Meteo forecast:
   - **Launch rules** (surface wind, gusts, rain, visibility, winds aloft, thunderstorms, low cloud). Any failure means **NO-GO**.
   - **Early warning** (gusts, rain chance, cloud cover, storms). Marginal weather means **CAUTION**.
4. **Screen for debris:** propagate the CelesTrak catalogue with SGP4 to launch time and check the ascent path.

---

## Getting started

### Requirements

- **Python** 3.11+
- **Node.js** 20.19+ (or 22.12+), which Vite 8 needs

### 1. Backend (Flask)

From the **project root** (not inside `backend/`):

```bash
pip install -r requirements.txt
flask --app backend.flaskr run --debug
```

The API runs at `http://127.0.0.1:5000`. Open `http://127.0.0.1:5000/api/test` to check it's up.

### 2. Frontend (React + Vite)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the address Vite prints, usually `http://localhost:5173`. Vite forwards every `/api/*` request to the Flask server, so both must be running.

### Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: No module named 'backend'` | You started Flask from inside `backend/`. Run `cd ..` and start it from the project root. |
| `No module named 'openmeteo_requests'` (or similar) | Run `pip install -r requirements.txt` from the project root. |
| Every window says CAUTION / "forecast unavailable" | The computer can't reach Open-Meteo. Check the internet connection. |
| Error banner on the Mission Control page | The Flask server isn't running, or crashed. Check its terminal. |
| A live video won't play | YouTube stream IDs change now and then. Update them in `frontend/src/features/mission-control/launchConfig.js`. |

---

## Project structure

```
MissionAcceptedHackathon2026/
├── requirements.txt         # Python libraries for the backend
├── backend/
│   ├── flaskr/
│   │   ├── __init__.py          # Flask app and all API routes
│   │   └── weather/weatherApi.py # Launch-rules weather engine
│   ├── Calculations.py          # Launch window calculation (entry point)
│   ├── lib_Calculations.py      # Azimuth, plane crossings, sidereal time, site/orbit data
│   ├── launch_data.py           # Scheduled launches (The Space Devs) and clash filter
│   ├── weather.py               # Early-warning engine + combined GO/CAUTION/NO-GO rating
│   ├── integration.py           # Windows + weather, end to end
│   ├── debris.py                # CelesTrak + SGP4 debris screening
│   └── ViewingSpots.py          # Viewing spots near each launch site
└── frontend/
    └── src/
        ├── api/missionApi.js    # The only file that talks to the backend
        ├── pages/               # Home, Mission Control, Guide, Launch Info, Team, About
        ├── features/mission-control/
        │   ├── SceneViewport.jsx     # 3D globe, models, simulation, chase camera
        │   ├── HudOverlay.jsx        # Countdown, window cards, live feeds, toggles
        │   ├── MissionInputPanel.jsx # Site and orbit inputs
        │   └── launchConfig.js       # Launch sites, orbit presets, live feed links
        ├── credits.js           # Sources and licences shown on each page
        └── routes.js            # Page paths and nav bar
```

## API

All responses are JSON in snake_case. Times are ISO 8601 UTC, angles in degrees, altitudes in km.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/test` | Health check |
| GET | `/api/launch-sites` | The two launch sites |
| GET | `/api/launch-windows?site_id=&orbit=&altitude_km=&days=` | Mission details and rated launch windows |
| GET | `/api/launch-windows/<window_id>/trajectory` | Simplified ascent path for one window |
| POST | `/api/launch-windows` | Raw window calculation (scripts/testing) |
| POST | `/api/launch-windows/weather` | Windows with weather from the launch-rules engine |
| GET | `/api/debris?lat=&lon=&alt_km=&time=` | Debris near one point |
| POST | `/api/debris/path-check` | Debris along a whole ascent path |

`site_id` is `cape-canaveral` or `nova-scotia`; `orbit` is `LEO`, `Polar` or `SSO`.

---

## Data sources

| Data | Source |
|---|---|
| Weather forecasts (both engines) | [Open-Meteo](https://open-meteo.com) (CC BY 4.0) |
| Scheduled launches | [The Space Devs, Launch Library 2](https://thespacedevs.com) |
| Space debris orbits | [CelesTrak](https://celestrak.org) |
| ISS position and orbit | [wheretheiss.at](https://wheretheiss.at) |
| Earth texture | [NASA Visible Earth, Blue Marble](https://visibleearth.nasa.gov/images/74518) (public domain) |
| Live video | Spaceflight Now and NASA (embedded via YouTube) |
| Nova Scotia weather map | [Windy.com](https://www.windy.com) (embedded) |

Built with React, Vite, Mantine, React Router, three.js, globe.gl, Flask, NumPy, pandas, sgp4 and Requests. The full list of credits is on the **About** page.

> The trajectory and simulation are simplified visualisations for planning and demonstration, not flight-grade physics.
