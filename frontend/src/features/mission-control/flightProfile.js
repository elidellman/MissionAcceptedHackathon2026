/*
 * Flight profile: when each mission event happens, and how high / how far downrange
 * the rocket is at any moment. Times are seconds after liftoff (T+).
 *
 * Loosely modelled on a Falcon 9 flight to low Earth orbit. It's a visual model for
 * the simulation, not a trajectory solver.
 */

export const EARTH_R_KM = 6371

// ── Event times (s) ───────────────────────────────────────────────
export const MAX_Q_SEC = 72 // maximum aerodynamic pressure
export const MECO_SEC = 150 // first-stage engines cut off
export const STAGE_SEP_SEC = 153 // first and second stage separate
export const SES_SEC = 160 // second-stage engine starts
export const FAIRING_SEC = 195 // nose-cone halves jettisoned (out of the atmosphere)
export const SECO_SEC = 540 // second-stage engine cut off: in orbit
export const DEPLOY_SEC = 600 // satellite released

// Booster recovery
export const BOOSTBACK_START_SEC = 165 // flip + burn back towards the launch site (landing-pad recoveries only)
export const BOOSTBACK_END_SEC = 215
export const ENTRY_BURN_START_SEC = 385 // slows down before hitting the thick atmosphere
export const ENTRY_BURN_END_SEC = 405
export const PAD_LANDING_SEC = 480 // touchdown at a landing zone on land
export const SHIP_LANDING_SEC = 515 // touchdown on a drone ship at sea
export const LANDING_BURN_SEC = 30 // the final burn lasts this long before touchdown
export const EXPENDED_IMPACT_SEC = 430 // non-reusable booster hits the ground / sea
export const LEGS_DEPLOY_BEFORE_SEC = 12 // landing legs open this long before touchdown

// How long the launch section of the timeline lasts (the rest of the bar is the first orbit)
export const LAUNCH_PHASE_END_SEC = 720

// ── Shape of the climb ────────────────────────────────────────────
export const MECO_ALT_KM = 70 // altitude at first-stage cut-off
const SHIP_RANGE_KM = 600 // drone ship sits this far beyond the separation point
const EXPENDED_RANGE_KM = 450

/** Total downrange angle (radians) from the pad to where the second stage reaches orbit. */
export function ascentDownrangeRad(targetAltKm) {
  return (1500 + 0.8 * targetAltKm) / EARTH_R_KM
}

/**
 * Where the rocket (the upper stage after separation) is at time t, up to orbit insertion.
 * Returns { altKm, downrangeRad }.
 *  - altitude: slow at first, ~70 km at MECO, then rises and levels off at the target
 *  - downrange: almost none during the vertical climb, then speeds up (gravity turn)
 */
export function upperStageState(t, targetAltKm) {
  const time = Math.max(0, Math.min(SECO_SEC, t))
  const mecoAlt = Math.min(MECO_ALT_KM, targetAltKm * 0.6)
  let altKm
  if (time <= MECO_SEC) {
    altKm = mecoAlt * Math.pow(time / MECO_SEC, 1.8)
  } else {
    const fraction = (time - MECO_SEC) / (SECO_SEC - MECO_SEC)
    altKm = mecoAlt + (targetAltKm - mecoAlt) * (1 - Math.pow(1 - fraction, 1.3))
  }
  const downrangeRad = ascentDownrangeRad(targetAltKm) * Math.pow(time / SECO_SEC, 2.3)
  return { altKm, downrangeRad }
}

/** When the booster touches down (or crashes, if it isn't reusable) for this landing type. */
export function boosterEndSec(landingType) {
  if (landingType === 'pad') return PAD_LANDING_SEC
  if (landingType === 'ship') return SHIP_LANDING_SEC
  return EXPENDED_IMPACT_SEC
}

/**
 * Booster after separation, as a fraction-based description the path builder turns into
 * positions. Returns { altKm, progress } where progress is:
 *  - 'pad': fraction of the way from the separation point to the landing zone
 *           (briefly negative while it coasts on downrange before the boostback burn)
 *  - otherwise: extra downrange angle (radians) beyond the separation point
 */
export function boosterState(t, landingType, separationAltKm) {
  const endSec = boosterEndSec(landingType)
  const fraction = Math.max(0, Math.min(1, (t - STAGE_SEP_SEC) / (endSec - STAGE_SEP_SEC)))

  if (landingType === 'pad') {
    // Coasts on a little, then flies back and lands next to the pad
    const progress =
      fraction < 0.2
        ? -0.12 * Math.sin((fraction / 0.2) * (Math.PI / 2))
        : -0.12 + 1.12 * smoothstep((fraction - 0.2) / 0.8)
    const altKm = Math.max(0, separationAltKm * (1 - fraction) + 260 * fraction * (1 - fraction))
    return { altKm, progress }
  }

  const rangeKm = landingType === 'ship' ? SHIP_RANGE_KM : EXPENDED_RANGE_KM
  // Ballistic arc out to sea; horizontal speed bleeds off so the end is near-vertical
  const progress = (rangeKm / EARTH_R_KM) * (1 - Math.pow(1 - fraction, 1.6))
  const altKm = Math.max(0, separationAltKm * (1 - fraction) + 300 * fraction * (1 - fraction))
  return { altKm, progress }
}

/** True while the booster's engines are firing at time t. */
export function boosterEngineOn(t, landingType) {
  if (t < STAGE_SEP_SEC) return true // still part of the full stack
  if (!landingType) return false // expended: no relight
  const endSec = boosterEndSec(landingType)
  if (landingType === 'pad' && t >= BOOSTBACK_START_SEC && t <= BOOSTBACK_END_SEC) return true
  if (t >= ENTRY_BURN_START_SEC && t <= ENTRY_BURN_END_SEC) return true
  return t >= endSec - LANDING_BURN_SEC && t < endSec
}

export const smoothstep = (value) => {
  const clamped = Math.max(0, Math.min(1, value))
  return clamped * clamped * (3 - 2 * clamped)
}

/**
 * The events shown on the timeline, in order. `landingType` is the site's booster
 * recovery: 'pad', 'ship' or null (not recovered).
 */
export function flightEvents(landingType) {
  const events = [
    { t: 0, key: 'liftoff', label: 'Liftoff' },
    { t: MAX_Q_SEC, key: 'maxq', label: 'Max-Q' },
    { t: MECO_SEC, key: 'meco', label: 'Main engine cut-off' },
    { t: STAGE_SEP_SEC, key: 'sep', label: 'Stage separation' },
    { t: SES_SEC, key: 'ses', label: 'Second-stage ignition' },
    { t: FAIRING_SEC, key: 'fairing', label: 'Fairing jettison' },
  ]
  if (landingType === 'pad') {
    events.push({ t: BOOSTBACK_START_SEC, key: 'boostback', label: 'Boostback burn', booster: true })
  }
  if (landingType) {
    events.push({ t: ENTRY_BURN_START_SEC, key: 'entry', label: 'Entry burn', booster: true })
    events.push({
      t: boosterEndSec(landingType),
      key: 'landing',
      label: landingType === 'pad' ? 'Booster landing' : 'Drone-ship landing',
      booster: true,
    })
  } else {
    events.push({ t: EXPENDED_IMPACT_SEC, key: 'impact', label: 'Booster splashdown (not recovered)', booster: true })
  }
  events.push({ t: SECO_SEC, key: 'seco', label: 'Orbit reached (SECO)' })
  events.push({ t: DEPLOY_SEC, key: 'deploy', label: 'Satellite deployed' })
  return events.sort((first, second) => first.t - second.t)
}

/** The most recent event at time t (for the "current phase" label). */
export function currentEvent(events, t) {
  let latest = events[0]
  for (const event of events) if (event.t <= t) latest = event
  return latest
}
