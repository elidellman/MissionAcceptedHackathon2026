/**
 * missionApi.js — THE ONLY PLACE THE FRONTEND TALKS TO THE BACKEND.
 *
 * Backend team: every endpoint the frontend expects is listed in ENDPOINTS below,
 * and the exact JSON shapes are in /HANDOFF.md (repo root).
 * The backend returns snake_case JSON (Python style); the mappers at the bottom
 * convert it to camelCase for React. If you rename a field, update the mapper.
 *
 * Vite forwards every /api/* request to Flask on http://127.0.0.1:5000 (see vite.config.js).
 */
import {
  MOCK_LAUNCH_SITES,
  mockLaunchWindowsResponse,
  mockTrajectoryResponse,
} from '../features/mission-control/mockData.js'

// false = real Flask backend (run `flask --app flaskr run` in backend/).
// Set back to true to demo without the backend: the app then uses fake data from mockData.js.
export const USE_MOCK = false

export const ENDPOINTS = {
  test: '/api/test',
  launchSites: '/api/launch-sites',
  launchWindows: '/api/launch-windows', // ?site_id=&orbit=&inclination_deg=&altitude_km=&days=
  trajectory: (windowId) => `/api/launch-windows/${encodeURIComponent(windowId)}/trajectory`,
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.json()
}

// ── Public functions used by the pages ─────────────────────────────────────

/** GET /api/launch-sites → [{ id, name, lat, lon }] */
export async function fetchLaunchSites() {
  const data = USE_MOCK ? (await delay(150), MOCK_LAUNCH_SITES) : await getJson(ENDPOINTS.launchSites)
  return data.sites.map(toSite)
}

/**
 * GET /api/launch-windows?site_id=nova-scotia&orbit=LEO&inclination_deg=45.1&altitude_km=500&days=7
 * Params come from the Mission Inputs panel.
 * → { mission, windows }
 */
export async function fetchLaunchWindows({
  siteId,
  orbit,
  inclinationDeg,
  altitudeKm,
  days,
  raanDeg,
  vehicleDurationSec,
}) {
  const query = {
    site_id: siteId,
    orbit,
    inclination_deg: String(inclinationDeg),
    altitude_km: String(altitudeKm),
    days: String(days),
  }

  if (
    raanDeg !== null &&
    raanDeg !== undefined &&
    raanDeg !== ''
  ) {
    query.raan = String(raanDeg)
  }

  if (
    vehicleDurationSec !== null &&
    vehicleDurationSec !== undefined &&
    vehicleDurationSec !== ''
  ) {
    query.vehicle_duration = String(vehicleDurationSec)
  }

  let data

  if (USE_MOCK) {
    await delay(300)
    data = mockLaunchWindowsResponse(query)
  } else {
    data = await getJson(
      `${ENDPOINTS.launchWindows}?${new URLSearchParams(query)}`
    )
  }

  return {
    mission: toMission(data.mission),
    windows: data.windows.map(toWindow),
  }
}

/**
 * GET /api/launch-windows/<window_id>/trajectory
 * → [{ tSec, lat, lon, altKm }]  — the path the 3D scene draws.
 */
export async function fetchTrajectory(windowId) {
  const data = USE_MOCK
    ? (await delay(150), mockTrajectoryResponse(windowId))
    : await getJson(ENDPOINTS.trajectory(windowId))
  return data.points.map(toPoint)
}

// ── snake_case (backend) → camelCase (frontend) ────────────────────────────

const toSite = (site) => ({ id: site.id, name: site.name, lat: site.lat, lon: site.lon })

const toMission = (mission) => ({
  name: mission.name,
  vehicle: mission.vehicle,
  launchSite: toSite(mission.launch_site),
  targetOrbit: mission.target_orbit,
  inclinationDeg: mission.inclination_deg,
  altitudeKm: mission.altitude_km,
  azimuthDeg: mission.azimuth_deg,
  raanDeg: mission.raan_deg,
  vehicleDurationSec: mission.vehicle_duration_sec,
})

// Weather arrives either as a plain rating ('green' | 'yellow' | 'red') or as an object
// { rating, description }. The window cards always get the object form.
const WEATHER_TEXT = {
  green: 'Weather looks good for launch.',
  yellow: 'Marginal weather: check conditions before launch.',
  red: 'Weather rules out this window.',
  unknown: 'No forecast yet: forecasts only cover the next 16 days.',
}
const toWeather = (weather) =>
  typeof weather === 'string'
    ? { rating: weather, description: WEATHER_TEXT[weather] ?? 'Weather information unavailable.' }
    : weather ?? null

const toWindow = (launchWindow) => ({
  id: launchWindow.id,
  opensAt: launchWindow.opens_at,
  peakAt: launchWindow.peak_at,
  insertionAt: launchWindow.insertion_at,
  durationMin: launchWindow.duration_min,
  weather: toWeather(launchWindow.weather),
})

const toPoint = (point) => ({ tSec: point.t_sec, lat: point.lat, lon: point.lon, altKm: point.alt_km })
