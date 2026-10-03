// Launch sites + orbit presets used by the Mission Inputs panel.
// The backend should use the same site ids (see /HANDOFF.md).

export const LAUNCH_SITES = [
  {
    id: 'nova-scotia',
    name: 'Spaceport Nova Scotia',
    region: 'Canso, NS, Canada',
    lat: 45.3031, // 45°18'11" N
    lon: -60.9828, // 60°58'58" W
    // No public pad camera exists yet, so show live weather over the site (Windy.com embed)
    liveFeed: {
      title: 'Live weather · Spaceport Nova Scotia',
      embedUrl:
        'https://embed.windy.com/embed2.html?lat=45.303&lon=-60.983&detailLat=45.303&detailLon=-60.983' +
        '&zoom=7&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now' +
        '&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1',
    },
  },
  {
    id: 'cape-canaveral',
    name: 'Cape Canaveral SLC-40',
    region: 'Florida, USA',
    lat: 28.5618,
    lon: -80.577,
    // Live feed shown top-right when this site is clicked on the globe
    // (YouTube: Launch Pad Live, SpaceX Falcon Heavy, Falcon 9 and Starship at Cape Canaveral)
    liveFeed: {
      title: 'Launch Pad Live · Cape Canaveral',
      embedUrl: 'https://www.youtube.com/embed/thfYPsRqxmw?autoplay=1&mute=1&playsinline=1&rel=0',
    },
  },
]

// Inclination + altitude per orbit type. Each preset uses the midpoint of its range
// as the default values when the user picks that orbit.
export const ORBIT_PRESETS = {
  LEO: { inclinationDeg: 45.1, altitudeKm: 500, hint: '~45.1°' },
  Polar: { inclinationDeg: 90, altitudeKm: 700, hint: '87.9° – 90°' },
  SSO: { inclinationDeg: 98.1, altitudeKm: 700, hint: '~98.1°' },
}

export const DEFAULT_PARAMS = {
  siteId: 'nova-scotia',
  orbit: 'SSO', // Spaceport Nova Scotia is built for SSO / polar launches (LEO 45.1° is below its latitude)
  inclinationDeg: ORBIT_PRESETS.SSO.inclinationDeg,
  altitudeKm: ORBIT_PRESETS.SSO.altitudeKm,
  days: 7,
}

export const getSite = (id) => LAUNCH_SITES.find((s) => s.id === id)

/**
 * A rocket launched straight east/west can't reach an orbit inclined LESS than the
 * launch site's latitude without an extra (expensive) plane-change "dog-leg".
 * Retrograde orbits are mirrored, so 180° − inclination is checked too.
 */
export function isDirectlyReachable(inclinationDeg, siteLat) {
  const i = Math.min(inclinationDeg, 180 - inclinationDeg)
  return i >= Math.abs(siteLat)
}
