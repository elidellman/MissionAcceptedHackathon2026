# Mission Control (3D page)

Route: `/mission-control` — page file: `src/pages/MissionControl.jsx`

```
features/mission-control/
├── SceneViewport.jsx         ← 3D scene goes here (fills the whole page)
├── HudOverlay.jsx            ← 2D panels on top (mission info, countdown, windows)
├── MissionControl.module.css ← styles for both
└── mockData.js               ← fake mission + launch windows (swap for API later)
```

## How the page is laid out

- The page takes **all space below the nav bar** (no padding, no scrolling).
- `SceneViewport` is absolutely positioned to fill it.
- `HudOverlay` sits on top with `pointer-events: none`, so mouse drag / zoom
  reach the 3D scene. Only the panels themselves are clickable.

## Adding the 3D scene

Pick one:

**Plain three.js**
```bash
npm install three
```
In `SceneViewport.jsx`, add a `useEffect` that creates the renderer and appends
`renderer.domElement` to `containerRef.current`. Use `size.width/height` to resize.
Return a cleanup function that disposes the renderer.

**React Three Fiber (recommended with React)**
```bash
npm install three @react-three/fiber @react-three/drei
```
Replace the placeholder `<div>` in `SceneViewport.jsx` with:
```jsx
<Canvas camera={{ position: [0, 0, 3] }}>
  <ambientLight />
  <OrbitControls />
  {/* <Earth /> <Trajectory window={...} /> */}
</Canvas>
```
Put new 3D pieces (Earth, trajectory, launch site marker, …) as their own files in
this folder, e.g. `Earth.jsx`, `Trajectory.jsx`.

## Data available to the scene

Props passed into `SceneViewport`:

| prop         | what                                                                |
|--------------|---------------------------------------------------------------------|
| `mission`    | `{ name, vehicle, launchSite: {name, lat, lon}, targetOrbit, inclinationDeg }` |
| `windows`    | `[{ id, opensAt (ISO), durationMin, weather: 'green'\|'yellow'\|'red' }]` |
| `selectedId` | id of the window selected in the HUD                                |
| `onSelect`   | call with a window id to select it from the 3D side                 |

Once the backend has an endpoint, replace the mock imports in
`pages/MissionControl.jsx` with a `fetch('/api/...')` — the Vite proxy already
forwards `/api` to Flask on port 5000.
