// Placeholder data so the Mission Control page has something to show
// before the backend / orbital engine is wired up.
// Replace with a fetch to the Flask API (e.g. GET /api/launch-windows) later —
// keep the same shape and the UI won't need to change.

const inHours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString()

export const MOCK_MISSION = {
  name: 'Demo Mission',
  vehicle: 'Generic Medium-Lift',
  launchSite: { name: 'Cape Canaveral SLC-40', lat: 28.5618, lon: -80.577 },
  targetOrbit: 'LEO', // 'LEO' | 'Polar' | 'SSO'
  inclinationDeg: 45.1,
}

export const MOCK_WINDOWS = [
  { id: 'w1', opensAt: inHours(5.5), durationMin: 12, weather: 'green' },
  { id: 'w2', opensAt: inHours(29.2), durationMin: 9, weather: 'yellow' },
  { id: 'w3', opensAt: inHours(53.0), durationMin: 14, weather: 'red' },
]
