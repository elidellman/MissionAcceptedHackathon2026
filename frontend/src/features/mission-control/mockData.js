// PLACEHOLDER: fake backend responses.
// These are shaped EXACTLY like the real API responses (snake_case) and go through
// the same mappers in src/api/missionApi.js, so when USE_MOCK is switched off
// nothing else in the frontend has to change.
// Delete this file once the backend is live (and remove its import from missionApi.js).
//
// NOTE: none of the numbers below are real orbital mechanics. They only change
// with the inputs so the UI and 3D scene have something believable to show.

import { LAUNCH_SITES } from './launchConfig.js'

const inHours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString()

// PLACEHOLDER: GET /api/launch-sites
export const MOCK_LAUNCH_SITES = {
  sites: LAUNCH_SITES.map(({ id, name, lat, lon }) => ({ id, name, lat, lon })),
}

const findSite = (id) => MOCK_LAUNCH_SITES.sites.find((s) => s.id === id) ?? MOCK_LAUNCH_SITES.sites[0]

// PLACEHOLDER: GET /api/launch-windows?site_id=&orbit=&inclination_deg=&altitude_km=&days=
export function mockLaunchWindowsResponse(q) {
  const site = findSite(q.site_id)
  const days = Number(q.days) || 7
  const incl = Number(q.inclination_deg)
  const weathers = ['green', 'yellow', 'green', 'red', 'green', 'yellow']

  // Roughly one window per day; offset changes with inclination so inputs visibly matter.
  const offset = 2 + ((incl * 7) % 20)
  const windows = []
  for (let d = 0; d < Math.min(days, 6); d++) {
    windows.push({
      id: `${site.id}-${q.orbit}-${d}`,
      opens_at: inHours(offset + d * 23.93),
      duration_min: 8 + ((d * 5 + Math.round(incl)) % 9),
      weather: weathers[d % weathers.length],
    })
  }

  return {
    mission: {
      name: `${q.orbit} mission`,
      vehicle: 'Generic Medium-Lift',
      launch_site: site,
      target_orbit: q.orbit,
      inclination_deg: incl,
      altitude_km: Number(q.altitude_km),
    },
    windows,
  }
}

// PLACEHOLDER: GET /api/launch-windows/<id>/trajectory
// Fake ascent from the pad toward the target inclination, climbing to ~altitude.
// Window ids look like "<site_id>-<orbit>-<n>" in the mock, so we can find the site again.
export function mockTrajectoryResponse(windowId) {
  const site = MOCK_LAUNCH_SITES.sites.find((s) => windowId.startsWith(s.id)) ?? MOCK_LAUNCH_SITES.sites[0]
  const orbit = windowId.split('-').at(-2)
  const heading = { LEO: 45, Polar: 180, SSO: 190 }[orbit] ?? 45 // degrees from north
  const h = (heading * Math.PI) / 180
  const points = []
  for (let i = 0; i <= 60; i++) {
    const f = i / 60
    points.push({
      t_sec: i * 10,
      lat: site.lat + f * 20 * Math.cos(h),
      lon: site.lon + f * 20 * Math.sin(h),
      alt_km: 500 * Math.sin((f * Math.PI) / 2),
    })
  }
  return { window_id: windowId, points }
}
