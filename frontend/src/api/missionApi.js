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

// TODO(API): set to false once the Flask endpoints below exist.
// While true, the app uses fake data from mockData.js and never calls the backend.
export const USE_MOCK = true

export const ENDPOINTS = {
  test: '/api/test', //                                  exists today
  launchSites: '/api/launch-sites', //                   TODO(API)
  launchWindows: '/api/launch-windows', //               TODO(API)  ?site_id=&orbit=&inclination_deg=&altitude_km=&days=
  trajectory: (windowId) => `/api/launch-windows/${encodeURIComponent(windowId)}/trajectory`, // TODO(API)
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

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
export async function fetchLaunchWindows({ siteId, orbit, inclinationDeg, altitudeKm, days }) {
  const query = {
    site_id: siteId,
    orbit,
    inclination_deg: String(inclinationDeg),
    altitude_km: String(altitudeKm),
    days: String(days),
  }
  let data
  if (USE_MOCK) {
    await delay(300)
    data = mockLaunchWindowsResponse(query)
  } else {
    data = await getJson(`${ENDPOINTS.launchWindows}?${new URLSearchParams(query)}`)
  }
  return { mission: toMission(data.mission), windows: data.windows.map(toWindow) }
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

const toSite = (s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon })

const toMission = (m) => ({
  name: m.name,
  vehicle: m.vehicle,
  launchSite: toSite(m.launch_site),
  targetOrbit: m.target_orbit, // 'LEO' | 'Polar' | 'SSO'
  inclinationDeg: m.inclination_deg,
  altitudeKm: m.altitude_km,
})

const toWindow = (w) => ({
  id: w.id,
  opensAt: w.opens_at, // ISO 8601 UTC string
  durationMin: w.duration_min,
  weather: w.weather, // 'green' | 'yellow' | 'red'
})

const toPoint = (p) => ({ tSec: p.t_sec, lat: p.lat, lon: p.lon, altKm: p.alt_km })
