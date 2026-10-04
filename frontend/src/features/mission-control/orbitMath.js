/*
 * Orbit maths shared by the globe and the launch simulation.
 * Globe units: Earth's radius = 100; altitudes are passed to globe.gl as a
 * fraction of Earth's radius (altFrac).
 */
import { SECO_SEC, upperStageState, ascentDownrangeRad } from './flightProfile.js'

export const EARTH_R = 6371 // km
export const ALT_SCALE = 1
export const altFrac = (km) => (km / EARTH_R) * ALT_SCALE

const MU_KM3_S2 = 398600.4418 // Earth's gravitational parameter

/** Time for one full orbit at this altitude, in seconds. */
export const orbitPeriodSec = (altKm) =>
  2 * Math.PI * Math.sqrt(Math.pow(EARTH_R + altKm, 3) / MU_KM3_S2)

/*
 * Convert an orbital-plane angle into a globe position.
 *
 * theta is measured inside the orbital plane.
 *
 * RAAN rotates the orbital plane around Earth's Z axis.
 */
export function orbitPosition({
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

export function orbitPoints({
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
export function getLaunchOrbitGeometry(
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
 * The rocket's climb to orbit, sampled over time.
 *
 * Every point lies in the target orbit's plane (worked out from the launch site and
 * launch azimuth), so the climb flows straight into the orbit. Altitude and downrange
 * distance follow the flight profile in flightProfile.js: a vertical liftoff, a gravity
 * turn, first-stage burn to ~70 km, then the second stage builds speed and levels off
 * at the target altitude.
 *
 * Returns { ascent: [{lat, lng, alt, tSec}], endTheta, raanDeg, inclinationDeg, launchTheta }
 */
export function getAscent(base, targetInclinationDeg, targetAltitudeKm, azimuthDeg = 90, steps = 90) {
  if (!base) {
    return { ascent: [], endTheta: 0, raanDeg: 0, inclinationDeg: targetInclinationDeg, launchTheta: 0 }
  }

  const launchLat = Number(base.lat) || 0
  const launchLng = Number(base.lon ?? base.lng) || 0
  const parsedAzimuth = Number(azimuthDeg)
  const azimuthOffset = Number.isFinite(parsedAzimuth) ? parsedAzimuth : 0

  // The backend sends the azimuth as an offset; retrograde orbits launch towards the
  // opposite hemisphere, so convert to a compass bearing first.
  const azimuth = targetInclinationDeg > 90 ? 180 - azimuthOffset : azimuthOffset

  const { raanDeg, launchTheta, inclinationDeg } = getLaunchOrbitGeometry(launchLat, launchLng, azimuth)

  const ascent = []
  for (let step = 0; step <= steps; step++) {
    const tSec = (step / steps) * SECO_SEC
    if (step === 0) {
      // Start exactly on the pad
      ascent.push({ lat: launchLat, lng: launchLng, alt: 0, tSec })
      continue
    }
    const { altKm, downrangeRad } = upperStageState(tSec, targetAltitudeKm)
    ascent.push({
      ...orbitPosition({ altKm, inclinationDeg, raanDeg, theta: launchTheta + downrangeRad }),
      tSec,
    })
  }

  return {
    ascent,
    endTheta: launchTheta + ascentDownrangeRad(targetAltitudeKm),
    raanDeg,
    inclinationDeg,
    launchTheta,
  }
}
