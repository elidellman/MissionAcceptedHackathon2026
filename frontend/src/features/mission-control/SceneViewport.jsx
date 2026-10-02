import { useEffect, useRef, useState } from 'react'
import classes from './MissionControl.module.css'

/**
 * SceneViewport — THE 3D AREA.
 *
 * This component fills the whole Mission Control page (behind the HUD).
 * Everything inside it belongs to the 3D scene. See README.md in this folder.
 *
 * Props you can rely on:
 *   - mission: the selected mission (launch site lat/lon, target orbit, inclination)
 *   - windows: list of launch windows
 *
 * Option A — plain three.js:
 *   Use `containerRef.current` as the mount point (append renderer.domElement),
 *   and `size` for renderer.setSize / camera aspect. Clean up in the effect's return.
 *
 * Option B — React Three Fiber:
 *   Replace the placeholder <div> below with <Canvas>…</Canvas>. It sizes itself
 *   to this container automatically.
 */
export default function SceneViewport({ mission, windows }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // Keep track of the viewport size so the renderer can resize with the window.
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

  // ─── 3D SCENE SETUP GOES HERE ──────────────────────────────────────────────
  // useEffect(() => {
  //   const renderer = new THREE.WebGLRenderer({ antialias: true })
  //   containerRef.current.appendChild(renderer.domElement)
  //   ...
  //   return () => { renderer.dispose(); renderer.domElement.remove() }
  // }, [])
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className={classes.viewport}>
      {/* Placeholder — delete once the real scene renders */}
      <div className={classes.placeholder}>
        <div className={classes.globe} />
        <p className={classes.placeholderTitle}>3D scene goes here</p>
        <p className={classes.placeholderMeta}>
          {size.width} × {size.height}px · {mission.targetOrbit} @ {mission.inclinationDeg}° · {windows.length} windows
        </p>
        <p className={classes.placeholderMeta}>src/features/mission-control/SceneViewport.jsx</p>
      </div>
    </div>
  )
}
