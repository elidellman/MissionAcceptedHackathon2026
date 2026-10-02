// PLACEHOLDER: fake backend responses.
// These are shaped EXACTLY like the real API responses (snake_case) and go through
// the same mappers in src/api/missionApi.js — so when USE_MOCK is switched off,
// nothing else in the frontend has to change.
// Delete this file once the backend is live (and remove its import from missionApi.js).

const inHours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString()

const CAPE = { id: 'cape-canaveral', name: 'Cape Canaveral SLC-40', lat: 28.5618, lon: -80.577 }

// PLACEHOLDER — GET /api/launch-sites
export const MOCK_LAUNCH_SITES = {
  sites: [
    CAPE,
    { id: 'vandenberg', name: 'Vandenberg SLC-4E', lat: 34.632, lon: -120.611 },
  ],
}

// PLACEHOLDER — GET /api/launch-windows?orbit=LEO&site_id=cape-canaveral
export const MOCK_LAUNCH_WINDOWS_RESPONSE = {
  mission: {
    name: 'Demo Mission',
    vehicle: 'Generic Medium-Lift',
    launch_site: CAPE,
    target_orbit: 'LEO',
    inclination_deg: 45.1,
  },
  windows: [
    { id: 'w1', opens_at: inHours(5.5), duration_min: 12, weather: 'green' },
    { id: 'w2', opens_at: inHours(29.2), duration_min: 9, weather: 'yellow' },
    { id: 'w3', opens_at: inHours(53.0), duration_min: 14, weather: 'red' },
  ],
}

// PLACEHOLDER — GET /api/launch-windows/<id>/trajectory
// A fake ascent: heads north-east from the pad and climbs to ~400 km over 10 minutes.
// Not physically accurate — just enough for the 3D scene to have a line to draw.
export function mockTrajectoryResponse(windowId) {
  const skew = { w1: 0, w2: 4, w3: -4 }[windowId] ?? 0
  const points = []
  for (let i = 0; i <= 60; i++) {
    const f = i / 60
    points.push({
      t_sec: i * 10,
      lat: CAPE.lat + f * (14 + skew),
      lon: CAPE.lon + f * 30,
      alt_km: 400 * Math.sin((f * Math.PI) / 2),
    })
  }
  return { window_id: windowId, points }
}
