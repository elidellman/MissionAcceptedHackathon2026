import { useEffect, useRef, useState } from 'react'
import classes from './MissionControl.module.css'
import Globe from 'globe.gl'
import * as THREE from 'three'
import moonSurface from '../../assets/moonSurface.jpg'
import sunSurface from '../../assets/sunSurface.jpg'
import { LAUNCH_SITES } from './launchConfig.js'
import { rgba } from '@mantine/core'

const EARTH_R = 6371
const ALT_SCALE = 1
const altFrac = km => (km / EARTH_R) * ALT_SCALE

function orbitPoints({ altKm, inclinationDeg, raanDeg = 0, steps = 180 }) {
  const i = (inclinationDeg * Math.PI) / 180
  const raan = (raanDeg * Math.PI) / 180
  const alt = altFrac(altKm)
  const pts = []

  for (let n = 0; n <= steps; n++) {
    const th = (n / steps) * 2 * Math.PI
    const x = Math.cos(th)
    const y = Math.sin(th) * Math.cos(i)
    const z = Math.sin(th) * Math.sin(i)
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

function orbitShell(globe, { altMinKm, altMaxKm, maxLatDeg = 90, color, opacity = 0.12, renderOrder = 0 }) {
  const R = globe.getGlobeRadius()
  const radius = km => R * (1 + altFrac(km))
  const thetaStart = ((90 - maxLatDeg) * Math.PI) / 180
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

function getAscent(base, targetInclinationDeg, targetAltitudeKm, steps = 80) {
  if (!base) return []

  const launchLat = Number(base.lat) || 0
  const launchLng = Number(base.lon ?? base.lng) || 0
  const inclination = Number(targetInclinationDeg) || 0
  const targetOrbit = orbitPoints({
    altKm: targetAltitudeKm,
    inclinationDeg: inclination,
    raanDeg: 0,
    steps: 240,
  })

  const normalizeLng = (value) => {
    let v = value
    while (v > 180) v -= 360
    while (v < -180) v += 360
    return v
  }

  const initialBearing = (fromLat, fromLng, toLat, toLng) => {
    const toRad = (deg) => (deg * Math.PI) / 180
    const toDeg = (rad) => (rad * 180) / Math.PI
    const lat1 = toRad(fromLat)
    const lat2 = toRad(toLat)
    const dLon = toRad(toLng - fromLng)
    const y = Math.sin(dLon) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    const bearing = Math.atan2(y, x)
    return (toDeg(bearing) + 360) % 360
  }

  const desiredHeading = inclination >= 90 ? 270 : 90
  let end = targetOrbit[0]
  let bestScore = Number.POSITIVE_INFINITY

  // TODO: replace this heuristic with the backend-calculated launch azimuth once available.
  // For now, pick the closest orbit point whose bearing is compatible with the launch direction.
  targetOrbit.forEach((point) => {
    const bearing = initialBearing(launchLat, launchLng, point.lat, point.lng)
    const headingDelta = Math.abs(normalizeLng(bearing - desiredHeading))
    const distance = Math.hypot(point.lat - launchLat, normalizeLng(point.lng - launchLng))

    // Only keep points that are a plausible launch-side intersection.
    // This avoids choosing a farther orbit point just because it happens to be roughly east/west.
    const validIntersection = headingDelta <= 90
    if (!validIntersection) return

    const score = distance + headingDelta * 0.75
    if (score < bestScore) {
      bestScore = score
      end = point
    }
  })

  if (!end || Number.isNaN(end.lat) || Number.isNaN(end.lng)) {
    end = targetOrbit[0] ?? { lat: launchLat, lng: launchLng, alt: altFrac(targetAltitudeKm) }
  }

  const lerp = (a, b, t) => a + (b - a) * t
  const lerpLng = (a, b, t) => a + normalizeLng(b - a) * t
  const cubicBezier = (p0, p1, p2, p3, t) => {
    const u = 1 - t
    const tt = t * t
    const uu = u * u
    const uuu = uu * u
    const ttt = tt * t

    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    }
  }

  const ascent = []
  const D = Math.max(
    12,
    Math.hypot(end.lat - launchLat, normalizeLng(end.lng - launchLng)) * 2.2
  )
  const H = Math.max(targetAltitudeKm, 250)

  // Cubic Bézier ascent model:
  // The final point must meet the target orbit altitude exactly, not overshoot it.
  // P0 = (0, 0) at the launch site
  // P1 = (0.12D, 0.18H) early vertical climb
  // P2 = (0.65D, 0.82H) curve toward the target orbit
  // P3 = (D, targetAltitudeKm) orbit intersection
  const P0 = { x: 0, y: 0 }
  const P1 = { x: D * 0.12, y: H * 0.18 }
  const P2 = { x: D * 0.68, y: Math.min(H * 0.82, targetAltitudeKm) }
  const P3 = { x: D, y: targetAltitudeKm }

  for (let n = 0; n <= steps; n++) {
    const t = n / steps
    const u = 1 - t
    const tt = t * t
    const uu = u * u
    const uuu = uu * u
    const ttt = tt * t

    const curvePoint = {
      x: uuu * P0.x + 3 * uu * t * P1.x + 3 * u * tt * P2.x + ttt * P3.x,
      y: uuu * P0.y + 3 * uu * t * P1.y + 3 * u * tt * P2.y + ttt * P3.y,
    }

    const xProgress = Math.min(1, Math.max(0, curvePoint.x / D))
    const lat = lerp(launchLat, end.lat, xProgress)
    const lng = lerpLng(launchLng, end.lng, xProgress)
    const alt = altFrac(curvePoint.y)

    ascent.push({ lat, lng, alt })
  }

  return ascent
}


export default function SceneViewport({
  mission,
  windows,
  selectedId,
  onSelect,
  trajectory,
  shellsVisible = { leo: false, polar: false, sso: false },
  draftParams,
  onTargetBaseChange,
  onLaunchSiteClick,
}) {
  const containerRef = useRef(null)
  const globeRef = useRef(null)
  const globeInstance = useRef(null)
  const shellMeshes = useRef({})
  const lastDrawRef = useRef('')
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [targetBase, setTargetBase] = useState(null)

  // Latest click callback, kept in a ref so the globe effect doesn't need to re-run when it changes
  const onLaunchSiteClickRef = useRef(onLaunchSiteClick)
  onLaunchSiteClickRef.current = onLaunchSiteClick

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

  useEffect(() => {
    const el = globeRef.current
    if (!el) return

    const globe = Globe()(el)
      .globeImageUrl(
        'https://i2.wp.com/eoimages.gsfc.nasa.gov/images/imagerecords/74000/74518/world.topo.200412.3x5400x2700.jpg?ssl=1'
      )
      .backgroundColor('rgba(0,0,0,0)')

    globeInstance.current = globe

    const earthRadius = globe.getGlobeRadius()
    const moonDistance = earthRadius * 3.2
    const sunDistance = earthRadius * 18
    const sunRadius = earthRadius * 0.45
    const moonRadius = earthRadius * 0.12

    const makeGlowSprite = ({ color, opacity, size }) => {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 256
      const ctx = canvas.getContext('2d')
      const gradient = ctx.createRadialGradient(128, 128, 12, 128, 128, 128)
      gradient.addColorStop(0, color)
      gradient.addColorStop(0.25, color)
      gradient.addColorStop(0.55, 'rgba(255,255,255,0.18)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 256, 256)

      const texture = new THREE.CanvasTexture(canvas)
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })

      const sprite = new THREE.Sprite(material)
      sprite.scale.set(size, size, 1)
      return sprite
    }

    const textureLoader = new THREE.TextureLoader()
    const moonTexture = textureLoader.load(moonSurface)
    const sunTexture = textureLoader.load(sunSurface)

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(sunRadius, 32, 32),
      new THREE.MeshBasicMaterial({ color: '#ffb347', map: sunTexture })
    )
    sun.position.set(-sunDistance, 0, 0)

    const sunGlow = makeGlowSprite({
      color: 'rgba(255, 185, 71, 0.95)',
      opacity: 0.9,
      size: sunRadius * 10,
    })
    sun.add(sunGlow)
    sunGlow.position.set(0, 0, 0)

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(moonRadius, 24, 24),
      new THREE.MeshBasicMaterial({
        color: '#d7dce6',
        map: moonTexture,
      })
    )
    moon.position.set(moonDistance, 0, 0)

    const moonGlow = makeGlowSprite({
      color: 'rgba(180, 195, 215, 0.7)',
      opacity: 0.35,
      size: moonRadius * 12,
    })
    moon.add(moonGlow)
    moonGlow.position.set(0, 0, 0)

    globe.scene().add(sun)
    globe.scene().add(moon)

    shellMeshes.current = {
      leo: orbitShell(globe, {
        altMinKm: 160,
        altMaxKm: 2000,
        maxLatDeg: 90,
        color: '#49ff5e',
        opacity: 0.08,
        renderOrder: 1,
      }),
      polar: orbitShell(globe, {
        altMinKm: 200,
        altMaxKm: 1000,
        maxLatDeg: 90,
        color: '#ffb74d',
        opacity: 0.15,
        renderOrder: 2,
      }),
      sso: orbitShell(globe, {
        altMinKm: 600,
        altMaxKm: 800,
        maxLatDeg: 82,
        color: '#4fc3f7',
        opacity: 0.25,
        renderOrder: 3,
      }),
    }

    Object.entries(shellMeshes.current).forEach(([name, mesh]) => {
      mesh.visible = shellsVisible[name] ?? false
    })

    return () => {
      globe.pathsData([])
      globe.pointsData([])
      Object.values(shellMeshes.current).forEach(g => {
        globe.scene().remove(g)
        g.traverse(o => {
          o.geometry?.dispose()
          o.material?.dispose()
        })
      })
      globe._destructor()
      el.innerHTML = ''
      globeInstance.current = null
    }
  }, [])

  useEffect(() => {
    const globe = globeInstance.current
    if (globe && size.width && size.height) {
      globe.width(size.width).height(size.height)
    }
  }, [size])

  useEffect(() => {
    Object.entries(shellsVisible).forEach(([name, visible]) => {
      if (shellMeshes.current[name]) {
        shellMeshes.current[name].visible = visible
      }
    })
  }, [shellsVisible])

  useEffect(() => {
    const globe = globeInstance.current
    if (!globe) return

    const selectedLaunchSite =
      (draftParams && draftParams.siteId && LAUNCH_SITES.find((s) => s.id === draftParams.siteId)) ||
      mission?.launchSite ||
      LAUNCH_SITES[0]

    const targetInclination = Number(draftParams?.inclinationDeg ?? mission?.inclinationDeg ?? 0)
    const targetAltitude = Number(draftParams?.altitudeKm ?? mission?.altitudeKm ?? 0)

    const previewDiffersFromMission =
      draftParams && (
        draftParams.siteId !== mission?.launchSite?.id ||
        Number(draftParams.inclinationDeg) !== Number(mission?.inclinationDeg) ||
        Number(draftParams.altitudeKm) !== Number(mission?.altitudeKm)
      )

    const ascent = getAscent(selectedLaunchSite, targetInclination, targetAltitude, 80)

    if (!ascent || ascent.length < 2) return

    const ring = (altKm, inclinationDeg, raanDeg, color, stroke = 0.5) => ({
      pts: orbitPoints({ altKm, inclinationDeg, raanDeg }),
      color,
      stroke,
    })

    const orbits = []
    if (targetAltitude > 0 && targetInclination > 0) {
      orbits.push(ring(targetAltitude, targetInclination, 0, 'red', 1))
    }

    const paths = [{ name: 'Ascent Path', pts: ascent, color: 'red', stroke: 2 }, ...orbits]

    globe.pathsData([])
    globe.pointsData([])

    globe
      .pathsData(paths)
      .pathPoints(d => d.pts)
      .pathPointLat(p => p.lat)
      .pathPointLng(p => p.lng)
      .pathPointAlt(p => p.alt)
      .pathColor(d => d.color)
      .pathStroke(d => d.stroke)
      .pathResolution(1)

    // The selected site in the Mission Inputs panel wins; clicks on the globe update it via onTargetBaseChange
    const activeTargetBase =
      (draftParams && draftParams.siteId && LAUNCH_SITES.find((s) => s.id === draftParams.siteId)) ||
      targetBase ||
      mission?.launchSite ||
      LAUNCH_SITES[0]

    const markers = []
    LAUNCH_SITES.forEach((launchSite) => {
    

      // Add a smaller dark dot when this site is the active target base
      if (launchSite.id === activeTargetBase.id) {
        markers.push({
        id: launchSite.id,
        type: 'launchsite-interactive',
        name: launchSite.name,
        lat: launchSite.lat,
        lng: launchSite.lon,
        alt: 0,
        color: 'yellow',
        
        })
        markers.push({
        id: launchSite.id,
        type: 'launchsite-selected',
        name: launchSite.name,
        lat: launchSite.lat,
        lng: launchSite.lon,
        alt: 0,
        color: 'black',
        
        })
      }else{
        markers.push({
        id: launchSite.id,
        type: 'launchsite-interactive',
        name: launchSite.name,
        lat: launchSite.lat,
        lng: launchSite.lon,
        alt: 0,
        color: 'white',
      })
      }
    })

    const last = ascent[ascent.length - 1]
    markers.push({
      id: 'ascent-target',
      type: 'target',
      lat: last.lat,
      lng: last.lng,
      alt: last.alt,
      color: 'yellow',
    })

    const intersectionPoint = {
      id: 'intersection-point',
      type: 'intersection',
      name: last.lat.toFixed(2) + '°, lon: ' + last.lng.toFixed(2) + '°, alt: ' + targetAltitude + ' km',
      lat: last.lat, 
      lng: last.lng,
      alt: last.alt,
      color: '#2fe36b',
    }


    globe
      .pointsData(markers)
      .pointLat(d => d.lat)
      .pointLng(d => d.lng)
      .pointAltitude(d => d.alt)
      .pointLabel(d => d.name)
      .pointRadius(d => (d.type === 'launchsite-interactive' ? 1.5 : d.type === 'launchsite-selected' ? 1.0 : 0.5))
      .pointColor(d => d.color)
      .onPointClick((point, event, coords) => {
        if (!coords || !point?.type?.startsWith('launchsite')) return

        const clickedSite = LAUNCH_SITES.find((site) => site.id === point.id)
        if (!clickedSite) return

        setTargetBase(clickedSite)
        if (onTargetBaseChange) onTargetBaseChange(clickedSite)
        onLaunchSiteClickRef.current?.(clickedSite)
        globe.pointOfView({ lat: clickedSite.lat, lng: clickedSite.lon }, 2000)
      })
      .onPointHover((point) => {
        // Launch sites are clickable (Cape Canaveral opens its live feed)
        if (globeRef.current) globeRef.current.style.cursor = point?.type?.startsWith('launchsite') ? 'pointer' : ''
      })

          // true dot for the intersection
      .objectsData([intersectionPoint])
      .objectLat(d => d.lat)
      .objectLng(d => d.lng)
      .objectAltitude(d => d.alt)
      .objectLabel(d => d.name)
      .objectThreeObject(d =>
        new THREE.Mesh(
          new THREE.SphereGeometry(1, 16, 16), // radius in globe units (globe radius = 100)
          new THREE.MeshBasicMaterial({ color: d.color })
        )
      );

    globe.pointOfView({ lat: activeTargetBase.lat, lng: activeTargetBase.lon }, 2000)
  }, [mission, trajectory, draftParams, targetBase, onTargetBaseChange])

  return (
    <div ref={containerRef} className={classes.viewport}>
      <div ref={globeRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}