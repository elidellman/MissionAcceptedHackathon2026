/*
 * Where the first-stage booster goes after separation.
 *
 *  'pad'  → coasts on briefly, flips, burns back and lands at the site's landing zone
 *  'ship' → follows a ballistic arc out to sea and lands on a drone ship
 *  null   → not reusable: falls into the sea / steppe and is lost
 *
 * `flight` is the launch geometry from getAscent plus altKm:
 *   { launchTheta, raanDeg, inclinationDeg, altKm }
 */
import { altFrac, orbitPosition } from './orbitMath.js'
import { STAGE_SEP_SEC, boosterEndSec, boosterState, upperStageState } from './flightProfile.js'

const DEG = Math.PI / 180

const toVector = (lat, lng) => [
  Math.cos(lat * DEG) * Math.cos(lng * DEG),
  Math.cos(lat * DEG) * Math.sin(lng * DEG),
  Math.sin(lat * DEG),
]

const fromVector = ([vx, vy, vz]) => {
  const length = Math.hypot(vx, vy, vz)
  return { lat: Math.asin(vz / length) / DEG, lng: Math.atan2(vy, vx) / DEG }
}

/** Great-circle interpolation between two surface points (fraction may go below 0 or above 1). */
function slerpSurface(from, to, fraction) {
  const fromVec = toVector(from.lat, from.lng)
  const toVec = toVector(to.lat, to.lng)
  const dot = Math.max(-1, Math.min(1, fromVec[0] * toVec[0] + fromVec[1] * toVec[1] + fromVec[2] * toVec[2]))
  const angle = Math.acos(dot)
  if (angle < 1e-9) return from
  const weightFrom = Math.sin((1 - fraction) * angle) / Math.sin(angle)
  const weightTo = Math.sin(fraction * angle) / Math.sin(angle)
  return fromVector(fromVec.map((value, axis) => weightFrom * value + weightTo * toVec[axis]))
}

/** The site's recovery type: 'pad', 'ship' or null. */
export const landingTypeOf = (site) => site?.landing?.type ?? null

function separationState(flight) {
  const { altKm, downrangeRad } = upperStageState(STAGE_SEP_SEC, flight.altKm)
  const surface = orbitPosition({
    altKm: 0,
    inclinationDeg: flight.inclinationDeg,
    raanDeg: flight.raanDeg,
    theta: flight.launchTheta + downrangeRad,
  })
  return { altKm, downrangeRad, surface }
}

/** Booster position at time t (≥ separation) as { lat, lng, alt } for globe.getCoords. */
export function boosterPosition(t, flight, site) {
  const landingType = landingTypeOf(site)
  const separation = separationState(flight)
  const { altKm, progress } = boosterState(t, landingType, separation.altKm)

  if (landingType === 'pad') {
    const landing = { lat: site.landing.lat, lng: site.landing.lon }
    const point = slerpSurface(separation.surface, landing, progress)
    return { lat: point.lat, lng: point.lng, alt: altFrac(altKm) }
  }

  return orbitPosition({
    altKm,
    inclinationDeg: flight.inclinationDeg,
    raanDeg: flight.raanDeg,
    theta: flight.launchTheta + separation.downrangeRad + progress,
  })
}

/** Where the booster ends up: { type, lat, lng, name } (type null = lost at sea / on land). */
export function boosterLandingPoint(flight, site) {
  const landingType = landingTypeOf(site)
  const end = boosterPosition(boosterEndSec(landingType), flight, site)
  if (landingType === 'pad') {
    return { type: 'pad', lat: site.landing.lat, lng: site.landing.lon, name: site.landing.name }
  }
  return { type: landingType, lat: end.lat, lng: end.lng, name: landingType === 'ship' ? 'Drone ship' : 'Impact area' }
}

/** The booster's whole return path, sampled over time: [{ lat, lng, alt, tSec }]. */
export function boosterPath(flight, site, steps = 80) {
  const endSec = boosterEndSec(landingTypeOf(site))
  const points = []
  for (let step = 0; step <= steps; step++) {
    const tSec = STAGE_SEP_SEC + (step / steps) * (endSec - STAGE_SEP_SEC)
    points.push({ ...boosterPosition(tSec, flight, site), tSec })
  }
  return points
}
