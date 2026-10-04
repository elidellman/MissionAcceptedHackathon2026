// Launch sites + orbit presets used by the Mission Inputs panel.
// The backend should use the same site ids (see /HANDOFF.md).

// Live weather map (Windy.com embed) for sites without a public pad camera
function windyFeed(name, lat, lon) {
  return {
    title: `Live weather · ${name}`,
    embedUrl:
      `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}` +
      '&zoom=7&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now' +
      '&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1',
  }
}

// `landing`: where a reusable first-stage booster comes down.
//   'pad'  = flies back to a landing zone on land (lat/lon given), like SpaceX at Cape Canaveral
//   'ship' = lands on a drone ship out at sea, downrange of the launch
export const LAUNCH_SITES = [
  {
    id: 'nova-scotia',
    name: 'Spaceport Nova Scotia',
    region: 'Canso, NS, Canada',
    lat: 45.3031, // 45°18'11" N
    lon: -60.9828, // 60°58'58" W
    landing: { type: 'ship' },
    // No public pad camera exists yet, so show live weather over the site (Windy.com embed)
    liveFeed: windyFeed('Spaceport Nova Scotia', 45.303, -60.983),
  },
  {
    id: 'cape-canaveral',
    name: 'Cape Canaveral SLC-40',
    region: 'Florida, USA',
    lat: 28.5618,
    lon: -80.577,
    landing: { type: 'pad', name: 'Landing Zone 40', lat: 28.5603, lon: -80.5741 },
    hasAssemblyBuilding: true,
    // Live feed shown top-right when this site is clicked on the globe
    // (YouTube: Launch Pad Live, SpaceX Falcon Heavy, Falcon 9 and Starship at Cape Canaveral)
    liveFeed: {
      title: 'Launch Pad Live · Cape Canaveral',
      embedUrl: 'https://www.youtube.com/embed/thfYPsRqxmw?autoplay=1&mute=1&playsinline=1&rel=0',
    },
  },
  {
    id: 'vandenberg',
    name: 'Vandenberg SLC-4E',
    region: 'California, USA',
    lat: 34.6321,
    lon: -120.6106,
    landing: { type: 'pad', name: 'Landing Zone 4', lat: 34.6332, lon: -120.6156 },
    liveFeed: windyFeed('Vandenberg', 34.632, -120.611),
  },
  {
    id: 'wallops',
    name: 'Wallops Pad 0A',
    region: 'Virginia, USA',
    lat: 37.8337,
    lon: -75.4881,
    landing: { type: 'ship' },
    liveFeed: windyFeed('Wallops', 37.834, -75.488),
  },
  {
    id: 'kourou',
    name: 'Guiana Space Centre',
    region: 'Kourou, French Guiana',
    lat: 5.239,
    lon: -52.768,
    landing: { type: 'ship' },
    hasAssemblyBuilding: true,
    liveFeed: windyFeed('Kourou', 5.239, -52.768),
  },
  {
    id: 'baikonur',
    name: 'Baikonur Cosmodrome',
    region: 'Kazakhstan',
    lat: 45.92,
    lon: 63.342,
    landing: null, // land-locked, boosters are expended over the steppe
    hasAssemblyBuilding: true,
    liveFeed: windyFeed('Baikonur', 45.92, 63.342),
  },
  {
    id: 'tanegashima',
    name: 'Tanegashima Space Center',
    region: 'Kagoshima, Japan',
    lat: 30.4,
    lon: 130.977,
    landing: null, // JAXA's H3 boosters are not recovered
    liveFeed: windyFeed('Tanegashima', 30.4, 130.977),
  },
  {
    id: 'starbase',
    name: 'SpaceX Starbase',
    region: 'Texas, USA',
    lat: 25.997,
    lon: -97.157,
    landing: { type: 'pad', name: 'Booster catch tower', lat: 25.9965, lon: -97.1555 },
    liveFeed: windyFeed('Starbase', 25.997, -97.157),
  },
]

// International Space Station: live position + orbit on the globe, live video when clicked
export const ISS = {
  id: 'iss',
  name: 'International Space Station',
  noradId: 25544, // used by the wheretheiss.at position API
  liveFeed: {
    title: 'ISS Live · NASA',
    // NASA's "Live High-Definition Views from the ISS". If NASA restarts the stream the id changes:
    // copy the new id from youtube.com/@NASA/live
    embedUrl: 'https://www.youtube.com/embed/awQzjn72bI0?autoplay=1&mute=1&playsinline=1&rel=0',
  },
}

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
