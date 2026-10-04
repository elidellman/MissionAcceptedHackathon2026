/*
 * The launch animation (runs while a simulation is active).
 *
 * Everything on screen is worked out from the simulation time `clock.simMs`, so the
 * timeline can pause it, change its speed or jump to any moment (forwards or backwards).
 *
 * What happens (times in flightProfile.js):
 *   liftoff → Max-Q → MECO → stage separation → second-stage ignition → fairing jettison
 *   → booster flies home (landing zone), out to a drone ship, or falls away (not reusable)
 *   → SECO: orbit reached → satellite deployed → satellite carries on around its orbit
 *
 * Camera: a chase cam follows the rocket (then the satellite), or the booster if
 * clock.follow === 'booster'. Scrolling zooms; clicking the globe stops following
 * (clock.follow becomes null) until the timeline's camera buttons turn it back on.
 */
import * as THREE from 'three'
import { orbitPosition, orbitPeriodSec } from './orbitMath.js'
import {
  makeBoosterModel,
  makeUpperStageModel,
  makeSatelliteModel,
  makeDroneShipModel,
  makeLandingPadModel,
  setLegsDeployed,
  placeOnSurface,
  setOpacity,
  disposeModel,
  STACK_OFFSET,
} from './models3d.js'
import {
  STAGE_SEP_SEC,
  SES_SEC,
  FAIRING_SEC,
  SECO_SEC,
  DEPLOY_SEC,
  LEGS_DEPLOY_BEFORE_SEC,
  upperStageState,
  boosterEndSec,
  boosterEngineOn,
  smoothstep,
} from './flightProfile.js'
import { boosterPosition, boosterPath, boosterLandingPoint, landingTypeOf } from './boosterPath.js'

// Flying vehicles are drawn smaller than the pad models: the real flight path is only a
// globe unit or two high when the stages separate, so big models would hide it.
const ROCKET_SCALE = 0.55
const UP = new THREE.Vector3(0, 1, 0)

// Chase-cam setups. Angles in degrees, distances in globe units (Earth radius = 100).
//   distance  how far the camera sits from the object
//   pitch     how high above the object's local horizon (0 = level, 90 = straight down)
//   yaw       how far round to the side of its direction of travel
//   centerLook  lock the object to the exact centre of the screen
//   smoothingMs how lazily the camera catches up (lower = tighter)
const CHASE = {
  ascent: { distance: 7, pitch: 32, yaw: 40 },
  booster: { distance: 6, pitch: 18, yaw: -35 },
  landed: { distance: 6, pitch: 50, yaw: -35 },
  orbit: {
    start: { distance: 7, pitch: 32, yaw: 40, centerLook: true, smoothingMs: 150 },
    end: { distance: 150, pitch: 60, yaw: 90, centerLook: true, smoothingMs: 150 },
    zoomOutFraction: 0.2, // share of one orbit the slow pull-back takes
  },
}
const FOLLOW_SMOOTHING_MS = 350
const UP_SMOOTHING_MS = 500
const ZOOM_LIMITS = { min: 2, max: 400 }

const lerpView = (fromView, toView, blend) => ({
  distance: fromView.distance + (toView.distance - fromView.distance) * blend,
  pitch: fromView.pitch + (toView.pitch - fromView.pitch) * blend,
  yaw: fromView.yaw + (toView.yaw - fromView.yaw) * blend,
  smoothingMs: (fromView.smoothingMs ?? 350) + ((toView.smoothingMs ?? 350) - (fromView.smoothingMs ?? 350)) * blend,
  centerLook: fromView.centerLook || toView.centerLook,
})

/** A line that grows along a list of points (the trail behind the rocket / booster). */
function makeTrail(points, color) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((points.length + 1) * 3), 3))
  geometry.setDrawRange(0, 0)
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }))
  line.frustumCulled = false
  line.renderOrder = 10
  return line
}

/** Draw the trail up to time t: every sample before t, then the object's current position. */
function updateTrail(trail, sampleCoords, sampleTimes, t, current) {
  const positions = trail.geometry.attributes.position
  let count = 0
  while (count < sampleTimes.length && sampleTimes[count] <= t) {
    positions.setXYZ(count, sampleCoords[count].x, sampleCoords[count].y, sampleCoords[count].z)
    count++
  }
  if (count > 0 && current) {
    positions.setXYZ(count, current.x, current.y, current.z)
    count++
  }
  positions.needsUpdate = true
  trail.geometry.setDrawRange(0, count)
}

/**
 * Start the animation. Returns a function that stops it and removes everything.
 *
 *   flight: { ascent, launchTheta, endTheta, raanDeg, inclinationDeg, altKm }
 *   site:   the launch site from launchConfig.js (its `landing` decides the booster recovery)
 *   clock:  shared, mutable { simMs, follow } (also read by the timeline)
 *   getTimeScale(), isPlaying(): current speed and play/pause state
 */
export function startLaunchSimulation({ globe, viewEl, flight, site, clock, getTimeScale, isPlaying }) {
  const scene = globe.scene()
  const toScene = ({ lat, lng, alt }) => {
    const { x, y, z } = globe.getCoords(lat, lng, alt)
    return new THREE.Vector3(x, y, z)
  }

  const landingType = landingTypeOf(site)
  const boosterEnd = boosterEndSec(landingType)
  const omega = (2 * Math.PI) / orbitPeriodSec(flight.altKm) // orbit speed, radians per second

  // ── Where things are at time t ─────────────────────────────────────
  const upperStagePoint = (t) => {
    if (t <= SECO_SEC) {
      const { altKm, downrangeRad } = upperStageState(t, flight.altKm)
      if (t <= 0) return { lat: Number(site.lat), lng: Number(site.lon), alt: 0 }
      return orbitPosition({ altKm, inclinationDeg: flight.inclinationDeg, raanDeg: flight.raanDeg, theta: flight.launchTheta + downrangeRad })
    }
    return orbitPosition({
      altKm: flight.altKm,
      inclinationDeg: flight.inclinationDeg,
      raanDeg: flight.raanDeg,
      theta: flight.endTheta + omega * (t - SECO_SEC),
    })
  }
  // After release the satellite drifts slowly ahead of the spent second stage
  const satellitePoint = (t) => {
    const lead = Math.min(0.02, 0.00025 * Math.max(0, t - DEPLOY_SEC))
    return orbitPosition({
      altKm: flight.altKm,
      inclinationDeg: flight.inclinationDeg,
      raanDeg: flight.raanDeg,
      theta: flight.endTheta + omega * (t - SECO_SEC) + lead,
    })
  }
  const boosterPoint = (t) => boosterPosition(Math.min(t, boosterEnd), flight, site)

  // ── Models ─────────────────────────────────────────────────────────
  const booster = makeBoosterModel()
  const upper = makeUpperStageModel()
  const satellite = makeSatelliteModel()
  booster.scale.setScalar(ROCKET_SCALE)
  upper.scale.setScalar(ROCKET_SCALE)
  const boosterFlame = booster.getObjectByName('flame')
  const upperFlame = upper.getObjectByName('flame')
  const fairings = [upper.getObjectByName('fairingLeft'), upper.getObjectByName('fairingRight')]

  // Landing zone / drone ship (or nothing, for boosters that aren't recovered)
  const landingPoint = boosterLandingPoint(flight, site)
  let landingModel = null
  // A landing zone right beside the launch pad (like Landing Zone 40) uses the pad's own apron
  const padDistanceDeg = Math.hypot(landingPoint.lat - Number(site.lat), landingPoint.lng - Number(site.lon))
  if (landingPoint.type === 'pad' && padDistanceDeg > 0.05) landingModel = makeLandingPadModel()
  if (landingPoint.type === 'ship') landingModel = makeDroneShipModel()
  if (landingModel) {
    landingModel.scale.setScalar(0.6)
    placeOnSurface(landingModel, globe, landingPoint.lat, landingPoint.lng, 0.0005)
    landingModel.visible = false
  }
  const deckAltitude = landingPoint.type === 'ship' ? 0.0013 : 0.0006 // booster stands on the deck / pad

  // Trails
  const ascentCoords = flight.ascent.map(toScene)
  const ascentTimes = flight.ascent.map((point) => point.tSec)
  const boosterSamples = boosterPath(flight, site)
  const boosterCoords = boosterSamples.map(toScene)
  const boosterTimes = boosterSamples.map((point) => point.tSec)
  const ascentTrail = makeTrail(ascentCoords, '#ff9800')
  const boosterTrail = makeTrail(boosterCoords, '#4fc3f7')

  const sceneObjects = [booster, upper, satellite, ascentTrail, boosterTrail, ...(landingModel ? [landingModel] : [])]
  scene.add(...sceneObjects)

  // ── Camera follow ──────────────────────────────────────────────────
  const camera = globe.camera()
  const controls = globe.controls()
  const originalCameraUp = camera.up.clone()
  const originalControlsUpdate = controls.update
  const originalEnableZoom = controls.enableZoom
  let engaged = false
  let zoomFactor = 1
  let lastFollow = clock.follow

  const engage = () => {
    if (engaged) return
    engaged = true
    controls.update = () => false // the globe's own controls would keep yanking the camera back
    controls.enableZoom = false // we zoom ourselves while following
  }
  const release = () => {
    if (!engaged) return
    engaged = false
    controls.update = originalControlsUpdate
    controls.enableZoom = originalEnableZoom
    camera.up.copy(originalCameraUp)
  }
  if (clock.follow) engage()

  const stopFollowing = () => {
    clock.follow = null
    release()
  }
  const onWheel = (event) => {
    if (engaged) zoomFactor *= event.deltaY > 0 ? 1.12 : 1 / 1.12
  }
  viewEl?.addEventListener('pointerdown', stopFollowing)
  viewEl?.addEventListener('wheel', onWheel, { passive: true })

  const lookTarget = new THREE.Vector3()
  const localUp = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const side = new THREE.Vector3()
  const offset = new THREE.Vector3()
  const desired = new THREE.Vector3()

  const followCamera = (position, direction, view, dtMs) => {
    const easeFraction = 1 - Math.exp(-dtMs / (view.smoothingMs ?? FOLLOW_SMOOTHING_MS))
    localUp.copy(position).normalize()
    forward.copy(direction).addScaledVector(localUp, -direction.dot(localUp))
    if (forward.lengthSq() < 1e-9) forward.set(1, 0, 0).addScaledVector(localUp, -localUp.x)
    forward.normalize()
    side.crossVectors(forward, localUp).normalize()

    if (view.centerLook) camera.up.lerp(localUp, 1 - Math.exp(-dtMs / UP_SMOOTHING_MS)).normalize()

    const pitch = THREE.MathUtils.degToRad(view.pitch)
    const yaw = THREE.MathUtils.degToRad(view.yaw)
    offset
      .copy(forward).multiplyScalar(-Math.cos(yaw))
      .addScaledVector(side, Math.sin(yaw))
      .multiplyScalar(Math.cos(pitch))
      .addScaledVector(localUp, Math.sin(pitch))
      .normalize()
    const distance = THREE.MathUtils.clamp(view.distance * zoomFactor, ZOOM_LIMITS.min, ZOOM_LIMITS.max)
    desired.copy(position).addScaledVector(offset, distance)
    camera.position.lerp(desired, easeFraction)
    if (view.centerLook) lookTarget.copy(position)
    else lookTarget.lerp(position, easeFraction)
    camera.lookAt(lookTarget)
  }

  // ── Orientation helpers ────────────────────────────────────────────
  const targetQuat = new THREE.Quaternion()
  const direction = new THREE.Vector3()
  const pointAlong = (object, fromVec, toVec, turnFraction) => {
    direction.subVectors(toVec, fromVec)
    if (direction.lengthSq() < 1e-12) return
    targetQuat.setFromUnitVectors(UP, direction.normalize())
    if (turnFraction >= 1) object.quaternion.copy(targetQuat)
    else object.quaternion.slerp(targetQuat, turnFraction)
  }
  const standUpright = (object) => object.quaternion.setFromUnitVectors(UP, object.position.clone().normalize())
  const flicker = (flame) => flame.scale.set(1, 0.8 + Math.random() * 0.5, 1)

  // ── Frame loop ─────────────────────────────────────────────────────
  let lastFrame = performance.now()
  let lastT = null
  let frameId = null
  const boosterNoseOffset = new THREE.Vector3()

  const tick = () => {
    const now = performance.now()
    const dt = now - lastFrame
    lastFrame = now
    // A single slow frame shouldn't make the camera lurch, but on the very first frame jump
    // straight to the rocket instead of gliding in from wherever the camera was
    const camDt = lastT === null ? 1e6 : Math.min(dt, 50)
    if (isPlaying()) clock.simMs = Math.max(0, clock.simMs + dt * getTimeScale())
    const t = clock.simMs / 1000
    const jumped = lastT === null || Math.abs(t - lastT) > 15 // seeking: snap instead of easing
    lastT = t
    const turn = jumped ? 1 : Math.min(1, camDt / 120)

    // Follow on/off from the timeline buttons
    if (clock.follow !== lastFollow) {
      lastFollow = clock.follow
      zoomFactor = 1
      if (clock.follow) engage()
      else release()
    }

    // Upper stage (on top of the booster until separation)
    const upperPos = toScene(upperStagePoint(t))
    const upperAhead = toScene(upperStagePoint(t + 2))
    upper.position.copy(upperPos)
    pointAlong(upper, upperPos, upperAhead, turn)
    upper.visible = t < DEPLOY_SEC + 90
    setOpacity(upper, t > DEPLOY_SEC + 30 ? Math.max(0, 1 - (t - DEPLOY_SEC - 30) / 60) : 1)
    upperFlame.visible = t >= SES_SEC && t < SECO_SEC
    if (upperFlame.visible) flicker(upperFlame)

    // Fairing halves peel away and tumble off, fading out
    fairings.forEach((half) => {
      const since = t - FAIRING_SEC
      half.visible = since < 25
      if (since <= 0) {
        half.position.set(0, 0, 0)
        half.rotation.set(0, 0, 0)
        setOpacity(half, 1)
      } else {
        const sideSign = half.userData.side
        half.position.set(sideSign * since * 0.06, -since * since * 0.004, 0)
        half.rotation.set(0, 0, -sideSign * Math.min(1.2, since * 0.12))
        setOpacity(half, Math.max(0, 1 - since / 25))
      }
    })

    // Booster
    if (t < STAGE_SEP_SEC) {
      // Still stacked: the booster sits directly below the upper stage
      boosterNoseOffset.copy(UP).applyQuaternion(upper.quaternion).multiplyScalar(-STACK_OFFSET * ROCKET_SCALE)
      booster.position.copy(upperPos).add(boosterNoseOffset)
      booster.quaternion.copy(upper.quaternion)
      booster.visible = true
    } else {
      const sinceSep = t - STAGE_SEP_SEC
      const pathPos = toScene(boosterPoint(t))
      // Ease out of the stacked position over the first 10 s so nothing jumps at separation
      const stackedBlend = 1 - smoothstep(sinceSep / 10)
      boosterNoseOffset.copy(UP).applyQuaternion(booster.quaternion).multiplyScalar(-STACK_OFFSET * ROCKET_SCALE * stackedBlend)
      booster.position.copy(pathPos).add(boosterNoseOffset)

      if (t >= boosterEnd && landingType) {
        // Touched down: standing on the pad / deck
        const rest = boosterPoint(boosterEnd)
        booster.position.copy(toScene({ ...rest, alt: deckAltitude }))
        standUpright(booster)
      } else {
        const ahead = toScene(boosterPoint(t + 2))
        // Coasts nose-first for a few seconds, then flips and flies engines-first
        if (sinceSep < 8) pointAlong(booster, pathPos, ahead, turn)
        else pointAlong(booster, ahead, pathPos, jumped ? 1 : Math.min(1, camDt / 400))
      }
      booster.visible = landingType ? true : t < boosterEnd
    }
    boosterFlame.visible = booster.visible && boosterEngineOn(t, landingType) && t < boosterEnd
    if (boosterFlame.visible) flicker(boosterFlame)
    const legsAmount = landingType ? smoothstep((t - (boosterEnd - LEGS_DEPLOY_BEFORE_SEC)) / 4) : 0
    setLegsDeployed(booster, legsAmount)
    if (landingModel) landingModel.visible = t >= STAGE_SEP_SEC - 30

    // Satellite: inside the fairing, then on top of the stage, then released into its orbit
    satellite.visible = t >= FAIRING_SEC
    if (t < DEPLOY_SEC) {
      satellite.scale.setScalar(0.18)
      const top = new THREE.Vector3(0, 1.05 * ROCKET_SCALE, 0).applyQuaternion(upper.quaternion)
      satellite.position.copy(upperPos).add(top)
      satellite.quaternion.copy(upper.quaternion)
    } else {
      satellite.scale.setScalar(0.18 + 0.42 * smoothstep((t - DEPLOY_SEC) / 6))
      satellite.position.copy(toScene(satellitePoint(t)))
      standUpright(satellite) // dish towards Earth
    }

    // Trails
    updateTrail(ascentTrail, ascentCoords, ascentTimes, Math.min(t, SECO_SEC), t <= SECO_SEC ? upperPos : null)
    boosterTrail.visible = t >= STAGE_SEP_SEC
    updateTrail(boosterTrail, boosterCoords, boosterTimes, Math.min(t, boosterEnd), t < boosterEnd ? booster.position : null)

    // Camera
    if (engaged) {
      if (clock.follow === 'booster' && t >= STAGE_SEP_SEC && booster.visible) {
        const landed = landingType && t >= boosterEnd
        const view = landed ? CHASE.landed : CHASE.booster
        const travel = landed ? direction.set(1, 0, 0) : toScene(boosterPoint(t + 2)).sub(booster.position)
        followCamera(booster.position, travel, view, camDt)
      } else if (t < SECO_SEC) {
        followCamera(upperPos, upperAhead.clone().sub(upperPos), CHASE.ascent, camDt)
      } else {
        const target = t >= DEPLOY_SEC ? satellite.position : upperPos
        const orbitFraction = (omega * (t - SECO_SEC)) / (2 * Math.PI)
        const zoomBlend = smoothstep(orbitFraction / CHASE.orbit.zoomOutFraction)
        const travel = toScene(satellitePoint(t + 20)).sub(target)
        followCamera(target, travel, lerpView(CHASE.orbit.start, CHASE.orbit.end, zoomBlend), camDt)
      }
    }

    frameId = requestAnimationFrame(tick)
  }
  frameId = requestAnimationFrame(tick)

  return () => {
    if (frameId !== null) cancelAnimationFrame(frameId)
    viewEl?.removeEventListener('pointerdown', stopFollowing)
    viewEl?.removeEventListener('wheel', onWheel)
    release()
    controls.target.set(0, 0, 0) // hand the normal globe controls back, centred on Earth
    scene.remove(...sceneObjects)
    ;[booster, upper, satellite, ...(landingModel ? [landingModel] : [])].forEach(disposeModel)
    ;[ascentTrail, boosterTrail].forEach((trail) => {
      trail.geometry.dispose()
      trail.material.dispose()
    })
  }
}
