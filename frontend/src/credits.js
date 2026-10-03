/**
 * Sources & credits for third-party content, shown on each page via <PageCredits ids={[...]} />.
 *
 * Anything marked '[add source]' is an image whose origin we haven't recorded yet:
 * replace `by` (and add `url`) before presenting, or swap the image for one you can credit.
 */
export const CREDITS = {
  // ── Mission Control ──────────────────────────────────────────────
  earthTexture: {
    what: 'Earth texture',
    by: 'NASA Visible Earth, Blue Marble Next Generation',
    url: 'https://visibleearth.nasa.gov/images/74518',
    license: 'public domain',
  },
  moonTexture: { what: 'Moon surface texture', by: '[add source]' },
  sunTexture: { what: 'Sun surface texture', by: '[add source]' },
  capeStream: {
    what: 'Cape Canaveral live feed',
    by: 'Spaceflight Now, "Launch Pad Live" (YouTube)',
    url: 'https://www.youtube.com/watch?v=thfYPsRqxmw',
    license: 'embedded via YouTube',
  },
  novaScotiaWeather: {
    what: 'Nova Scotia live weather map',
    by: 'Windy.com',
    url: 'https://www.windy.com',
    license: 'embedded per Windy terms',
  },
  issStream: {
    what: 'ISS live video',
    by: 'NASA, "Live High-Definition Views from the ISS" (YouTube)',
    url: 'https://www.youtube.com/watch?v=awQzjn72bI0',
    license: 'embedded via YouTube',
  },
  issPosition: {
    what: 'ISS position and orbit data',
    by: 'Where the ISS at? (wheretheiss.at API)',
    url: 'https://wheretheiss.at',
  },
  viewingSpotPhotos: { what: 'Viewing spot photos', by: '[add source]' },
  googleMaps: { what: 'Viewing spot directions', by: 'Google Maps', url: 'https://www.google.com/maps' },

  // ── Home / Presentation backgrounds ──────────────────────────────
  homeHero: { what: 'Home page background image', by: '[add source]' },
  presentationStars: { what: 'Presentation star background', by: '[add source]' },
  presentationEarth: { what: 'Presentation Earth background', by: '[add source]' },
  radarsat: { what: 'Satellite illustration: RADARSAT Constellation Mission', by: 'MDA' },

  // ── Launch Info ──────────────────────────────────────────────────
  challengeBrief: {
    what: 'Challenge brief and target orbits (LEO ~45.1°, Polar 87.9°–90°, SSO ~98.1°)',
    by: 'Mission Accepted 2026, Challenge 2: MDA Space, ShiftKey Labs and the Canadian Space Agency',
  },

  // ── Open-source software ─────────────────────────────────────────
  react: { what: 'React', by: 'Meta and contributors', url: 'https://react.dev', license: 'MIT' },
  vite: { what: 'Vite', by: 'VoidZero and contributors', url: 'https://vite.dev', license: 'MIT' },
  mantine: { what: 'Mantine', by: 'Vitaly Rtishchev and contributors', url: 'https://mantine.dev', license: 'MIT' },
  reactRouter: { what: 'React Router', by: 'Remix Software and contributors', url: 'https://reactrouter.com', license: 'MIT' },
  three: { what: 'three.js', by: 'three.js authors', url: 'https://threejs.org', license: 'MIT' },
  globeGl: { what: 'globe.gl', by: 'Vasco Asturiano', url: 'https://globe.gl', license: 'MIT' },
  flask: { what: 'Flask', by: 'Pallets', url: 'https://flask.palletsprojects.com', license: 'BSD-3-Clause' },
}

/** Credit ids used on each page (About shows all of them). */
export const PAGE_CREDITS = {
  home: ['homeHero'],
  missionControl: [
    'earthTexture',
    'moonTexture',
    'sunTexture',
    'capeStream',
    'novaScotiaWeather',
    'issStream',
    'issPosition',
    'viewingSpotPhotos',
    'googleMaps',
  ],
  info: ['challengeBrief'],
  presentation: ['radarsat', 'presentationStars', 'presentationEarth'],
  software: ['react', 'vite', 'mantine', 'reactRouter', 'three', 'globeGl', 'flask'],
}
