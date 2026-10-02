# Mission Control (3D page)

Route: `/mission-control`. Full team guide: **`/HANDOFF.md`** at the repo root.

```
features/mission-control/
├── SceneViewport.jsx         ★ 3D scene goes here (fills the whole page). Search "TODO(3D)"
├── HudOverlay.jsx            ← 2D panels on top (mission info, countdown, windows)
├── MissionControl.module.css ← styles for both
└── mockData.js               ← PLACEHOLDER fake API responses
```

## How the page is laid out

- The page takes **all space below the nav bar** (no padding, no scrolling).
- `SceneViewport` is absolutely positioned to fill it.
- `HudOverlay` sits on top with `pointer-events: none`, so mouse drag / zoom
  reach the 3D scene. Only the panels themselves are clickable.
- `pages/MissionControl.jsx` loads all the data and passes it down. The 3D code never fetches.

## Adding the 3D scene

**React Three Fiber (recommended with React)**
```bash
npm install three @react-three/fiber @react-three/drei
```
Replace the PLACEHOLDER `<div>` in `SceneViewport.jsx` with:
```jsx
<Canvas camera={{ position: [0, 0, 3] }}>
  <ambientLight />
  <OrbitControls />
  {/* <Earth /> <LaunchSite site={mission.launchSite} /> <Trajectory points={trajectory} /> */}
</Canvas>
```
Put each 3D piece in its own file in this folder (`Earth.jsx`, `Trajectory.jsx`, …).

**Plain three.js**
```bash
npm install three
```
In `SceneViewport.jsx`, add a `useEffect` that creates the renderer and appends
`renderer.domElement` to `containerRef.current`. Use `size.width/height` to resize.
Return a cleanup function that disposes the renderer.

## Props you receive

| prop         | shape |
|--------------|-------|
| `mission`    | `{ name, vehicle, launchSite: {id, name, lat, lon}, targetOrbit, inclinationDeg }` |
| `windows`    | `[{ id, opensAt (ISO), durationMin, weather: 'green'\|'yellow'\|'red' }]` |
| `selectedId` | id of the selected window |
| `onSelect`   | `(id) => void`, to select a window from the 3D side |
| `trajectory` | `[{ tSec, lat, lon, altKm }]`, the ascent path for the selected window |

lat/lon → 3D position (Y-up, Earth radius `R` in scene units):
```js
const r = R * (1 + altKm / 6371)
const φ = lat * Math.PI / 180, λ = lon * Math.PI / 180
const x = r * Math.cos(φ) * Math.cos(λ)
const y = r * Math.sin(φ)
const z = -r * Math.cos(φ) * Math.sin(λ)
```
