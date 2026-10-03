
import { useEffect, useRef, useState } from 'react'
import classes from './MissionControl.module.css'
import Globe from 'globe.gl'
import * as THREE from 'three'
import moonSurface from '../../assets/moonSurface.jpg'
import sunSurface from '../../assets/sunSurface.jpg'
import { ISS, LAUNCH_SITES } from './launchConfig.js'
import {
  ASCENT_DURATION_MS,
  ASCENT_RATE,
  DEFAULT_TIME_SCALE,
} from './simConfig.js'

const EARTH_R = 6371
const ALT_SCALE = 1
const altFrac = km => (km / EARTH_R) * ALT_SCALE

const MU_KM3_S2 = 398600.4418
const ORBIT_STEPS = 240

const orbitPeriodSec = (altKm) =>
  2 * Math.PI * Math.sqrt(
    Math.pow(EARTH_R + altKm, 3) / MU_KM3_S2
  )

/*
 * Simplified visual descent model.
 *
 * This is deliberately NOT an orbital-mechanics calculation.
 *
 * It gives the landing marker a modest amount of downrange travel
 * rather than placing it an unrealistically large distance away.
 */
function simulatedDescent(altKm) {
  const clampedAltitude = Math.max(0, altKm)

  const travelAngleDeg =
    8 + 0.45 * Math.sqrt(clampedAltitude)

  const travelAngle =
    (travelAngleDeg * Math.PI) / 180

  const descentSec =
    420 + clampedAltitude * 0.45

  return {
    travelAngle,
    descentSec,
  }
}

const DEBRIS_RADIUS_KM = 10

/* ── ISS: live position + ground track from wheretheiss.at ── */
const ISS_API =
  `https://api.wheretheiss.at/v1/satellites/${ISS.noradId}`

const ISS_POSITION_EVERY_MS = 15000
const ISS_TRACK_EVERY_MS = 5 * 60 * 1000

async function fetchIssPosition() {
  const res = await fetch(ISS_API)

  if (!res.ok) {
    throw new Error(`ISS position ${res.status}`)
  }

  return res.json()
}

async function fetchIssTrack() {
  const now = Math.floor(Date.now() / 1000)

  const stamps = Array.from(
    { length: 20 },
    (_, k) => now + (k - 10) * 300
  )

  const get = async (ts) => {
    const res = await fetch(
      `${ISS_API}/positions?timestamps=${ts.join(',')}&units=kilometers`
    )

    if (!res.ok) {
      throw new Error(`ISS track ${res.status}`)
    }

    return res.json()
  }

  const first = await get(stamps.slice(0, 10))

  await new Promise((r) => setTimeout(r, 1100))

  const second = await get(stamps.slice(10))

  return [...first, ...second].map((p) => ({
    lat: p.latitude,
    lng: p.longitude,
    alt: altFrac(p.altitude),
  }))
}

function makeIssObject() {
  const group = new THREE.Group()

  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 16, 16),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
      })
    )
  )

  const panelMat = new THREE.MeshBasicMaterial({
    color: '#4fc3f7',
    side: THREE.DoubleSide,
  })

  ;[-1, 1].forEach((side) => {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.15, 1.1),
      panelMat
    )

    panel.position.x = side * 2
    group.add(panel)
  })

  return group
}

function makeStarField(radius, count = 4000) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  const tints = [
    [1, 1, 1],
    [0.75, 0.85, 1],
    [1, 0.93, 0.8],
  ]

  for (let n = 0; n < count; n++) {
    const u = Math.random() * 2 - 1
    const theta = Math.random() * Math.PI * 2
    const r = radius * (1 + Math.random() * 0.3)
    const s = Math.sqrt(1 - u * u)

    positions.set(
      [
        r * s * Math.cos(theta),
        r * u,
        r * s * Math.sin(theta),
      ],
      n * 3
    )

    const brightness =
      0.35 + Math.random() ** 3 * 0.65

    const tint =
      tints[Math.floor(Math.random() * tints.length)]

    colors.set(
      tint.map((c) => c * brightness),
      n * 3
    )
  }

  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3)
  )

  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(colors, 3)
  )

  const material = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    depthWrite: false,
  })

  return new THREE.Points(geometry, material)
}

/*
 * Convert an orbital-plane angle into a globe position.
 *
 * theta is measured inside the orbital plane.
 *
 * RAAN rotates the orbital plane around Earth's Z axis.
 */
function orbitPosition({
  altKm,
  inclinationDeg,
  raanDeg = 0,
  theta,
}) {
  const i =
    (inclinationDeg * Math.PI) / 180

  const raan =
    (raanDeg * Math.PI) / 180

  const x = Math.cos(theta)
  const y = Math.sin(theta) * Math.cos(i)
  const z = Math.sin(theta) * Math.sin(i)

  const xr =
    x * Math.cos(raan) -
    y * Math.sin(raan)

  const yr =
    x * Math.sin(raan) +
    y * Math.cos(raan)

  return {
    lat:
      (Math.asin(z) * 180) / Math.PI,

    lng:
      (Math.atan2(yr, xr) * 180) / Math.PI,

    alt:
      altFrac(altKm),
  }
}

function orbitPoints({
  altKm,
  inclinationDeg,
  raanDeg = 0,
  steps = 180,
}) {
  const pts = []

  for (let n = 0; n <= steps; n++) {
    pts.push(
      orbitPosition({
        altKm,
        inclinationDeg,
        raanDeg,
        theta:
          (n / steps) * 2 * Math.PI,
      })
    )
  }

  return pts
}

function orbitShell(
  globe,
  {
    altMinKm,
    altMaxKm,
    maxLatDeg = 90,
    color,
    opacity = 0.12,
    renderOrder = 0,
  }
) {
  const R = globe.getGlobeRadius()

  const radius = km =>
    R * (1 + altFrac(km))

  const thetaStart =
    ((90 - maxLatDeg) * Math.PI) / 180

  const thetaLength =
    (2 * maxLatDeg * Math.PI) / 180

  const makeSphere = km => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(
        radius(km),
        96,
        64,
        0,
        Math.PI * 2,
        thetaStart,
        thetaLength
      ),
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

  group.add(
    makeSphere(altMinKm),
    makeSphere(altMaxKm)
  )

  globe.scene().add(group)

  return group
}

// A cloud of tiny points floating at lat/lng/altitude.
function makePoints(
  globe,
  items,
  { size, color, opacity }
) {
  const arr =
    new Float32Array(items.length * 3)

  items.forEach(
    ([lat, lng, altKm], i) => {
      const { x, y, z } =
        globe.getCoords(
          lat,
          lng,
          altFrac(altKm)
        )

      arr.set([x, y, z], i * 3)
    }
  )

  const geometry =
    new THREE.BufferGeometry()

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(arr, 3)
  )

  const material =
    new THREE.PointsMaterial({
      size,
      color,
      opacity,
      transparent: true,
      sizeAttenuation: true,
      depthWrite: false,
    })

  return new THREE.Points(
    geometry,
    material
  )
}

/*
 * Derive the orbital plane directly from:
 *
 *   launch latitude
 *   launch longitude
 *   launch azimuth
 *
 * This is the important part of the launch visualization.
 *
 * Instead of finding a vaguely nearby point on an arbitrary orbit,
 * we construct the orbital plane from the actual launch direction.
 *
 * Therefore:
 *
 *   launch site
 *       ↓
 *   launch azimuth
 *       ↓
 *   orbital plane
 *       ↓
 *   target orbit
 *
 * The target orbit's ground track therefore starts directly under
 * the ascent trajectory.
 */
function getLaunchOrbitGeometry(
  latDeg,
  lonDeg,
  azimuthDeg
) {
  const lat =
    (latDeg * Math.PI) / 180

  const lon =
    (lonDeg * Math.PI) / 180

  const az =
    (azimuthDeg * Math.PI) / 180

  // Launch-site position vector.
  const r = {
    x:
      Math.cos(lat) * Math.cos(lon),

    y:
      Math.cos(lat) * Math.sin(lon),

    z:
      Math.sin(lat),
  }

  // Local north vector.
  const north = {
    x:
      -Math.sin(lat) * Math.cos(lon),

    y:
      -Math.sin(lat) * Math.sin(lon),

    z:
      Math.cos(lat),
  }

  // Local east vector.
  const east = {
    x:
      -Math.sin(lon),

    y:
      Math.cos(lon),

    z: 0,
  }

  /*
   * Azimuth convention:
   *
   *   0°   = north
   *   90°  = east
   *   180° = south
   *   270° = west
   */
  const velocity = {
    x:
      Math.cos(az) * north.x +
      Math.sin(az) * east.x,

    y:
      Math.cos(az) * north.y +
      Math.sin(az) * east.y,

    z:
      Math.cos(az) * north.z +
      Math.sin(az) * east.z,
  }

  /*
   * Orbital angular momentum.
   *
   * r × v gives the normal vector to the orbital plane.
   */
  const h = {
    x:
      r.y * velocity.z -
      r.z * velocity.y,

    y:
      r.z * velocity.x -
      r.x * velocity.z,

    z:
      r.x * velocity.y -
      r.y * velocity.x,
  }

  const hMagnitude =
    Math.sqrt(
      h.x * h.x +
      h.y * h.y +
      h.z * h.z
    )

  const inclinationRad =
    Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          h.z / hMagnitude
        )
      )
    )

  const inclinationDeg =
    (inclinationRad * 180) / Math.PI

  /*
   * RAAN:
   *
   * atan2(hx, -hy)
   */
  let raanRad =
    Math.atan2(
      h.x,
      -h.y
    )

  if (raanRad < 0) {
    raanRad += 2 * Math.PI
  }

  const raanDeg =
    (raanRad * 180) / Math.PI

  /*
   * Basis vectors of the orbital plane.
   *
   * p points toward the ascending node.
   * q is 90° further around the orbital plane.
   */
  const p = {
    x: Math.cos(raanRad),
    y: Math.sin(raanRad),
    z: 0,
  }

  const q = {
    x:
      -Math.sin(raanRad) *
      Math.cos(inclinationRad),

    y:
      Math.cos(raanRad) *
      Math.cos(inclinationRad),

    z:
      Math.sin(inclinationRad),
  }

  /*
   * Find the orbital-plane angle corresponding exactly
   * to the launch-site position.
   */
  const pDotR =
    r.x * p.x +
    r.y * p.y +
    r.z * p.z

  const qDotR =
    r.x * q.x +
    r.y * q.y +
    r.z * q.z

  const launchTheta =
    Math.atan2(
      qDotR,
      pDotR
    )

  return {
    inclinationDeg,
    raanDeg,
    launchTheta,
  }
}

/*
 * Build the ascent directly along the target orbital ground track.
 *
 * The important difference from the old implementation is that there
 * is no Bézier curve between two arbitrary geographic points.
 *
 * Every ascent point is generated using the exact same orbital plane
 * as the target orbit, while altitude increases from 0 to the target.
 */
function getAscent(
  base,
  targetInclinationDeg,
  targetAltitudeKm,
  azimuthDeg = 90,
  steps = 80
) {
  if (!base) {
    return {
      ascent: [],
      endTheta: 0,
      raanDeg: 0,
      inclinationDeg:
        targetInclinationDeg,
      launchTheta: 0,
    }
  }

  const launchLat =
    Number(base.lat) || 0

  const launchLng =
    Number(
      base.lon ?? base.lng
    ) || 0

  const parsedAzimuth =
    Number(azimuthDeg)

  const azimuth =
    Number.isFinite(parsedAzimuth)
      ? parsedAzimuth
      : 90

  /*
   * Derive the actual orbital geometry from the launch
   * site and launch azimuth.
   */
  const geometry =
    getLaunchOrbitGeometry(
      launchLat,
      launchLng,
      azimuth
    )

  const {
    raanDeg,
    launchTheta,
    inclinationDeg,
  } = geometry

  /*
   * The derived inclination is the inclination implied by
   * the launch azimuth.
   *
   * This keeps the ascent, azimuth, and orbital plane
   * geometrically consistent.
   */
  const orbitInclination =
    inclinationDeg

  /*
   * Only move a small amount downrange while climbing.
   *
   * This prevents the ascent from appearing to travel
   * a huge distance across the Earth before reaching orbit.
   *
   * At 700 km this is roughly 2.7° of orbital travel.
   */
  const orbitTravel =
  Math.min(
    0.7,
    Math.max(
      0.2,
      targetAltitudeKm / 1800
    )
  )

  const ascent = []

  for (
    let n = 0;
    n <= steps;
    n++
  ) {
    const t =
      n / steps

    /*
     * Smoothstep makes the altitude transition start and
     * finish smoothly.
     */
    const smoothT =
      t * t * (3 - 2 * t)

    const theta =
      launchTheta +
      orbitTravel * smoothT

    const altitudeKm =
      targetAltitudeKm *
      smoothT

    const point =
      orbitPosition({
        altKm: altitudeKm,
        inclinationDeg:
          orbitInclination,
        raanDeg,
        theta,
      })

    /*
     * Force the first point to be exactly the launch site.
     *
     * This removes any floating-point discrepancy and makes
     * the ascent visibly originate directly at the pad.
     */
    if (n === 0) {
      ascent.push({
        lat: launchLat,
        lng: launchLng,
        alt: 0,
      })
    } else {
      ascent.push(point)
    }
  }

  return {
    ascent,

    endTheta:
      launchTheta +
      orbitTravel,

    raanDeg,

    inclinationDeg:
      orbitInclination,

    launchTheta,
  }
}

export default function SceneViewport({
  mission,
  windows,
  selectedId,
  onSelect,
  trajectory,
  shellsVisible = {
    leo: false,
    polar: false,
    sso: false,
    debris: true,
  },
  draftParams,
  onTargetBaseChange,
  onLaunchSiteClick,
  onIssClick,
  simulation,
  timeScale = DEFAULT_TIME_SCALE,
}) {
  const containerRef = useRef(null)
  const globeRef = useRef(null)
  const globeInstance = useRef(null)

  const shellMeshes = useRef({})

  const [size, setSize] =
    useState({
      width: 0,
      height: 0,
    })

  const [targetBase, setTargetBase] =
    useState(null)

  const [debris, setDebris] =
    useState(null)

  const [entry, setEntry] =
    useState(null)

  const onLaunchSiteClickRef =
    useRef(onLaunchSiteClick)

  onLaunchSiteClickRef.current =
    onLaunchSiteClick

  const onTargetBaseChangeRef =
    useRef(onTargetBaseChange)

  onTargetBaseChangeRef.current =
    onTargetBaseChange

  const onIssClickRef =
    useRef(onIssClick)

  onIssClickRef.current =
    onIssClick

  // Site the camera last flew to.
  const lastViewedSiteRef =
    useRef(null)

  const missionLayers =
    useRef({
      paths: [],
      objects: [],
    })

  const issData =
    useRef({
      position: null,
      track: [],
    })

  const applyLayers = () => {
    const globe =
      globeInstance.current

    if (!globe) return

    const {
      position,
      track,
    } = issData.current

    const issPaths =
      track.length > 1
        ? [
            {
              name: 'ISS orbit (past)',

              pts: position
                ? [
                    ...track.slice(0, 11),
                    {
                      lat: position.latitude,
                      lng: position.longitude,
                      alt: altFrac(
                        position.altitude
                      ),
                    },
                  ]
                : track.slice(0, 11),

              color: [
                'rgba(0, 200, 255, 0.05)',
                'rgba(0, 200, 255, 0.9)',
              ],

              stroke: 1.4,
            },

            {
              name: 'ISS orbit (ahead)',

              pts: position
                ? [
                    {
                      lat: position.latitude,
                      lng: position.longitude,
                      alt: altFrac(
                        position.altitude
                      ),
                    },
                    ...track.slice(10),
                  ]
                : track.slice(10),

              color: [
                '#7ff3ff',
                'rgba(127, 243, 255, 0.35)',
              ],

              stroke: 1.8,
              dashLength: 0.04,
              dashGap: 0.02,
              dashAnimateTime: 12000,
            },
          ]
        : []

    const issObjects =
      position
        ? [
            {
              id: ISS.id,
              type: 'iss',
              name:
                `${ISS.name} · ` +
                `${Math.round(
                  position.altitude
                )} km up · ` +
                `${Math.round(
                  position.velocity
                ).toLocaleString()} km/h ` +
                `(click for live video)`,

              lat: position.latitude,
              lng: position.longitude,
              alt: altFrac(
                position.altitude
              ),
            },
          ]
        : []

    globe.pathsData([
      ...missionLayers.current.paths,
      ...issPaths,
    ])

    globe.objectsData([
      ...missionLayers.current.objects,
      ...issObjects,
    ])
  }

  /*
   * Everything needed by the launch animation.
   */
  const flightRef = useRef({
    ascent: [],
    endTheta: 0,
    altKm: 0,
    inclinationDeg: 0,
    raanDeg: 0,
  })

  const shellsVisibleRef =
    useRef(shellsVisible)

  const timeScaleRef =
    useRef(timeScale)

  useEffect(() => {
    timeScaleRef.current =
      timeScale
  }, [timeScale])

  const siteId =
    draftParams?.siteId ??
    mission?.launchSite?.id ??
    LAUNCH_SITES[0].id

  const targetInclination =
    Number(
      draftParams?.inclinationDeg ??
      mission?.inclinationDeg ??
      0
    )

  const targetAltitude =
    Number(
      draftParams?.altitudeKm ??
      mission?.altitudeKm ??
      0
    )

  const ascentAzimuth =
    Number(mission?.azimuthDeg)

  // Track container size.
  useEffect(() => {
    const el =
      containerRef.current

    if (!el) return

    const observer =
      new ResizeObserver(
        ([entry]) => {
          const {
            width,
            height,
          } = entry.contentRect

          setSize({
            width: Math.round(width),
            height: Math.round(height),
          })
        }
      )

    observer.observe(el)

    return () =>
      observer.disconnect()
  }, [])

  // Create globe.
  useEffect(() => {
    const el =
      globeRef.current

    if (!el) return

    const globe =
      Globe()(el)
        .globeImageUrl(
          'https://i2.wp.com/eoimages.gsfc.nasa.gov/images/imagerecords/74000/74518/world.topo.200412.3x5400x2700.jpg?ssl=1'
        )
        .backgroundColor(
          'rgba(0,0,0,0)'
        )

    globeInstance.current =
      globe

    const earthRadius =
      globe.getGlobeRadius()

    const moonDistance =
      earthRadius * 3.2

    const sunDistance =
      earthRadius * 18

    const sunRadius =
      earthRadius * 0.45

    const moonRadius =
      earthRadius * 0.12

    const makeGlowSprite = ({
      color,
      opacity,
      size,
    }) => {
      const canvas =
        document.createElement(
          'canvas'
        )

      canvas.width = 256
      canvas.height = 256

      const ctx =
        canvas.getContext('2d')

      const gradient =
        ctx.createRadialGradient(
          128,
          128,
          12,
          128,
          128,
          128
        )

      gradient.addColorStop(
        0,
        color
      )

      gradient.addColorStop(
        0.25,
        color
      )

      gradient.addColorStop(
        0.55,
        'rgba(255,255,255,0.18)'
      )

      gradient.addColorStop(
        1,
        'rgba(0,0,0,0)'
      )

      ctx.fillStyle = gradient
      ctx.fillRect(
        0,
        0,
        256,
        256
      )

      const texture =
        new THREE.CanvasTexture(
          canvas
        )

      const material =
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity,
          depthWrite: false,
          blending:
            THREE.AdditiveBlending,
        })

      const sprite =
        new THREE.Sprite(material)

      sprite.scale.set(
        size,
        size,
        1
      )

      return sprite
    }

    const textureLoader =
      new THREE.TextureLoader()

    const moonTexture =
      textureLoader.load(
        moonSurface
      )

    const sunTexture =
      textureLoader.load(
        sunSurface
      )

    const sun =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          sunRadius,
          32,
          32
        ),
        new THREE.MeshBasicMaterial({
          color: '#ffb347',
          map: sunTexture,
        })
      )

    sun.position.set(
      -sunDistance,
      0,
      0
    )

    const sunGlow =
      makeGlowSprite({
        color:
          'rgba(255, 185, 71, 0.95)',
        opacity: 0.9,
        size:
          sunRadius * 10,
      })

    sun.add(sunGlow)

    const moon =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          moonRadius,
          24,
          24
        ),
        new THREE.MeshBasicMaterial({
          color: '#d7dce6',
          map: moonTexture,
        })
      )

    moon.position.set(
      moonDistance,
      0,
      0
    )

    const moonGlow =
      makeGlowSprite({
        color:
          'rgba(180, 195, 215, 0.7)',
        opacity: 0.35,
        size:
          moonRadius * 12,
      })

    moon.add(moonGlow)

    globe.scene().add(sun)
    globe.scene().add(moon)

    const stars =
      makeStarField(
        earthRadius * 30
      )

    globe.scene().add(stars)

    const camera =
      globe.camera()

    if (
      camera.far <
      earthRadius * 45
    ) {
      camera.far =
        earthRadius * 45

      camera.updateProjectionMatrix()
    }

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

    Object.entries(
      shellMeshes.current
    ).forEach(
      ([name, mesh]) => {
        mesh.visible =
          shellsVisibleRef
            .current[name] ??
          false
      }
    )

    return () => {
      globe.pathsData([])
      globe.pointsData([])
      globe.objectsData([])

      Object.values(
        shellMeshes.current
      ).forEach((g) => {
        globe.scene().remove(g)

        g.traverse((o) => {
          o.geometry?.dispose()
          o.material?.dispose()
        })
      })

      globe._destructor()

      el.innerHTML = ''

      globeInstance.current =
        null
    }
  }, [])

  // Resize globe.
  useEffect(() => {
    const globe =
      globeInstance.current

    if (
      globe &&
      size.width &&
      size.height
    ) {
      globe
        .width(size.width)
        .height(size.height)
    }
  }, [size])

  // Shell visibility.
  useEffect(() => {
    shellsVisibleRef.current =
      shellsVisible

    Object.entries(
      shellsVisible
    ).forEach(
      ([name, visible]) => {
        if (
          shellMeshes.current[name]
        ) {
          shellMeshes.current[
            name
          ].visible = visible
        }
      }
    )
  }, [shellsVisible])

  /*
   * Static drawing:
   *
   *   launch site
   *       ↓
   *   ascent
   *       ↓
   *   target orbit
   *
   * The ascent and orbit share the exact same orbital plane.
   */
  useEffect(() => {
    const globe =
      globeInstance.current

    if (!globe) return

    const activeTargetBase =
      (
        draftParams?.siteId &&
        LAUNCH_SITES.find(
          (s) =>
            s.id ===
            draftParams.siteId
        )
      ) ||
      targetBase ||
      mission?.launchSite ||
      LAUNCH_SITES[0]

    const {
      ascent,
      endTheta,
      raanDeg,
      inclinationDeg,
    } =
      getAscent(
        activeTargetBase,
        targetInclination,
        targetAltitude,
        ascentAzimuth,
        80
      )

    if (
      !ascent ||
      ascent.length < 2
    ) {
      return
    }

    /*
     * Save all geometry needed by the animation.
     */
    flightRef.current = {
      ascent,
      endTheta,
      raanDeg,
      altKm:
        targetAltitude,
      inclinationDeg,
    }

    const orbits = []

    if (
      targetAltitude > 0 &&
      inclinationDeg > 0
    ) {
      orbits.push({
        pts: orbitPoints({
          altKm:
            targetAltitude,

          inclinationDeg,

          raanDeg,
        }),

        color: 'red',
        stroke: 1,
      })
    }

    const paths = [
      {
        name: 'Ascent Path',
        pts: ascent,
        color: 'red',
        stroke: 2,
      },

      ...orbits,
    ]

    globe
      .pointsData([])
      .pathPoints(
        d => d.pts
      )
      .pathPointLat(
        p => p.lat
      )
      .pathPointLng(
        p => p.lng
      )
      .pathPointAlt(
        p => p.alt
      )
      .pathColor(
        d => d.color
      )
      .pathStroke(
        d => d.stroke
      )
      .pathDashLength(
        d =>
          d.dashLength ?? 1
      )
      .pathDashGap(
        d =>
          d.dashGap ?? 0
      )
      .pathDashAnimateTime(
        d =>
          d.dashAnimateTime ?? 0
      )
      .pathTransitionDuration(0)
      .pathResolution(1)

    const markers = []

    LAUNCH_SITES.forEach(
      (launchSite) => {
        const isActive =
          launchSite.id ===
          activeTargetBase.id

        markers.push({
          id: launchSite.id,
          type:
            'launchsite-interactive',
          name:
            launchSite.name,
          lat:
            launchSite.lat,
          lng:
            launchSite.lon,
          alt: 0,
          color:
            isActive
              ? 'yellow'
              : 'white',
        })

        if (isActive) {
          markers.push({
            id: launchSite.id,
            type:
              'launchsite-selected',
            name:
              launchSite.name,
            lat:
              launchSite.lat,
            lng:
              launchSite.lon,
            alt: 0,
            color: 'black',
          })
        }
      }
    )

    const last =
      ascent[
        ascent.length - 1
      ]

    /*
     * Point where the ascent reaches the target altitude.
     */
    setEntry({
      lat: last.lat,
      lon: last.lng,
      altKm:
        targetAltitude,
    })

    markers.push({
      id:
        'ascent-target',
      type: 'target',
      lat: last.lat,
      lng: last.lng,
      alt: last.alt,
      color: 'yellow',
    })

    /*
     * Green intersection point:
     *
     * This is exactly where the ascent meets the target
     * orbital altitude.
     */
    const intersectionPoint = {
      id:
        'intersection-point',

      type:
        'intersection',

      name:
        `${last.lat.toFixed(2)}°, ` +
        `lon: ${last.lng.toFixed(2)}°, ` +
        `alt: ${targetAltitude} km`,

      lat: last.lat,
      lng: last.lng,
      alt: last.alt,
      color: '#2fe36b',
    }

    globe
      .pointsData(markers)
      .pointLat(
        d => d.lat
      )
      .pointLng(
        d => d.lng
      )
      .pointAltitude(
        d => d.alt
      )
      .pointLabel(
        d => d.name
      )
      .pointRadius(
        d =>
          d.type ===
          'launchsite-interactive'
            ? 1.5
            : d.type ===
              'launchsite-selected'
              ? 1.0
              : 0.5
      )
      .pointColor(
        d => d.color
      )
      .onPointClick(
        (
          point,
          event,
          coords
        ) => {
          if (
            !coords ||
            !point?.type?.startsWith(
              'launchsite'
            )
          ) {
            return
          }

          const clickedSite =
            LAUNCH_SITES.find(
              site =>
                site.id ===
                point.id
            )

          if (!clickedSite) {
            return
          }

          setTargetBase(
            clickedSite
          )

          onTargetBaseChangeRef
            .current?.(
              clickedSite
            )

          onLaunchSiteClickRef
            .current?.(
              clickedSite
            )

          lastViewedSiteRef.current =
            clickedSite.id

          globe.pointOfView(
            {
              lat:
                clickedSite.lat,
              lng:
                clickedSite.lon,
            },
            2000
          )
        }
      )
      .onPointHover(
        (point) => {
          if (
            globeRef.current
          ) {
            globeRef.current.style.cursor =
              point?.type?.startsWith(
                'launchsite'
              )
                ? 'pointer'
                : ''
          }
        }
      )
      .objectLat(
        d => d.lat
      )
      .objectLng(
        d => d.lng
      )
      .objectAltitude(
        d => d.alt
      )
      .objectLabel(
        d => d.name
      )
      .objectThreeObject(
        d =>
          new THREE.Mesh(
            new THREE.SphereGeometry(
              1,
              16,
              16
            ),
            new THREE.MeshBasicMaterial(
              {
                color:
                  d.color,
              }
            )
          )
      )

    missionLayers.current = {
      paths,
      objects: [
        intersectionPoint,
      ],
    }

    globe
      .objectThreeObject(
        d =>
          d.type === 'iss'
            ? makeIssObject()
            : new THREE.Mesh(
                new THREE.SphereGeometry(
                  1,
                  16,
                  16
                ),
                new THREE.MeshBasicMaterial(
                  {
                    color:
                      d.color,
                  }
                )
              )
      )
      .onObjectClick(
        (obj) => {
          if (
            obj?.type === 'iss'
          ) {
            onIssClickRef
              .current?.()
          }
        }
      )
      .onObjectHover(
        (obj) => {
          if (
            globeRef.current
          ) {
            globeRef.current.style.cursor =
              obj?.type === 'iss'
                ? 'pointer'
                : ''
          }
        }
      )

    applyLayers()
  }, [
    siteId,
    targetInclination,
    targetAltitude,
    ascentAzimuth,
    draftParams?.siteId,
    targetBase,
    mission?.launchSite,
  ])

  // Camera: only moves when launch site changes.
  useEffect(() => {
    const globe =
      globeInstance.current

    const site =
      LAUNCH_SITES.find(
        s => s.id === siteId
      )

    if (!globe || !site) {
      return
    }

    if (
      lastViewedSiteRef.current ===
      site.id
    ) {
      return
    }

    lastViewedSiteRef.current =
      site.id

    globe.pointOfView(
      {
        lat: site.lat,
        lng: site.lon,
      },
      2000
    )
  }, [siteId])

  /*
   * Launch animation.
   *
   * 1. Rocket follows ascent.
   * 2. Rocket reaches target orbit.
   * 3. Rocket becomes the cyan satellite.
   * 4. Green marker shows simplified landing zone.
   */
  useEffect(() => {
    const globe =
      globeInstance.current

    const flight =
      flightRef.current

    const ascent =
      flight.ascent

    if (
      !globe ||
      !simulation ||
      !ascent ||
      ascent.length < 2
    ) {
      return
    }

    const coords =
      ascent.map(
        p =>
          globe.getCoords(
            p.lat,
            p.lng,
            p.alt
          )
      )

    // ROCKET
    const rocket =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          1.2,
          16,
          16
        ),
        new THREE.MeshBasicMaterial({
          color: '#ffffff',
        })
      )

    rocket.renderOrder = 10

    // ASCENT TRAIL
    const trailGeom =
      new THREE.BufferGeometry()

    trailGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array(
          coords.length * 3
        ),
        3
      )
    )

    trailGeom.setDrawRange(
      0,
      0
    )

    const trail =
      new THREE.Line(
        trailGeom,
        new THREE.LineBasicMaterial({
          color: '#ff9800',
        })
      )

    trail.frustumCulled = false
    trail.renderOrder = 10

    // ORBITING SATELLITE
    const satellite =
      flight.altKm > 0
        ? new THREE.Mesh(
            new THREE.SphereGeometry(
              1.2,
              16,
              16
            ),
            new THREE.MeshBasicMaterial(
              {
                color: '#00e5ff',
              }
            )
          )
        : null

    if (satellite) {
      satellite.renderOrder = 10
    }

    // LANDING MARKER
    const landingMarker =
      satellite
        ? new THREE.Mesh(
            new THREE.SphereGeometry(
              0.9,
              16,
              16
            ),
            new THREE.MeshBasicMaterial(
              {
                color: '#39ff14',
              }
            )
          )
        : null

    if (landingMarker) {
      landingMarker.renderOrder = 10

      // Hidden during ascent.
      landingMarker.visible =
        false
    }

    // ORBIT SPEED
    const omega =
      flight.altKm > 0
        ? (2 * Math.PI) /
          orbitPeriodSec(
            flight.altKm
          )
        : 0

    // SIMPLIFIED DESCENT
    const descent =
      simulatedDescent(
        flight.altKm
      )

    const landingAngle =
      descent.travelAngle

    globe.scene().add(
      rocket,
      trail
    )

    if (satellite) {
      globe.scene().add(
        satellite
      )

      if (landingMarker) {
        globe.scene().add(
          landingMarker
        )
      }
    }

    let last =
      performance.now()

    let simMs = 0

    let ascentDone = false

    let raf = null

    const tick = () => {
      const now =
        performance.now()

      const dt =
        now - last

      last = now

      simMs +=
        dt *
        timeScaleRef.current

      // ---- ASCENT ----
      if (!ascentDone) {
        const progress =
          Math.min(
            1,
            (
              simMs /
              ASCENT_DURATION_MS
            ) *
              ASCENT_RATE
          )

        const f =
          progress *
          (coords.length - 1)

        const i =
          Math.min(
            Math.floor(f),
            coords.length - 1
          )

        const k =
          f - i

        const a =
          coords[i]

        const b =
          coords[
            Math.min(
              i + 1,
              coords.length - 1
            )
          ]

        const x =
          a.x +
          (b.x - a.x) *
            k

        const y =
          a.y +
          (b.y - a.y) *
            k

        const z =
          a.z +
          (b.z - a.z) *
            k

        rocket.position.set(
          x,
          y,
          z
        )

        // Update trail.
        const pos =
          trailGeom
            .attributes
            .position

        for (
          let n = 0;
          n <= i;
          n++
        ) {
          pos.setXYZ(
            n,
            coords[n].x,
            coords[n].y,
            coords[n].z
          )
        }

        pos.setXYZ(
          Math.min(
            i + 1,
            coords.length - 1
          ),
          x,
          y,
          z
        )

        pos.needsUpdate = true

        trailGeom.setDrawRange(
          0,
          Math.min(
            i + 2,
            coords.length
          )
        )

        // Enter orbit.
        if (
          progress >= 1
        ) {
          ascentDone = true

          rocket.visible =
            false

          if (
            landingMarker
          ) {
            landingMarker.visible =
              true
          }
        }
      }

      // ---- ORBIT ----
      if (
        satellite &&
        ascentDone
      ) {
        const ascentSimMs =
          ASCENT_DURATION_MS /
          ASCENT_RATE

        const orbitTime =
          Math.max(
            0,
            simMs -
              ascentSimMs
          ) / 1000

        /*
         * Continue from the exact theta where the ascent
         * entered the target orbit.
         */
        const theta =
          flight.endTheta +
          omega * orbitTime

        // Cyan spacecraft.
        const satellitePosition =
          orbitPosition({
            altKm:
              flight.altKm,

            inclinationDeg:
              flight.inclinationDeg,

            raanDeg:
              flight.raanDeg,

            theta,
          })

        const satelliteCoords =
          globe.getCoords(
            satellitePosition.lat,
            satellitePosition.lng,
            satellitePosition.alt
          )

        satellite.position.set(
          satelliteCoords.x,
          satelliteCoords.y,
          satelliteCoords.z
        )

        /*
         * Green landing zone:
         *
         * Same orbital plane as the spacecraft, projected
         * down onto Earth's surface.
         */
        if (
          landingMarker
        ) {
          const landingPosition =
            orbitPosition({
              altKm: 0,

              inclinationDeg:
                flight.inclinationDeg,

              raanDeg:
                flight.raanDeg,

              theta:
                theta +
                landingAngle,
            })

          const landingCoords =
            globe.getCoords(
              landingPosition.lat,
              landingPosition.lng,
              0.005
            )

          landingMarker.position.set(
            landingCoords.x,
            landingCoords.y,
            landingCoords.z
          )
        }
      }

      raf =
        requestAnimationFrame(
          tick
        )
    }

    raf =
      requestAnimationFrame(
        tick
      )

    return () => {
      if (raf !== null) {
        cancelAnimationFrame(
          raf
        )

        raf = null
      }

      globe.scene().remove(
        rocket,
        trail
      )

      if (satellite) {
        globe.scene().remove(
          satellite
        )
      }

      if (landingMarker) {
        globe.scene().remove(
          landingMarker
        )
      }

      rocket.geometry.dispose()
      rocket.material.dispose()

      trailGeom.dispose()
      trail.material.dispose()

      if (satellite) {
        satellite.geometry.dispose()
        satellite.material.dispose()
      }

      if (landingMarker) {
        landingMarker.geometry.dispose()
        landingMarker.material.dispose()
      }
    }
  }, [simulation])

  // ISS: poll live position and refresh orbit track.
  useEffect(() => {
    let cancelled = false

    const updatePosition =
      () =>
        fetchIssPosition()
          .then((position) => {
            if (cancelled) {
              return
            }

            issData.current.position =
              position

            applyLayers()
          })
          .catch((e) =>
            console.warn(
              'ISS position unavailable:',
              e.message
            )
          )

    const updateTrack =
      () =>
        fetchIssTrack()
          .then((track) => {
            if (cancelled) {
              return
            }

            issData.current.track =
              track

            applyLayers()
          })
          .catch((e) =>
            console.warn(
              'ISS track unavailable:',
              e.message
            )
          )

    updatePosition()

    const trackDelay =
      setTimeout(
        updateTrack,
        1200
      )

    const positionTimer =
      setInterval(
        updatePosition,
        ISS_POSITION_EVERY_MS
      )

    const trackTimer =
      setInterval(
        updateTrack,
        ISS_TRACK_EVERY_MS
      )

    return () => {
      cancelled = true

      clearTimeout(
        trackDelay
      )

      clearInterval(
        positionTimer
      )

      clearInterval(
        trackTimer
      )
    }
  }, [])

  // Ask backend what debris is near entry point.
  useEffect(() => {
    if (!entry) {
      return
    }

    const win =
      windows?.find(
        w => w.id === selectedId
      ) ??
      windows?.[0]

    const base =
      win
        ? new Date(
            win.opensAt
          ).getTime()
        : Date.now()

    const when =
      new Date(
        base +
          600 * 1000
      )

    const ctrl =
      new AbortController()

    const qs =
      new URLSearchParams({
        lat: entry.lat,
        lon: entry.lon,
        alt_km: entry.altKm,
        time:
          when.toISOString(),
        radius_km:
          DEBRIS_RADIUS_KM,
      })

    console.log(
      'requesting debris check:',
      Object.fromEntries(qs)
    )

    fetch(
      `/api/debris?${qs}`,
      {
        signal:
          ctrl.signal,
      }
    )
      .then(r =>
        r.ok
          ? r.json()
          : Promise.reject(
              new Error(
                `debris request failed: ${r.status}`
              )
            )
      )
      .then(data => {
        setDebris(data)

        console.log(
          'debris check:',
          data.clear
            ? 'CLEAR'
            : `${data.nearby.length} nearby`,
          'cloud size:',
          data.cloud.length
        )
      })
      .catch(err => {
        if (
          err.name !==
          'AbortError'
        ) {
          console.warn(err)
        }
      })

    return () =>
      ctrl.abort()
  }, [
    entry?.lat,
    entry?.lon,
    entry?.altKm,
    windows,
    selectedId,
  ])

  // Draw debris as tiny points.
  useEffect(() => {
    const globe =
      globeInstance.current

    const debrisOn =
      shellsVisible.debris ??
      true

    if (
      !globe ||
      !debris ||
      !debrisOn
    ) {
      return
    }

    const scene =
      globe.scene()

    const group =
      new THREE.Group()

    const cloud =
      debris.cloud.filter(
        ([
          ,
          ,
          altKm,
        ]) =>
          altKm > 100
      )

    group.add(
      makePoints(
        globe,
        cloud,
        {
          size: 0.9,
          color: '#ff8a80',
          opacity: 0.9,
        }
      )
    )

    if (
      debris.nearby.length
    ) {
      const near =
        debris.nearby.map(
          d => [
            d.lat,
            d.lon,
            d.alt_km,
          ]
        )

      group.add(
        makePoints(
          globe,
          near,
          {
            size: 2.5,
            color: '#ff1744',
            opacity: 1,
          }
        )
      )
    }

    scene.add(group)

    return () => {
      scene.remove(group)

      group.traverse(
        o => {
          o.geometry?.dispose()
          o.material?.dispose()
        }
      )
    }
  }, [
    debris,
    shellsVisible.debris,
  ])

  return (
    <div
      ref={containerRef}
      className={classes.viewport}
    >
      <div
        ref={globeRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  )
}