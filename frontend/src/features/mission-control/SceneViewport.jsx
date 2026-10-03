
import { useEffect, useRef, useState } from 'react'
import classes from './MissionControl.module.css'
import Globe from 'globe.gl'
import * as THREE from 'three'
import moonSurface from '../../assets/moonSurface.jpg'
import sunSurface from '../../assets/sunSurface.jpg'
import { LAUNCH_SITES } from './launchConfig.js'
import {
  ASCENT_DURATION_MS,
  ASCENT_RATE,
  DEFAULT_TIME_SCALE,
} from './simulationConfig.js'

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
 * Instead, it gives the landing marker a plausible-looking amount of
 * downrange travel based on altitude:
 *
 *   200 km  -> ~20 degrees
 *   400 km  -> ~30 degrees
 *   700 km  -> ~40 degrees
 *   1000 km -> ~50 degrees
 *
 * The exact values are visual approximations rather than physical predictions.
 */
function simulatedDescent(altKm) {
  const clampedAltitude = Math.max(0, altKm)

  // Approximate downrange travel in degrees.
  // sqrt() makes the distance increase more gently at high altitude.
  const travelAngleDeg =
    15 + 0.95 * Math.sqrt(clampedAltitude)

  const travelAngle =
    (travelAngleDeg * Math.PI) / 180

  // Approximate descent duration.
  // 700 km -> roughly 12 minutes.
  const descentSec =
    420 + clampedAltitude * 0.45

  return {
    travelAngle,
    descentSec,
  }
}

// orbitPosition: lat / lng / alt of a point on the orbit at angle `theta`.
// theta = 0 is where the orbit crosses the reference longitude.
function orbitPosition({
  altKm,
  inclinationDeg,
  raanDeg = 0,
  theta,
}) {
  const i = (inclinationDeg * Math.PI) / 180
  const raan = (raanDeg * Math.PI) / 180

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
    lat: (Math.asin(z) * 180) / Math.PI,
    lng: (Math.atan2(yr, xr) * 180) / Math.PI,
    alt: altFrac(altKm),
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
        theta: (n / steps) * 2 * Math.PI,
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

// Returns { ascent, endTheta }.
function getAscent(
  base,
  targetInclinationDeg,
  targetAltitudeKm,
  steps = 80
) {
  if (!base) {
    return {
      ascent: [],
      endTheta: 0,
    }
  }

  const launchLat = Number(base.lat) || 0
  const launchLng =
    Number(base.lon ?? base.lng) || 0

  const inclination =
    Number(targetInclinationDeg) || 0

  const targetOrbit = orbitPoints({
    altKm: targetAltitudeKm,
    inclinationDeg: inclination,
    raanDeg: 0,
    steps: ORBIT_STEPS,
  })

  const normalizeLng = value => {
    let v = value

    while (v > 180) v -= 360
    while (v < -180) v += 360

    return v
  }

  const initialBearing = (
    fromLat,
    fromLng,
    toLat,
    toLng
  ) => {
    const toRad = deg =>
      (deg * Math.PI) / 180

    const toDeg = rad =>
      (rad * 180) / Math.PI

    const lat1 = toRad(fromLat)
    const lat2 = toRad(toLat)

    const dLon =
      toRad(toLng - fromLng)

    const y =
      Math.sin(dLon) * Math.cos(lat2)

    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) *
        Math.cos(lat2) *
        Math.cos(dLon)

    const bearing = Math.atan2(y, x)

    return (
      (toDeg(bearing) + 360) % 360
    )
  }

  const desiredHeading =
    inclination >= 90 ? 270 : 90

  let end = targetOrbit[0]
  let endIndex = 0
  let bestScore = Number.POSITIVE_INFINITY

  targetOrbit.forEach((point, idx) => {
    const bearing = initialBearing(
      launchLat,
      launchLng,
      point.lat,
      point.lng
    )

    const headingDelta =
      Math.abs(
        normalizeLng(
          bearing - desiredHeading
        )
      )

    const distance =
      Math.hypot(
        point.lat - launchLat,
        normalizeLng(
          point.lng - launchLng
        )
      )

    const validIntersection =
      headingDelta <= 90

    if (!validIntersection) return

    const score =
      distance + headingDelta * 0.75

    if (score < bestScore) {
      bestScore = score
      end = point
      endIndex = idx
    }
  })

  if (
    !end ||
    Number.isNaN(end.lat) ||
    Number.isNaN(end.lng)
  ) {
    end =
      targetOrbit[0] ?? {
        lat: launchLat,
        lng: launchLng,
        alt: altFrac(targetAltitudeKm),
      }

    endIndex = 0
  }

  const lerp = (a, b, t) =>
    a + (b - a) * t

  const lerpLng = (a, b, t) =>
    a +
    normalizeLng(b - a) * t

  const ascent = []

  const D = Math.max(
    12,
    Math.hypot(
      end.lat - launchLat,
      normalizeLng(
        end.lng - launchLng
      )
    ) * 2.2
  )

  const H = Math.max(
    targetAltitudeKm,
    250
  )

  const P0 = {
    x: 0,
    y: 0,
  }

  const P1 = {
    x: D * 0.12,
    y: H * 0.18,
  }

  const P2 = {
    x: D * 0.68,
    y: Math.min(
      H * 0.82,
      targetAltitudeKm
    ),
  }

  const P3 = {
    x: D,
    y: targetAltitudeKm,
  }

  for (let n = 0; n <= steps; n++) {
    const t = n / steps
    const u = 1 - t

    const tt = t * t
    const uu = u * u
    const uuu = uu * u
    const ttt = tt * t

    const curvePoint = {
      x:
        uuu * P0.x +
        3 * uu * t * P1.x +
        3 * u * tt * P2.x +
        ttt * P3.x,

      y:
        uuu * P0.y +
        3 * uu * t * P1.y +
        3 * u * tt * P2.y +
        ttt * P3.y,
    }

    const xProgress =
      Math.min(
        1,
        Math.max(
          0,
          curvePoint.x / D
        )
      )

    const lat = lerp(
      launchLat,
      end.lat,
      xProgress
    )

    const lng = lerpLng(
      launchLng,
      end.lng,
      xProgress
    )

    const alt =
      altFrac(curvePoint.y)

    ascent.push({
      lat,
      lng,
      alt,
    })
  }

  return {
    ascent,
    endTheta:
      (endIndex / ORBIT_STEPS) *
      2 *
      Math.PI,
  }
}

export default function SceneViewport({
  mission,
  shellsVisible = {
    leo: false,
    polar: false,
    sso: false,
  },
  draftParams,
  onTargetBaseChange,
  simulation,
  timeScale = DEFAULT_TIME_SCALE,
}) {
  const containerRef = useRef(null)
  const globeRef = useRef(null)
  const globeInstance = useRef(null)
  const shellMeshes = useRef({})

  const flightRef = useRef({
    ascent: [],
    endTheta: 0,
    altKm: 0,
    inclinationDeg: 0,
  })

  const shellsVisibleRef =
    useRef(shellsVisible)

  const [size, setSize] = useState({
    width: 0,
    height: 0,
  })

  const timeScaleRef =
    useRef(timeScale)

  useEffect(() => {
    timeScaleRef.current =
      timeScale
  })

  const onTargetBaseChangeRef =
    useRef(onTargetBaseChange)

  useEffect(() => {
    onTargetBaseChangeRef.current =
      onTargetBaseChange
  })

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

  // Track container size
  useEffect(() => {
    const el = containerRef.current

    if (!el) return

    const observer =
      new ResizeObserver(([entry]) => {
        const {
          width,
          height,
        } = entry.contentRect

        setSize({
          width: Math.round(width),
          height: Math.round(height),
        })
      })

    observer.observe(el)

    return () =>
      observer.disconnect()
  }, [])

  // Create globe
  useEffect(() => {
    const el = globeRef.current

    if (!el) return

    const globe = Globe()(el)
      .globeImageUrl(
        'https://i2.wp.com/eoimages.gsfc.nasa.gov/images/imagerecords/74000/74518/world.topo.200412.3x5400x2700.jpg?ssl=1'
      )
      .backgroundColor(
        'rgba(0,0,0,0)'
      )

    globeInstance.current = globe

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
          shellsVisibleRef.current[
            name
          ] ?? false
      }
    )

    return () => {
      globe.pathsData([])
      globe.pointsData([])
      globe.objectsData([])

      Object.values(
        shellMeshes.current
      ).forEach(g => {
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

  // Resize globe
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

  // Shell visibility
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

  // Static drawing
  useEffect(() => {
    const globe =
      globeInstance.current

    if (!globe) return

    const activeTargetBase =
      LAUNCH_SITES.find(
        s => s.id === siteId
      ) ?? LAUNCH_SITES[0]

    const {
      ascent,
      endTheta,
    } = getAscent(
      activeTargetBase,
      targetInclination,
      targetAltitude,
      80
    )

    if (
      !ascent ||
      ascent.length < 2
    ) {
      return
    }

    flightRef.current = {
      ascent,
      endTheta,
      altKm: targetAltitude,
      inclinationDeg:
        targetInclination,
    }

    const orbits = []

    if (
      targetAltitude > 0 &&
      targetInclination > 0
    ) {
      orbits.push({
        pts: orbitPoints({
          altKm: targetAltitude,
          inclinationDeg:
            targetInclination,
          raanDeg: 0,
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
      .pathsData(paths)
      .pathPoints(d => d.pts)
      .pathPointLat(p => p.lat)
      .pathPointLng(p => p.lng)
      .pathPointAlt(p => p.alt)
      .pathColor(d => d.color)
      .pathStroke(d => d.stroke)
      .pathResolution(1)

    const markers = []

    LAUNCH_SITES.forEach(
      launchSite => {
        const isActive =
          launchSite.id ===
          activeTargetBase.id

        markers.push({
          id: launchSite.id,
          type:
            'launchsite-interactive',
          name: launchSite.name,
          lat: launchSite.lat,
          lng: launchSite.lon,
          alt: 0,
          color: isActive
            ? 'yellow'
            : 'white',
        })

        if (isActive) {
          markers.push({
            id: launchSite.id,
            type:
              'launchsite-selected',
            name: launchSite.name,
            lat: launchSite.lat,
            lng: launchSite.lon,
            alt: 0,
            color: 'black',
          })
        }
      }
    )

    const last =
      ascent[ascent.length - 1]

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
      name:
        last.lat.toFixed(2) +
        '°, lon: ' +
        last.lng.toFixed(2) +
        '°, alt: ' +
        targetAltitude +
        ' km',

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
      .pointRadius(d =>
        d.type ===
        'launchsite-interactive'
          ? 1.5
          : d.type ===
            'launchsite-selected'
            ? 1.0
            : 0.5
      )
      .pointColor(d => d.color)
      .onPointClick(
        (point, event, coords) => {
          if (
            !coords ||
            point?.type !==
              'launchsite-interactive'
          ) {
            return
          }

          const clickedSite =
            LAUNCH_SITES.find(
              site =>
                site.id === point.id
            )

          if (!clickedSite) return

          onTargetBaseChangeRef.current?.(
            clickedSite
          )
        }
      )
      .objectsData([
        intersectionPoint,
      ])
      .objectLat(d => d.lat)
      .objectLng(d => d.lng)
      .objectAltitude(d => d.alt)
      .objectLabel(d => d.name)
      .objectThreeObject(
        d =>
          new THREE.Mesh(
            new THREE.SphereGeometry(
              1,
              16,
              16
            ),
            new THREE.MeshBasicMaterial({
              color: d.color,
            })
          )
      )
  }, [
    siteId,
    targetInclination,
    targetAltitude,
  ])

  // Camera
  useEffect(() => {
    const globe =
      globeInstance.current

    const site =
      LAUNCH_SITES.find(
        s => s.id === siteId
      )

    if (globe && site) {
      globe.pointOfView(
        {
          lat: site.lat,
          lng: site.lon,
        },
        2000
      )
    }
  }, [siteId])


  // Launch animation
  useEffect(() => {
    const globe = globeInstance.current
    const flight = flightRef.current
    const ascent = flight.ascent

    /*
     * IMPORTANT:
     *
     * Every time `simulation` changes, React runs the cleanup
     * of the previous effect before running this one.
     *
     * This means selecting a new time completely kills the
     * previous requestAnimationFrame loop.
     */
    if (
      !globe ||
      !simulation ||
      !ascent ||
      ascent.length < 2
    ) {
      return
    }

    const coords = ascent.map((p) =>
      globe.getCoords(
        p.lat,
        p.lng,
        p.alt
      )
    )

    // --------------------------------
    // ROCKET
    // --------------------------------

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

    // --------------------------------
    // ASCENT TRAIL
    // --------------------------------

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

    trailGeom.setDrawRange(0, 0)

    const trail =
      new THREE.Line(
        trailGeom,
        new THREE.LineBasicMaterial({
          color: '#ff9800',
        })
      )

    trail.frustumCulled = false
    trail.renderOrder = 10

    // --------------------------------
    // ORBITING SATELLITE
    // --------------------------------

    const satellite =
      flight.altKm > 0
        ? new THREE.Mesh(
            new THREE.SphereGeometry(
              1.2,
              16,
              16
            ),
            new THREE.MeshBasicMaterial({
              color: '#00e5ff',
            })
          )
        : null

    if (satellite) {
      satellite.renderOrder = 10
    }

    // --------------------------------
    // LANDING MARKER
    // --------------------------------

    const landingMarker =
      satellite
        ? new THREE.Mesh(
            new THREE.SphereGeometry(
              0.9,
              16,
              16
            ),
            new THREE.MeshBasicMaterial({
              color: '#39ff14',
            })
          )
        : null

    if (landingMarker) {
      landingMarker.renderOrder = 10

      // Do not show the landing zone during ascent.
      landingMarker.visible = false
    }

    // --------------------------------
    // ORBIT SPEED
    // --------------------------------

    const omega =
      flight.altKm > 0
        ? (2 * Math.PI) /
          orbitPeriodSec(
            flight.altKm
          )
        : 0

    // --------------------------------
    // SIMPLIFIED DESCENT
    // --------------------------------

    const descent =
      simulatedDescent(
        flight.altKm
      )

    /*
     * Fixed angular offset from the spacecraft
     * to the projected landing zone.
     */
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

    /*
     * Store the RAF ID in a ref so that it can be
     * cancelled from the cleanup immediately.
     */
    let raf = null

    // ========================================
    // ANIMATION LOOP
    // ========================================

    const tick = () => {
      const now =
        performance.now()

      const dt =
        now - last

      last = now

      simMs +=
        dt *
        timeScaleRef.current

      // ======================================
      // ASCENT
      // ======================================

      if (!ascentDone) {
        const progress = Math.min(1,(simMs / ASCENT_DURATION_MS) * ASCENT_RATE)

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
          (b.x - a.x) * k

        const y =
          a.y +
          (b.y - a.y) * k

        const z =
          a.z +
          (b.z - a.z) * k

        rocket.position.set(
          x,
          y,
          z
        )

        // ==================================
        // UPDATE TRAIL
        // ==================================

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

        // ==================================
        // ENTER ORBIT
        // ==================================

        if (progress >= 1) {
          ascentDone = true

          // Hide physical rocket.
          rocket.visible = false

          /*
           * Show the landing zone exactly when
           * the spacecraft enters orbit.
           */
          if (landingMarker) {
            landingMarker.visible =
              true
          }
        }
      }

      // ========================================
      // ORBIT
      // ========================================

      if (
        satellite &&
        ascentDone
      ) {
          const ascentSimMs =
          ASCENT_DURATION_MS / ASCENT_RATE

          const orbitTime =
          Math.max(0, simMs - ascentSimMs) / 1000
        const theta =
          flight.endTheta +
          omega * orbitTime

        // --------------------------------------
        // CYAN SPACECRAFT
        // --------------------------------------

        const satellitePosition =
          orbitPosition({
            altKm:
              flight.altKm,

            inclinationDeg:
              flight.inclinationDeg,

            raanDeg: 0,

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

        // --------------------------------------
        // GREEN LANDING ZONE
        // --------------------------------------

        /*
         * The landing zone stays a fixed angular
         * distance ahead of the spacecraft.
         */
        if (landingMarker) {
          const landingPosition =
            orbitPosition({
              altKm: 0,

              inclinationDeg:
                flight.inclinationDeg,

              raanDeg: 0,

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

      /*
       * Schedule the next frame.
       *
       * The cleanup below can cancel this exact frame
       * whenever `simulation` changes.
       */
      raf =
        requestAnimationFrame(
          tick
        )
    }

    raf =
      requestAnimationFrame(
        tick
      )

    // ========================================
    // CLEANUP / COMPLETE CANCELLATION
    // ========================================

    return () => {
      /*
       * STOP THE ANIMATION LOOP FIRST.
       *
       * This is the important part when the user
       * selects another time.
       */
      if (raf !== null) {
        cancelAnimationFrame(raf)
        raf = null
      }

      /*
       * Remove all objects belonging to this
       * particular simulation.
       */
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

      /*
       * Dispose Three.js resources so that repeatedly
       * switching launch windows doesn't leak memory.
       */
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

