import { useEffect, useRef, useState } from 'react'
import classes from './MissionControl.module.css'
import Globe from 'globe.gl'
import * as THREE from 'three'

const EARTH_R = 6371
const ALT_SCALE = 1 // raise (e.g. 2-3) to exaggerate altitudes; applies to everything
const altFrac = km => (km / EARTH_R) * ALT_SCALE

const DEBRIS_RADIUS_KM = 10 // NEW: screening radius around the entry point

// Ring of lat/lng/alt points for a circular orbit.
function orbitPoints({ altKm, inclinationDeg, raanDeg = 0, steps = 180 }) {
  const i = (inclinationDeg * Math.PI) / 180
  const raan = (raanDeg * Math.PI) / 180
  const alt = altFrac(altKm)
  const pts = []

  for (let n = 0; n <= steps; n++) {
    const th = (n / steps) * 2 * Math.PI

    // circle in the orbital plane, tilted by inclination about the x-axis
    const x = Math.cos(th)
    const y = Math.sin(th) * Math.cos(i)
    const z = Math.sin(th) * Math.sin(i)

    // rotate about the polar (z) axis by RAAN
    const xr = x * Math.cos(raan) - y * Math.sin(raan)
    const yr = x * Math.sin(raan) + y * Math.cos(raan)

    pts.push({
      lat: (Math.asin(z) * 180) / Math.PI,
      lng: (Math.atan2(yr, xr) * 180) / Math.PI,
      alt,
    })
  }
  return pts
}

// Translucent shell between two altitudes, optionally clipped at the poles.
function orbitShell(globe, { altMinKm, altMaxKm, maxLatDeg = 90, color, opacity = 0.12, renderOrder = 0 }) {
  const R = globe.getGlobeRadius()
  const radius = km => R * (1 + altFrac(km))

  const thetaStart = ((90 - maxLatDeg) * Math.PI) / 180 // angle from the north pole
  const thetaLength = (2 * maxLatDeg * Math.PI) / 180

  const makeSphere = km => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius(km), 96, 64, 0, Math.PI * 2, thetaStart, thetaLength),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    )
    mesh.renderOrder = renderOrder
    return mesh
  }

  const group = new THREE.Group()
  group.add(makeSphere(altMinKm), makeSphere(altMaxKm))
  globe.scene().add(group)
  return group
}

// NEW: the point of entry into orbit. For now it is the last point of the ascent trajectory,
// and the time is the selected window's opening plus the ascent duration.
// When your teammates' real entry point exists, return it from here instead.
function getEntry(trajectory, windows, selectedId) {
  if (!trajectory?.length) return null
  const last = trajectory[trajectory.length - 1]
  const win = windows?.find(w => w.id === selectedId) ?? windows?.[0]
  if (!win) return null
  const time = new Date(new Date(win.opensAt).getTime() + (last.tSec ?? 0) * 1000)
  return { lat: last.lat, lon: last.lon, altKm: last.altKm, time }
}

// NEW: a cloud of tiny points floating at lat/lng/altitude.
function makePoints(globe, items, { size, color, opacity }) {
  const arr = new Float32Array(items.length * 3)
  items.forEach(([lat, lng, altKm], i) => {
    const { x, y, z } = globe.getCoords(lat, lng, altFrac(altKm))
    arr.set([x, y, z], i * 3)
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  const material = new THREE.PointsMaterial({
    size,
    color,
    opacity,
    transparent: true,
    sizeAttenuation: true,
    depthWrite: false,
  })
  return new THREE.Points(geometry, material)
}

// Placeholder ascent used when no trajectory prop is available.
const FALLBACK_ASCENT = [
  { lat: 28.5, lng: -80.6, alt: altFrac(0) }, // launch pad

  { lat: 38.0, lng: -64.0, alt: altFrac(400) }, // orbit insertion
]

// eslint-disable-next-line no-unused-vars
export default function SceneViewport({ mission, windows, selectedId, onSelect, trajectory, shellsVisible = { leo: true, polar: true, sso: true }, showDebris = true }) {
  const containerRef = useRef(null)
  const globeRef = useRef(null) // DOM node the globe mounts into
  const globeInstance = useRef(null) // the globe.gl instance
  const shellMeshes = useRef({}) // store shell references to show/hide
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [debris, setDebris] = useState(null) // NEW: result from /api/debris

  // Track the viewport size.
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

  // Create the globe once.
  useEffect(() => {
    const el = globeRef.current
    if (!el) return

    const globe = Globe()(el)
      .globeImageUrl(
        'https://i2.wp.com/eoimages.gsfc.nasa.gov/images/imagerecords/74000/74518/world.topo.200412.3x5400x2700.jpg?ssl=1'
      )
      .backgroundColor('rgba(0,0,0,0)')

    globeInstance.current = globe

    return () => {
      globe._destructor() // stops the render loop and frees the WebGL context
      el.innerHTML = ''
      globeInstance.current = null
    }
  }, [])

  // Keep the renderer sized to the viewport.
  useEffect(() => {
    const globe = globeInstance.current
    if (globe && size.width && size.height) {
      globe.width(size.width).height(size.height)
    }
  }, [size])

  // Update shell visibility when shellsVisible changes.
  useEffect(() => {
    Object.entries(shellsVisible).forEach(([name, visible]) => {
      if (shellMeshes.current[name]) {
        shellMeshes.current[name].visible = visible
      }
    })
  }, [shellsVisible])

  // Build shells and paths; rebuild when the mission or trajectory changes.
  useEffect(() => {
    const globe = globeInstance.current
    if (!globe) return
    const scene = globe.scene()

    // Ascent: from the trajectory prop if present, otherwise the placeholder.
    const ascent =
      trajectory && trajectory.length
        ? trajectory.map(p => ({ lat: p.lat, lng: p.lon, alt: altFrac(p.altKm) }))
        : FALLBACK_ASCENT

    // Shells: one group per regime.
    const shells = {
      leo: orbitShell(globe, {
        altMinKm: 160, altMaxKm: 2000, maxLatDeg: 90,
        color: '#49ff5e', opacity: 0.08, renderOrder: 1,
      }),
      polar: orbitShell(globe, {
        altMinKm: 200, altMaxKm: 1000, maxLatDeg: 90,
        color: '#ffb74d', opacity: 0.15, renderOrder: 2,
      }),
      sso: orbitShell(globe, {
        altMinKm: 600, altMaxKm: 800, maxLatDeg: 82,
        color: '#4fc3f7', opacity: 0.25, renderOrder: 3,
      }),
    }

    // Store shell references and apply visibility
    shellMeshes.current = shells
    Object.entries(shells).forEach(([name, mesh]) => {
      mesh.visible = shellsVisible[name] ?? true
    })

    // Edge rings outlining each shell's bounds (same inclination and RAAN per pair).
    const ring = (name, altKm, inclinationDeg, raanDeg, color, stroke = 0.5) => ({
      name,
      pts: orbitPoints({ altKm, inclinationDeg, raanDeg }),
      color,
      stroke,
    })

    const orbits = []

    // Target orbit from the mission, if provided.
    if (mission?.altitudeKm != null && mission?.inclinationDeg != null) {
      orbits.push(ring('Target', mission.altitudeKm, mission.inclinationDeg, 0, 'red', 1))
    }

    const paths = [{ name: 'ascent', pts: ascent, color: 'red', stroke: 2 }, ...orbits]

    globe
      .pathsData(paths)
      .pathPoints(d => d.pts)
      .pathPointLat(p => p.lat)
      .pathPointLng(p => p.lng)
      .pathPointAlt(p => p.alt)
      .pathColor(d => d.color)
      .pathStroke(d => d.stroke)
      .pathResolution(1) // avoids rings being cut into visible straight segments

    // Markers: launch site and ascent end.
    const markers = []
    if (mission?.launchSite) {
      markers.push({ lat: mission.launchSite.lat, lng: mission.launchSite.lon, alt: 0, color: 'white' })
    }
    const last = ascent[ascent.length - 1]
    markers.push({ lat: last.lat, lng: last.lng, alt: last.alt, color: 'yellow' })

    globe
      .pointsData(markers)
      .pointLat(d => d.lat)
      .pointLng(d => d.lng)
      .pointAltitude(d => d.alt)
      .pointRadius(0.5)
      .pointColor(d => d.color)

    return () => {
      Object.values(shells).forEach(g => {
        scene.remove(g)
        g.traverse(o => {
          o.geometry?.dispose()
          o.material?.dispose()
        })
      })
    }
  }, [mission, trajectory])

  // NEW: ask the backend what debris is near the entry point.
  useEffect(() => {
    const entry = getEntry(trajectory, windows, selectedId)
    if (!entry) return

    const ctrl = new AbortController()
    const qs = new URLSearchParams({
      lat: entry.lat,
      lon: entry.lon,
      alt_km: entry.altKm,
      time: entry.time.toISOString(),
      radius_km: DEBRIS_RADIUS_KM,
    })

    fetch(`/api/debris?${qs}`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`debris request failed: ${r.status}`))))
      .then(data => {
        setDebris(data)
        console.log('debris check:', data.clear ? 'CLEAR' : `${data.nearby.length} nearby`, data.nearby)
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.warn(err)
      })

    return () => ctrl.abort()
  }, [trajectory, windows, selectedId])

  // NEW: draw the debris as tiny points (grey-red cloud, plus bright red for anything inside the radius).
  useEffect(() => {
    const globe = globeInstance.current
    if (!globe || !debris || !showDebris) return
    const scene = globe.scene()

    const group = new THREE.Group()
    const cloud = debris.cloud.filter(([, , altKm]) => altKm > 100) // drop objects that look already decayed
    group.add(makePoints(globe, cloud, { size: 0.35, color: '#ff8a80', opacity: 0.7 }))

    if (debris.nearby.length) {
      const near = debris.nearby.map(d => [d.lat, d.lon, d.alt_km])
      group.add(makePoints(globe, near, { size: 1.5, color: '#ff1744', opacity: 1 }))
    }

    scene.add(group)
    return () => {
      scene.remove(group)
      group.traverse(o => {
        o.geometry?.dispose()
        o.material?.dispose()
      })
    }
  }, [debris, showDebris])

  return (
    <div ref={containerRef} className={classes.viewport}>
      <div ref={globeRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}