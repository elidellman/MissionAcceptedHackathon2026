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
const ASCENT_SEC = 600 // PLACEHOLDER: real flight time from liftoff to orbit, replace when known

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
    (_, index) => now + (index - 10) * 300
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

  await new Promise((resolve) => setTimeout(resolve, 1100))

  const second = await get(stamps.slice(10))

  return [...first, ...second].map((issPoint) => ({
    lat: issPoint.latitude,
    lng: issPoint.longitude,
    alt: altFrac(issPoint.altitude),
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

/* ── Miniature 3D models ──────────────────────────────────────────────────────
 * Sizes are in globe units (the Earth's radius is 100), so 1 unit ≈ 64 km:
 * the models are wildly oversized on purpose so they're visible from orbit.
 * Every model is built with +Y pointing "up".
 */
const SITE_MODEL_SCALE = 1.3 // make launch sites bigger/smaller here
const SITES_WITH_ASSEMBLY_BUILDING = new Set(['cape-canaveral'])

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra })

/** Rocket: white body, black interstage, nose cone, four fins, engine bell, optional flame. */
function makeRocketModel({ withFlame = false } = {}) {
  const rocket = new THREE.Group()
  const white = mat('#f4f4f4')
  const dark = mat('#222831')

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.9, 20), white)
  body.position.y = 0.95 + 0.2
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.18, 20), dark) // interstage
  band.position.y = 1.45
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 20), white)
  nose.position.y = 1.9 + 0.2 + 0.275
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.2, 16), dark)
  engine.position.y = 0.1
  rocket.add(body, band, nose, engine)

  for (let finIndex = 0; finIndex < 4; finIndex++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.28), dark)
    const finAngle = (finIndex * Math.PI) / 2
    fin.position.set(Math.cos(finAngle) * 0.3, 0.38, Math.sin(finAngle) * 0.3)
    fin.rotation.y = -finAngle
    rocket.add(fin)
  }

  if (withFlame) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.9, 16),
      new THREE.MeshBasicMaterial({ color: '#ffb300', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    flame.rotation.x = Math.PI // point down
    flame.position.y = -0.45
    flame.name = 'flame'
    const core = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.5, 12),
      new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    core.rotation.x = Math.PI
    core.position.y = -0.25
    rocket.add(flame, core)
  }
  return rocket
}

/** Launch tower: red lattice column with cross-bracing and a crane arm swung over the rocket. */
function makeLaunchTower() {
  const tower = new THREE.Group()
  const red = mat('#c62828')
  const steel = mat('#9e9e9e')
  const towerHeight = 2.9
  // four corner legs
  ;[[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([cornerX, cornerZ]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, towerHeight, 0.06), red)
    leg.position.set(cornerX * 0.17, towerHeight / 2, cornerZ * 0.17)
    tower.add(leg)
  })
  // horizontal rings every few levels
  for (let ringHeight = 0.3; ringHeight < towerHeight; ringHeight += 0.45) {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.4), red)
    ring.position.y = ringHeight
    tower.add(ring)
  }
  // crane arm + hook line at the top
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.1), steel)
  arm.position.set(0.45, towerHeight - 0.15, 0)
  const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.18), steel)
  counterweight.position.set(-0.2, towerHeight - 0.15, 0)
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.5, 0.015), steel)
  cable.position.set(0.85, towerHeight - 0.45, 0)
  // access arm reaching to the rocket
  const access = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.08), steel)
  access.position.set(0.32, 2.0, 0)
  tower.add(arm, counterweight, cable, access)
  return tower
}

/** Vehicle Assembly Building: big white block, blue door stripes, flag band. */
function makeAssemblyBuilding() {
  const vab = new THREE.Group()
  const main = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, 1.1), mat('#eceff1'))
  main.position.y = 0.85
  const low = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 1.1), mat('#cfd8dc')) // low bay
  low.position.set(0.95, 0.35, 0)
  vab.add(main, low)
  // tall doors on the front face
  ;[-0.3, 0.3].forEach((doorX) => {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.45, 0.02), mat('#37474f'))
    door.position.set(doorX, 0.76, 0.56)
    vab.add(door)
  })
  // flag band (red/white/blue) near the top corner
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.02), mat('#1565c0'))
  flag.position.set(-0.42, 1.4, 0.56)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.025), mat('#c62828'))
  stripe.position.set(-0.42, 1.36, 0.56)
  vab.add(flag, stripe)
  return vab
}

/**
 * A whole launch site, built with +Y up and returned wrapped so it stands upright on the
 * globe (the globe's object layer points +Z away from the surface).
 */
function makeLaunchSiteModel({ siteId, active }) {
  const site = new THREE.Group()

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.08, 32), mat('#90a4ae'))
  pad.position.y = 0.04
  site.add(pad)

  // Selection ring (replaces the old yellow / white dot)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, active ? 0.09 : 0.05, 8, 48),
    new THREE.MeshBasicMaterial({ color: active ? '#ffeb3b' : '#ffffff' })
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.06
  site.add(ring)

  const tower = makeLaunchTower()
  tower.position.set(0.15, 0.08, 0)
  const rocket = makeRocketModel()
  rocket.position.set(0.75, 0.08, 0)
  rocket.scale.setScalar(0.9)
  site.add(tower, rocket)

  if (SITES_WITH_ASSEMBLY_BUILDING.has(siteId)) {
    const vab = makeAssemblyBuilding()
    vab.position.set(-1.9, 0, 0.3)
    // concrete apron + crawlerway from the building to the pad
    const road = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.22), mat('#b0bec5'))
    road.position.set(-1.0, 0.02, 0.1)
    site.add(vab, road)
  }

  site.scale.setScalar(SITE_MODEL_SCALE)
  site.rotation.x = Math.PI / 2 // +Y up → globe's +Z "away from the surface"

  const wrapper = new THREE.Group()
  wrapper.add(site)
  return wrapper
}

/** Satellite: gold-foil body, two solar wings, antenna dish (dish faces −Y, i.e. towards Earth). */
function makeSatelliteModel() {
  const sat = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.7), mat('#d4a017', { emissive: '#3a2a00' }))
  sat.add(body)
  const panelMat = mat('#1a3d8f', { emissive: '#0a1a40', side: THREE.DoubleSide })
  const frameMat = mat('#b0bec5')
  ;[-1, 1].forEach((side) => {
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), frameMat)
    boom.position.x = side * 0.55
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.75), panelMat)
    panel.position.x = side * 1.55
    sat.add(boom, panel)
  })
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.6),
    mat('#ffffff', { side: THREE.DoubleSide })
  )
  dish.rotation.x = Math.PI // bowl opens downward, towards Earth
  dish.position.y = -0.55
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), frameMat)
  feed.position.y = -0.55
  sat.add(dish, feed)
  return sat
}

/** Dispose every geometry/material in a model. */
function disposeModel(obj) {
  obj.traverse((part) => {
    part.geometry?.dispose()
    if (Array.isArray(part.material)) part.material.forEach((material) => material.dispose())
    else part.material?.dispose()
  })
}

function makeStarField(radius, count = 4000) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  const tints = [
    [1, 1, 1],
    [0.75, 0.85, 1],
    [1, 0.93, 0.8],
  ]

  for (let starIndex = 0; starIndex < count; starIndex++) {
    const heightFraction = Math.random() * 2 - 1
    const theta = Math.random() * Math.PI * 2
    const starDistance = radius * (1 + Math.random() * 0.3)
    const ringRadius = Math.sqrt(1 - heightFraction * heightFraction)

    positions.set(
      [
        starDistance * ringRadius * Math.cos(theta),
        starDistance * heightFraction,
        starDistance * ringRadius * Math.sin(theta),
      ],
      starIndex * 3
    )

    const brightness =
      0.35 + Math.random() ** 3 * 0.65

    const tint =
      tints[Math.floor(Math.random() * tints.length)]

    colors.set(
      tint.map((channel) => channel * brightness),
      starIndex * 3
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
  const inclination =
    (inclinationDeg * Math.PI) / 180

  const raan =
    (raanDeg * Math.PI) / 180

  const planeX = Math.cos(theta)
  const planeY = Math.sin(theta) * Math.cos(inclination)
  const planeZ = Math.sin(theta) * Math.sin(inclination)

  const xr =
    planeX * Math.cos(raan) -
    planeY * Math.sin(raan)

  const yr =
    planeX * Math.sin(raan) +
    planeY * Math.cos(raan)

  return {
    lat:
      (Math.asin(planeZ) * 180) / Math.PI,

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

  for (let step = 0; step <= steps; step++) {
    pts.push(
      orbitPosition({
        altKm,
        inclinationDeg,
        raanDeg,
        theta:
          (step / steps) * 2 * Math.PI,
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
  const globeRadius = globe.getGlobeRadius()

  const radius = km =>
    globeRadius * (1 + altFrac(km))

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
    ([lat, lng, altKm], index) => {
      const scenePoint =
        globe.getCoords(
          lat,
          lng,
          altFrac(altKm)
        )

      arr.set([scenePoint.x, scenePoint.y, scenePoint.z], index * 3)
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
  const siteVector = {
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
   * siteVector × v gives the normal vector to the orbital plane.
   */
  const orbitNormal = {
    x:
      siteVector.y * velocity.z -
      siteVector.z * velocity.y,

    y:
      siteVector.z * velocity.x -
      siteVector.x * velocity.z,

    z:
      siteVector.x * velocity.y -
      siteVector.y * velocity.x,
  }

  const hMagnitude =
    Math.sqrt(
      orbitNormal.x * orbitNormal.x +
      orbitNormal.y * orbitNormal.y +
      orbitNormal.z * orbitNormal.z
    )

  const inclinationRad =
    Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          orbitNormal.z / hMagnitude
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
      orbitNormal.x,
      -orbitNormal.y
    )

  if (raanRad < 0) {
    raanRad += 2 * Math.PI
  }

  const raanDeg =
    (raanRad * 180) / Math.PI

  /*
   * Basis vectors of the orbital plane.
   *
   * nodeVector points toward the ascending node.
   * perpVector is 90° further around the orbital plane.
   */
  const nodeVector = {
    x: Math.cos(raanRad),
    y: Math.sin(raanRad),
    z: 0,
  }

  const perpVector = {
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
    siteVector.x * nodeVector.x +
    siteVector.y * nodeVector.y +
    siteVector.z * nodeVector.z

  const qDotR =
    siteVector.x * perpVector.x +
    siteVector.y * perpVector.y +
    siteVector.z * perpVector.z

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

  const azimuthOffset =
    Number.isFinite(parsedAzimuth)
      ? parsedAzimuth
      : 0

  /*
   * The backend returns azimuth as a signed offset from the launch
   * direction, not as a compass bearing. Retrograde inclinations use
   * the opposite launch hemisphere, so convert them to the bearing
   * expected by the local north/east basis before deriving the plane.
   */
  const azimuth =
    targetInclinationDeg > 90
      ? 180 - azimuthOffset
      : azimuthOffset

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
    let step = 0;
    step <= steps;
    step++
  ) {
    const progressFraction =
      step / steps

    /*
     * Smoothstep makes the altitude transition start and
     * finish smoothly.
     */
    const smoothT =
      progressFraction * progressFraction * (3 - 2 * progressFraction)

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
    if (step === 0) {
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

  // null | {status:'checking'} | {status:'error', message} | {status:'done', ...result}
  const [collision, setCollision] =
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
      position: livePosition,
      track: liveTrack,
    } = issData.current

    // ISS toggle: when hidden, keep polling but draw nothing
    const issOn = shellsVisibleRef.current?.iss ?? true
    const position = issOn ? livePosition : null
    const track = issOn ? liveTrack : []
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

  // Any change to the Mission Inputs changes this key
  const draftKey = JSON.stringify([
    draftParams?.siteId,
    draftParams?.orbit,
    Number(draftParams?.inclinationDeg),
    Number(draftParams?.altitudeKm),
    Number(draftParams?.days),
  ])

  // The inputs the current `mission` was calculated with (recorded when a result arrives).
  // While the inputs differ from this, the path / orbit / model are reset and hidden.
  const missionDraftKeyRef = useRef(null)
  useEffect(() => {
    missionDraftKeyRef.current = mission ? draftKey : null
  }, [mission]) // eslint-disable-line react-hooks/exhaustive-deps

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
      ).forEach((shellGroup) => {
        globe.scene().remove(shellGroup)

        shellGroup.traverse((part) => {
          part.geometry?.dispose()
          part.material?.dispose()
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

  // ISS toggle: redraw the ISS layers right away (no camera move)
  useEffect(() => {
    applyLayers()
  }, [shellsVisible.iss])

  // Static drawing: ascent path, target orbit, launch-site markers.
  // Depends only on the site and target orbit, never on the selected launch window.
  useEffect(() => {
    const globe = globeInstance.current
    if (!globe) return

    const activeTargetBase =
      (
        draftParams?.siteId &&
        LAUNCH_SITES.find(
          (site) =>
            site.id ===
            draftParams.siteId
        )
      ) ||
      targetBase ||
      mission?.launchSite ||
      LAUNCH_SITES[0]

    // Launch sites are always drawn as miniature 3D models (objects layer),
    // whether or not a mission has been calculated
    const siteModels = LAUNCH_SITES.map((launchSite) => ({
      id: launchSite.id,
      type: 'site',
      name: `${launchSite.name} (click to select)`,
      lat: launchSite.lat,
      lng: launchSite.lon,
      alt: 0.001,
      active: launchSite.id === activeTargetBase.id,
    }))

    const selectSite = (siteIdClicked) => {
      const clickedSite = LAUNCH_SITES.find(site => site.id === siteIdClicked)
      if (!clickedSite) return
      setTargetBase(clickedSite)
      onTargetBaseChangeRef.current?.(clickedSite)
      onLaunchSiteClickRef.current?.(clickedSite)
      // Fly there now, and remember it so the camera effect doesn't fly there again
      lastViewedSiteRef.current = clickedSite.id
      globe.pointOfView({ lat: clickedSite.lat, lng: clickedSite.lon }, 2000)
    }

    globe
      .objectLat(item => item.lat)
      .objectLng(item => item.lng)
      .objectAltitude(item => item.alt)
      .objectLabel(item => item.name)
      .objectThreeObject(item =>
        item.type === 'iss'
          ? makeIssObject()
          : item.type === 'site'
            ? makeLaunchSiteModel({ siteId: item.id, active: item.active })
            : new THREE.Mesh(
                new THREE.SphereGeometry(1, 16, 16),
                new THREE.MeshBasicMaterial({ color: item.color })
              )
      )
      .onObjectClick((obj) => {
        if (obj?.type === 'iss') onIssClickRef.current?.()
        if (obj?.type === 'site') selectSite(obj.id)
      })
      .onObjectHover((obj) => {
        if (globeRef.current) globeRef.current.style.cursor = obj?.type === 'iss' || obj?.type === 'site' ? 'pointer' : ''
      })

    // RESET: draw no ascent path, target orbit or entry point unless there's a calculated
    // mission AND the Mission Inputs still match what it was calculated with.
    // (Any change to the inputs also stops the simulation; see pages/MissionControl.jsx.)
    const stale = !mission || missionDraftKeyRef.current !== draftKey
    if (
      stale ||
      !Number.isFinite(targetAltitude) ||
      targetAltitude <= 0 ||
      !Number.isFinite(targetInclination) ||
      !Number.isFinite(ascentAzimuth)
    ) {
      flightRef.current = { ascent: [], endTheta: 0, altKm: 0, inclinationDeg: 0, raanDeg: 0 }
      setEntry(null)
      globe.pointsData([])
      missionLayers.current = { paths: [], objects: siteModels }
      applyLayers()
      return
    }

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
        path => path.pts
      )
      .pathPointLat(
        point => point.lat
      )
      .pathPointLng(
        point => point.lng
      )
      .pathPointAlt(
        point => point.alt
      )
      .pathColor(
        path => path.color
      )
      .pathStroke(
        path => path.stroke
      )
      .pathDashLength(
        path =>
          path.dashLength ?? 1
      )
      .pathDashGap(
        path =>
          path.dashGap ?? 0
      )
      .pathDashAnimateTime(
        path =>
          path.dashAnimateTime ?? 0
      )
      .pathTransitionDuration(0)
      .pathResolution(1)

    const markers = []

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
        marker => marker.lat
      )
      .pointLng(
        marker => marker.lng
      )
      .pointAltitude(
        marker => marker.alt
      )
      .pointLabel(
        marker => marker.name
      )
      .pointRadius(
        marker =>
          marker.type ===
          'launchsite-interactive'
            ? 1.5
            : marker.type ===
              'launchsite-selected'
              ? 1.0
              : 0.5
      )
      .pointColor(
        marker => marker.color
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
        item => item.lat
      )
      .objectLng(
        item => item.lng
      )
      .objectAltitude(
        item => item.alt
      )
      .objectLabel(
        item => item.name
      )
      .objectThreeObject(
        item =>
          new THREE.Mesh(
            new THREE.SphereGeometry(
              1,
              16,
              16
            ),
            new THREE.MeshBasicMaterial(
              {
                color:
                  item.color,
              }
            )
          )
      )

    missionLayers.current = { paths, objects: [intersectionPoint, ...siteModels] }
    globe
      .objectThreeObject(item =>
        item.type === 'iss'
          ? makeIssObject()
          : item.type === 'site'
            ? makeLaunchSiteModel({ siteId: item.id, active: item.active })
            : new THREE.Mesh(
                new THREE.SphereGeometry(1, 16, 16),
                new THREE.MeshBasicMaterial({ color: item.color })
              )
      )
      .onObjectClick((obj) => {
        if (obj?.type === 'iss') onIssClickRef.current?.()
        if (obj?.type === 'site') selectSite(obj.id)
      })
      .onObjectHover((obj) => {
        if (globeRef.current) globeRef.current.style.cursor = obj?.type === 'iss' || obj?.type === 'site' ? 'pointer' : ''
      })

    applyLayers()
  }, [
    siteId,
    targetInclination,
    targetAltitude,
    ascentAzimuth,
    draftParams?.siteId,
    targetBase,
    mission,
    draftKey,
  ])

  // Camera: only moves when launch site changes.
  useEffect(() => {
    const globe =
      globeInstance.current

    const site =
      LAUNCH_SITES.find(
        site => site.id === siteId
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
        point =>
          globe.getCoords(
            point.lat,
            point.lng,
            point.alt
          )
      )

    // ROCKET (3D model with a flickering flame; tilts to follow its path)
    const rocket = makeRocketModel({ withFlame: true })
    rocket.scale.setScalar(1.6)
    const flame = rocket.getObjectByName('flame')
    const UP = new THREE.Vector3(0, 1, 0)
    const heading = new THREE.Vector3()
    const targetQuat = new THREE.Quaternion()

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
    const satellite = flight.altKm > 0 ? makeSatelliteModel() : null
    if (satellite) satellite.scale.setScalar(1.3)

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

    // CAMERA FOLLOW (chase cam): the camera follows the rocket / satellite and looks AT it.
    //   • scroll wheel: zooms towards / away from it and keeps following
    //   • click or drag: stops following and gives you the normal globe controls back
    // While following, the globe's own orbit controls are paused: every frame they would
    // otherwise point the camera back at Earth's centre and push it an Earth-radius away.
    // Angles are in degrees, distances in globe units (Earth radius = 100).
    //
    //   distance   how far the camera sits from the object
    //   pitch      how high above the object's local horizon (0 = level, 90 = straight down)
    //   yaw        how far round to the side of the object's direction of travel
    //   lookBlend  tilt the aim from the object towards Earth's centre (0–1; 0 = look at the object)
    //   centerLook true = the object is locked to the exact centre of the screen
    //              (the aim point follows it instantly; only the camera position is eased)
    //   smoothingMs how lazily the camera position catches up (lower = tighter)
    const CHASE = {
      // Ascent: chase cam behind the rocket, a bit above and to the side (unchanged)
      ascent: { distance: 22, pitch: 20, yaw: 15 },
      // Orbit: starts exactly like the ascent view (so nothing jumps when the rocket reaches
      // orbit), then slowly rises and pulls back into a high, angled top-down view, with the
      // satellite locked to the centre of the screen the whole time.
      orbit: {
        start: { distance: 22, pitch: 20, yaw: 15, lookBlend: 0, centerLook: true, smoothingMs: 150 },
        end: { distance: 150, pitch: 60, yaw: 90, lookBlend: 0, centerLook: true, smoothingMs: 150 },
        zoomOutFraction: 0.2, // how much of one orbit the pull-back takes (0.2 = a fifth)
      },
    }
    // Blend between two camera setups; blend goes 0 → 1
    const lerpView = (fromView, toView, blend) => ({
      distance: fromView.distance + (toView.distance - fromView.distance) * blend,
      pitch: fromView.pitch + (toView.pitch - fromView.pitch) * blend,
      yaw: fromView.yaw + (toView.yaw - fromView.yaw) * blend,
      lookBlend: fromView.lookBlend + (toView.lookBlend - fromView.lookBlend) * blend,
      smoothingMs: (fromView.smoothingMs ?? 350) + ((toView.smoothingMs ?? 350) - (fromView.smoothingMs ?? 350)) * blend,
      centerLook: fromView.centerLook || toView.centerLook,
    })
    const FOLLOW_SMOOTHING_MS = 350 // default for views that don't set smoothingMs
    const UP_SMOOTHING_MS = 500 // how gently the screen's "up" direction turns to match the satellite's local up
    const ZOOM_LIMITS = { min: 6, max: 400 } // scroll-zoom range while following
    const camera = globe.camera()
    const originalCameraUp = camera.up.clone() // restored when following ends
    const controls = globe.controls()
    const originalControlsUpdate = controls.update
    controls.update = () => false // paused while following (restored on click or when the simulation ends)
    const originalEnableZoom = controls.enableZoom
    controls.enableZoom = false // our own scroll-zoom below; stops the controls saving up a zoom jump

    const lookTarget = new THREE.Vector3() // the point the camera aims at
    const up = new THREE.Vector3()
    const fwd = new THREE.Vector3()
    const side = new THREE.Vector3()
    const offset = new THREE.Vector3()
    const desired = new THREE.Vector3()
    let following = true
    let zoomFactor = 1 // scroll-wheel multiplier on the chase distance

    const restoreControls = () => {
      if (controls.update !== originalControlsUpdate) controls.update = originalControlsUpdate
      controls.enableZoom = originalEnableZoom
      camera.up.copy(originalCameraUp)
    }
    const viewEl = globeRef.current
    const stopFollowing = () => {
      following = false
      restoreControls() // the same click/drag now works on the globe as usual
    }
    const onWheel = (event) => {
      if (!following) return
      zoomFactor *= event.deltaY > 0 ? 1.12 : 1 / 1.12
    }
    viewEl?.addEventListener('pointerdown', stopFollowing)
    viewEl?.addEventListener('wheel', onWheel, { passive: true })

    // position: the object's scene position; direction: roughly where it's heading
    const globeRadius = globe.getGlobeRadius()
    const earthCentre = new THREE.Vector3(0, 0, 0)

    const followCamera = (position, direction, view, dtMs) => {
      if (!following) return
      const easeFraction = 1 - Math.exp(-dtMs / (view.smoothingMs ?? FOLLOW_SMOOTHING_MS)) // fraction of the gap to close this frame

      // Overview: camera straight out above the satellite, looking at Earth's centre,
      // so the satellite sits in the middle with the whole planet behind it
      if (view.overview) {
        const distance = THREE.MathUtils.clamp(
          globeRadius * (1 + view.altitude) * zoomFactor,
          globeRadius * 1.15,
          globeRadius * 8
        )
        desired.copy(position).normalize().multiplyScalar(distance)
        camera.position.lerp(desired, easeFraction)
        lookTarget.lerp(earthCentre, easeFraction)
        camera.lookAt(lookTarget)
        return
      }

      // Local frame at the object: up = away from Earth, fwd = direction of travel along the surface
      up.copy(position).normalize()
      fwd.copy(direction).addScaledVector(up, -direction.dot(up))
      if (fwd.lengthSq() < 1e-9) return
      fwd.normalize()
      side.crossVectors(fwd, up).normalize()

      // Locked-on views: turn the camera's own "up" to the object's local up (away from Earth),
      // so a steep, high view stays stable (no flipping) with its direction of travel pointing
      // up the screen
      if (view.centerLook) {
        const kUp = 1 - Math.exp(-dtMs / UP_SMOOTHING_MS)
        camera.up.lerp(up, kUp).normalize()
      }

      const pitch = THREE.MathUtils.degToRad(view.pitch)
      const yaw = THREE.MathUtils.degToRad(view.yaw)
      // behind (−fwd), swung sideways by yaw, raised by pitch
      offset
        .copy(fwd).multiplyScalar(-Math.cos(yaw))
        .addScaledVector(side, Math.sin(yaw))
        .multiplyScalar(Math.cos(pitch))
        .addScaledVector(up, Math.sin(pitch))
        .normalize()

      const distance = THREE.MathUtils.clamp(view.distance * zoomFactor, ZOOM_LIMITS.min, ZOOM_LIMITS.max)
      desired.copy(position).addScaledVector(offset, distance)
      camera.position.lerp(desired, easeFraction)

      // Aim at the object, or partway from it towards Earth's centre (keeps the planet in frame)
      const aim = desired.copy(position).multiplyScalar(1 - (view.lookBlend ?? 0))
      if (view.centerLook) {
        // Locked on: no easing on the aim, so the object stays dead centre however fast it moves
        lookTarget.copy(aim)
      } else {
        lookTarget.lerp(aim, easeFraction)
      }
      camera.lookAt(lookTarget)
    }
    const ascentDirection = new THREE.Vector3(
      coords[coords.length - 1].x - coords[0].x,
      coords[coords.length - 1].y - coords[0].y,
      coords[coords.length - 1].z - coords[0].z
    )
    const orbitDirection = new THREE.Vector3()

    const tick = () => {
      const now =
        performance.now()

      const dt =
        now - last

      last = now

      simMs +=
        dt *
        timeScaleRef.current

      // Capped frame time for camera / rotation easing (a single slow frame shouldn't make it lurch)
      const camDt = Math.min(dt, 50)

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

        const exactIndex =
          progress *
          (coords.length - 1)

        const pointIndex =
          Math.min(
            Math.floor(exactIndex),
            coords.length - 1
          )

        const segmentFraction =
          exactIndex - pointIndex

        const fromPoint =
          coords[pointIndex]

        const toPoint =
          coords[
            Math.min(
              pointIndex + 1,
              coords.length - 1
            )
          ]

        const rocketX =
          fromPoint.x +
          (toPoint.x - fromPoint.x) *
            segmentFraction

        const rocketY =
          fromPoint.y +
          (toPoint.y - fromPoint.y) *
            segmentFraction

        const rocketZ =
          fromPoint.z +
          (toPoint.z - fromPoint.z) *
            segmentFraction

        rocket.position.set(
          rocketX,
          rocketY,
          rocketZ
        )
        // Point the nose along the direction of travel (straight up at liftoff)
        const lookAhead = coords[Math.min(pointIndex + 4, coords.length - 1)]
        heading.set(lookAhead.x - rocketX, lookAhead.y - rocketY, lookAhead.z - rocketZ)
        if (heading.lengthSq() > 1e-9) {
          targetQuat.setFromUnitVectors(UP, heading.normalize())
          rocket.quaternion.slerp(targetQuat, Math.min(1, camDt / 120)) // ease the turn
        }
        if (flame) flame.scale.set(1, 0.8 + Math.random() * 0.5, 1) // flicker
        followCamera(rocket.position, ascentDirection, CHASE.ascent, camDt)

        // Update trail.
        const pos =
          trailGeom
            .attributes
            .position

        for (
          let trailIndex = 0;
          trailIndex <= pointIndex;
          trailIndex++
        ) {
          pos.setXYZ(
            trailIndex,
            coords[trailIndex].x,
            coords[trailIndex].y,
            coords[trailIndex].z
          )
        }

        pos.setXYZ(
          Math.min(
            pointIndex + 1,
            coords.length - 1
          ),
          rocketX,
          rocketY,
          rocketZ
        )

        pos.needsUpdate = true

        trailGeom.setDrawRange(
          0,
          Math.min(
            pointIndex + 2,
            coords.length
          )
        )

        // Enter orbit.
        if (
          progress >= 1
        ) {
          ascentDone = true
          zoomFactor = 1 // fresh zoom for the orbit view

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
        // Keep the dish pointing at Earth
        satellite.quaternion.setFromUnitVectors(UP, satellite.position.clone().normalize())
        // Heading = towards a point a little further along the orbit (exact, so the camera doesn't shake)
        const ahead = orbitPosition({
          altKm: flight.altKm,
          inclinationDeg: flight.inclinationDeg,
          raanDeg: flight.raanDeg,
          theta: theta + 0.02,
        })
        const aheadCoords = globe.getCoords(ahead.lat, ahead.lng, ahead.alt)
        orbitDirection.set(aheadCoords.x, aheadCoords.y, aheadCoords.z).sub(satellite.position)
        // Slow pull-back over the first `zoomOutFraction` of an orbit (eased in and out)
        const orbitFraction = (omega * orbitTime) / (2 * Math.PI)
        const zoomT = Math.min(1, orbitFraction / CHASE.orbit.zoomOutFraction)
        const zoomS = zoomT * zoomT * (3 - 2 * zoomT)
        followCamera(satellite.position, orbitDirection, lerpView(CHASE.orbit.start, CHASE.orbit.end, zoomS), camDt)

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
      viewEl?.removeEventListener('pointerdown', stopFollowing)
      viewEl?.removeEventListener('wheel', onWheel)
      // Hand the normal globe controls back, centred on the Earth again
      restoreControls()
      controls.target.set(0, 0, 0)

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

      disposeModel(rocket)

      trailGeom.dispose()
      trail.material.dispose()

      if (satellite) disposeModel(satellite)

      if (landingMarker) {
        landingMarker.geometry.dispose()
        landingMarker.material.dispose()
      }
    }
  }, [simulation])

  // When Simulate is pressed, check the ascent path against the debris catalog
  useEffect(() => {
    if (!simulation) {
      setCollision(null)
      return
    }
    const ascent = flightRef.current.ascent
    if (!ascent || ascent.length < 2) return

    const win = windows?.find(launchWindow => launchWindow.id === selectedId) ?? windows?.[0]
    const start = win ? new Date(win.opensAt) : new Date()

    // ascent points store altitude as a fraction of Earth's radius, so convert back to km
    const points = ascent.map((point, index) => ({
      t_sec: (index / (ascent.length - 1)) * ASCENT_SEC,
      lat: point.lat,
      lon: point.lng,
      alt_km: (point.alt / ALT_SCALE) * EARTH_R,
    }))
    const API_URL = import.meta.env.VITE_API_URL || ''

    const url = `${API_URL}/api/debris`
    const ctrl = new AbortController()
    setCollision({ status: 'checking' })
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: start.toISOString(), points, radius_km: DEBRIS_RADIUS_KM }),
      signal: ctrl.signal,
    })
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(`path check failed: ${response.status}`))))
      .then(data => setCollision({ status: 'done', ...data }))
      .catch(err => {
        if (err.name !== 'AbortError') setCollision({ status: 'error', message: err.message })
      })

    return () => ctrl.abort()
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
          .catch((error) =>
            console.warn(
              'ISS position unavailable:',
              error.message
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
          .catch((error) =>
            console.warn(
              'ISS track unavailable:',
              error.message
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
        launchWindow => launchWindow.id === selectedId
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
    const API_URL = import.meta.env.VITE_API_URL || ''

    fetch(
      `${API_URL}/api/debris?${qs}`,
      {
        signal:
          ctrl.signal,
      }
    )
      .then(response =>
        response.ok
          ? response.json()
          : Promise.reject(
              new Error(
                `debris request failed: ${response.status}`
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
          debrisObject => [
            debrisObject.lat,
            debrisObject.lon,
            debrisObject.alt_km,
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
        part => {
          part.geometry?.dispose()
          part.material?.dispose()
        }
      )
    }
  }, [
    debris,
    shellsVisible.debris,
  ])

  // Status banner for the Simulate debris check
  const banner = (() => {
    if (!collision) return null
    if (collision.status === 'checking') return { color: '#90a4ae', text: 'Checking ascent path for debris…' }
    if (collision.status === 'error') return { color: '#ffb74d', text: 'Debris check unavailable', detail: collision.message }
    const closest = collision.closest
    const detail = closest ? `Closest: ${closest.name} · ${closest.distance_km} km at T+${Math.round(closest.t_sec)} s` : ''
    return collision.clear
      ? { color: '#4caf50', text: `Clear: nothing within ${collision.radius_km} km of the ascent path`, detail }
      : { color: '#ff1744', text: `Warning: ${collision.conflict_count} object(s) within ${collision.radius_km} km`, detail }
  })()

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
      {banner && (
        <div
          style={{
            position: 'fixed', top: 68, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
            padding: '8px 14px', borderRadius: 8, background: 'rgba(10,12,20,0.88)',
            border: `1px solid ${banner.color}`, color: '#fff', fontSize: 13,
            textAlign: 'center', pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 600, color: banner.color }}>{banner.text}</div>
          {banner.detail && <div style={{ opacity: 0.8, fontSize: 12 }}>{banner.detail}</div>}
        </div>
      )}
    </div>
  )
}