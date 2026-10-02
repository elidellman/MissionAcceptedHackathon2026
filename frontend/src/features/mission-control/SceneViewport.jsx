import { useEffect, useRef, useState } from 'react'
import classes from './MissionControl.module.css'

/**
 * SceneViewport — THE 3D AREA.   ← 3D dev: this is your file. Search "TODO(3D)".
 *
 * Fills the whole Mission Control page, behind the HUD panels.
 * See README.md in this folder and /HANDOFF.md for the full guide.
 *
 * Props (already loaded for you — you don't need to fetch anything):
 *   mission     { name, vehicle, launchSite: {id, name, lat, lon}, targetOrbit, inclinationDeg, altitudeKm }
 *   windows     [{ id, opensAt, durationMin, weather }]
 *   selectedId  id of the selected launch window
 *   onSelect    (id) => void — call this if the user picks a window from inside the 3D scene
 *   trajectory  [{ tSec, lat, lon, altKm }] — ascent path for the selected window
 *
 * Coordinates are geographic (degrees + km altitude). Convert to 3D with:
 *   r = EARTH_RADIUS_UNITS * (1 + altKm / 6371)
 *   x = r * cos(lat) * cos(lon);  y = r * sin(lat);  z = -r * cos(lat) * sin(lon)
 */
// eslint-disable-next-line no-unused-vars
export default function SceneViewport({ mission, windows, selectedId, onSelect, trajectory }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // Tracks the viewport size so the renderer can resize with the window.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.round(width), height: Math.round(height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ─── TODO(3D): CREATE THE SCENE HERE ───────────────────────────────────────
  // Option A — plain three.js (npm install three):
  //   useEffect(() => {
  //     const renderer = new THREE.WebGLRenderer({ antialias: true })
  //     containerRef.current.appendChild(renderer.domElement)
  //     ... scene, camera, Earth sphere, OrbitControls, animation loop ...
  //     return () => { renderer.dispose(); renderer.domElement.remove() }
  //   }, [])
  //   useEffect(() => { renderer.setSize(size.width, size.height) }, [size])
  //
  // Option B — React Three Fiber (npm install three @react-three/fiber @react-three/drei):
  //   replace the PLACEHOLDER <div> below with <Canvas>…</Canvas>.
  //
  // TODO(3D): Earth           — textured sphere, rotating
  // TODO(3D): Launch site     — marker at mission.launchSite.lat/lon
  // TODO(3D): Trajectory      — line through `trajectory` points; redraw when selectedId changes
  // TODO(3D): Target orbit    — ring tilted by mission.inclinationDeg, radius from mission.altitudeKm
  // TODO(3D): Both launch sites: Spaceport Nova Scotia + Cape Canaveral (see launchConfig.js)
  // NOTE: the left ~320px is covered by the Mission Inputs panel when open; centre the globe accordingly if you like.
  // TODO(3D): Camera controls — orbit / zoom (OrbitControls)
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className={classes.viewport}>
      {/* PLACEHOLDER: delete this block once the real scene renders */}
      <div className={classes.placeholder}>
        <div className={classes.globe} />
        <p className={classes.placeholderTitle}>3D scene goes here</p>
        <p className={classes.placeholderMeta}>
          {size.width} × {size.height}px · {mission.targetOrbit} @ {mission.inclinationDeg}° · {windows.length} windows ·{' '}
          {trajectory.length} trajectory pts
        </p>
        <p className={classes.placeholderMeta}>src/features/mission-control/SceneViewport.jsx</p>
      </div>
    </div>
  )
}
