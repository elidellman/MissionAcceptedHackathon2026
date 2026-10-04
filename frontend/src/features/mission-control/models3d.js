/*
 * 3D models (three.js) for the globe: launch sites, rockets, satellite, ISS, stars,
 * plus the separate stages used by the launch simulation.
 * Sizes are in globe units (Earth radius = 100, so 1 unit ≈ 64 km): wildly oversized on
 * purpose so they're visible from orbit. Every model is built with +Y pointing "up".
 */
import * as THREE from 'three'
import { altFrac } from './orbitMath.js'
import { LAUNCH_SITES } from './launchConfig.js'

export function makeIssObject() {
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
export const SITE_MODEL_SCALE = 0.5 // make launch sites bigger/smaller here (kept small so launches aren't hidden)

export const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra })

/** Rocket: white body, black interstage, nose cone, four fins, engine bell, optional flame. */
export function makeRocketModel({ withFlame = false } = {}) {
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
export function makeLaunchTower() {
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
export function makeAssemblyBuilding() {
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
export function makeLaunchSiteModel({ siteId, active }) {
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

  if (LAUNCH_SITES.find((site) => site.id === siteId)?.hasAssemblyBuilding) {
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
export function makeSatelliteModel() {
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
export function disposeModel(obj) {
  obj.traverse((part) => {
    part.geometry?.dispose()
    if (Array.isArray(part.material)) part.material.forEach((material) => material.dispose())
    else part.material?.dispose()
  })
}

export function makeStarField(radius, count = 4000) {
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


export function orbitShell(
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
export function makePoints(
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


/* ── Launch simulation: separate stages ───────────────────────────────────────
 * The flying rocket is two models stacked on top of each other: the booster (first
 * stage) at the bottom and the upper stage (second stage + fairing + satellite) on top.
 * At stage separation they become independent objects.
 */
const BOOSTER_HEIGHT = 1.45 // the upper stage sits on top of this
const BODY_RADIUS = 0.2

function makeFlame(name, { radius = 0.18, length = 0.9, y = -0.45 } = {}) {
  const flame = new THREE.Group()
  flame.name = name
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(radius, length, 16),
    new THREE.MeshBasicMaterial({ color: '#ffb300', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  )
  outer.rotation.x = Math.PI // point down
  outer.position.y = y
  const core = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.5, length * 0.55, 12),
    new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
  )
  core.rotation.x = Math.PI
  core.position.y = y + length * 0.22
  flame.add(outer, core)
  return flame
}

/**
 * First stage: white body, black interstage, grid fins at the top, four landing legs
 * folded against the body (named 'leg0'..'leg3', swung open with setLegsDeployed) and a flame.
 */
export function makeBoosterModel() {
  const booster = new THREE.Group()
  const white = mat('#f4f4f4')
  const dark = mat('#222831')

  const body = new THREE.Mesh(new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, 1.25, 20), white)
  body.position.y = 0.2 + 0.625
  const interstage = new THREE.Mesh(new THREE.CylinderGeometry(BODY_RADIUS + 0.005, BODY_RADIUS + 0.005, 0.22, 20), dark)
  interstage.position.y = BOOSTER_HEIGHT - 0.11
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.19, 0.2, 16), dark)
  engine.position.y = 0.1
  booster.add(body, interstage, engine)

  for (let finIndex = 0; finIndex < 4; finIndex++) {
    const angle = (finIndex * Math.PI) / 2 + Math.PI / 4
    // grid fin near the top
    const gridFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.02), dark)
    gridFin.position.set(Math.cos(angle) * 0.27, BOOSTER_HEIGHT - 0.3, Math.sin(angle) * 0.27)
    gridFin.rotation.y = -angle + Math.PI / 2
    booster.add(gridFin)

    // landing leg: hinged at the bottom, folded up along the body until deployed
    const hinge = new THREE.Group()
    hinge.name = `leg${finIndex}`
    hinge.position.set(Math.cos(angle) * BODY_RADIUS, 0.18, Math.sin(angle) * BODY_RADIUS)
    hinge.rotation.y = -angle
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.6, 0.06), dark)
    leg.position.set(0.02, 0.3, 0) // hangs above the hinge (folded)
    hinge.add(leg)
    hinge.userData.angle = angle
    booster.add(hinge)
  }

  booster.add(makeFlame('flame'))
  return booster
}

/** Swing the booster's landing legs open (amount 0 = folded, 1 = fully deployed). */
export function setLegsDeployed(booster, amount) {
  for (let legIndex = 0; legIndex < 4; legIndex++) {
    const hinge = booster.getObjectByName(`leg${legIndex}`)
    if (hinge) hinge.rotation.z = -amount * 2.4 // folded up → swung down and out
  }
}

/**
 * Second stage: shorter white body, large dark vacuum nozzle, payload fairing made of two
 * halves ('fairingLeft' / 'fairingRight') and its own flame ('flame').
 * Built from y = 0 (bottom of the nozzle) upwards.
 */
export function makeUpperStageModel() {
  const upper = new THREE.Group()
  const white = mat('#f4f4f4')
  const dark = mat('#222831')

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.22, 16), dark)
  nozzle.position.y = 0.11
  const body = new THREE.Mesh(new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, 0.55, 20), white)
  body.position.y = 0.22 + 0.275
  upper.add(nozzle, body)

  // Fairing: a cylinder + nose cone, split into two halves that peel away
  ;['fairingLeft', 'fairingRight'].forEach((name, halfIndex) => {
    const half = new THREE.Group()
    half.name = name
    const thetaStart = halfIndex * Math.PI
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(BODY_RADIUS + 0.03, BODY_RADIUS + 0.03, 0.45, 20, 1, false, thetaStart, Math.PI),
      mat('#f4f4f4', { side: THREE.DoubleSide })
    )
    shell.position.y = 0.77 + 0.225
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(BODY_RADIUS + 0.03, 0.42, 20, 1, false, thetaStart, Math.PI),
      mat('#f4f4f4', { side: THREE.DoubleSide })
    )
    nose.position.y = 0.77 + 0.45 + 0.21
    half.add(shell, nose)
    half.userData.side = halfIndex === 0 ? 1 : -1
    upper.add(half)
  })

  upper.add(makeFlame('flame', { radius: 0.15, length: 0.7, y: -0.35 }))
  return upper
}

/** Height of the booster model: where the upper stage sits in the stacked rocket. */
export const STACK_OFFSET = BOOSTER_HEIGHT

/** Autonomous drone ship: flat grey deck with a yellow landing target and two small towers. */
export function makeDroneShipModel() {
  const ship = new THREE.Group()
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 1.5), mat('#455a64'))
  deck.position.y = 0.09
  ship.add(deck)
  ;[[-1, 1], [1, 1]].forEach(([sideX]) => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.18), mat('#263238'))
    tower.position.set(sideX * 1.15, 0.38, 0.6)
    ship.add(tower)
  })
  addLandingTarget(ship, 0.185, 0.55)
  return ship
}

/** Landing zone on land: concrete circle with a yellow target. */
export function makeLandingPadModel() {
  const pad = new THREE.Group()
  const concrete = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.06, 32), mat('#90a4ae'))
  concrete.position.y = 0.03
  pad.add(concrete)
  addLandingTarget(pad, 0.065, 0.6)
  return pad
}

function addLandingTarget(parent, height, radius) {
  const yellow = new THREE.MeshBasicMaterial({ color: '#ffd600' })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.03, 6, 40), yellow)
  ring.rotation.x = Math.PI / 2
  ring.position.y = height
  parent.add(ring)
  ;[Math.PI / 4, -Math.PI / 4].forEach((angle) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.4, 0.01, 0.06), yellow)
    bar.rotation.y = angle
    bar.position.y = height
    parent.add(bar)
  })
}

const UP_AXIS = new THREE.Vector3(0, 1, 0)

/** Put a +Y-up model on the globe at lat/lng, standing upright on the surface. */
export function placeOnSurface(object, globe, lat, lng, altitude = 0) {
  const { x, y, z } = globe.getCoords(lat, lng, altitude)
  object.position.set(x, y, z)
  object.quaternion.setFromUnitVectors(UP_AXIS, object.position.clone().normalize())
}

/** Set an object's material opacity (for fading parts out). */
export function setOpacity(object, opacity) {
  object.traverse((part) => {
    if (!part.material) return
    const materials = Array.isArray(part.material) ? part.material : [part.material]
    materials.forEach((material) => {
      if (material.userData.baseOpacity == null) material.userData.baseOpacity = material.opacity
      material.transparent = true
      material.opacity = material.userData.baseOpacity * opacity
    })
  })
}
