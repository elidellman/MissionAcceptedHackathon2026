/**
 * Sources & credits for third-party content, shown on each page via <PageCredits ids={[...]} />.
 * Every entry needs a real source: add an image here only once you know where it came from.
 */
export const CREDITS = {
  // ── Mission Control ──────────────────────────────────────────────
  earthTexture: {
    what: 'Earth texture',
    by: 'NASA Visible Earth, Blue Marble Next Generation',
    url: 'https://visibleearth.nasa.gov/images/74518',
    license: 'public domain',
  },
  capeStream: {
    what: 'Cape Canaveral live feed',
    by: 'Spaceflight Now, "Launch Pad Live" (YouTube)',
    url: 'https://www.youtube.com/watch?v=thfYPsRqxmw',
    license: 'embedded via YouTube',
  },
  novaScotiaWeather: {
    what: 'Live weather maps over the launch sites',
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
  googleMaps: { what: 'Viewing spot directions', by: 'Google Maps', url: 'https://www.google.com/maps' },
  weatherForecast: { what: 'Weather forecasts for both weather checks (launch rules and early warning)', by: 'Open-Meteo', url: 'https://open-meteo.com', license: 'CC BY 4.0' },
  scheduledLaunches: { what: 'Scheduled launches (clash check)', by: 'The Space Devs, Launch Library 2', url: 'https://thespacedevs.com' },
  debrisCatalogue: { what: 'Space debris orbital data', by: 'CelesTrak', url: 'https://celestrak.org' },

  // ── Home / Presentation backgrounds ──────────────────────────────
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
  sgp4: { what: 'sgp4 (orbit propagation)', by: 'Brandon Rhodes', url: 'https://pypi.org/project/sgp4/', license: 'MIT' },
  numpy: { what: 'NumPy', by: 'NumPy developers', url: 'https://numpy.org', license: 'BSD-3-Clause' },
  pandas: { what: 'pandas', by: 'pandas development team', url: 'https://pandas.pydata.org', license: 'BSD-3-Clause' },
  requests: { what: 'Requests', by: 'Python Software Foundation', url: 'https://requests.readthedocs.io', license: 'Apache-2.0' },
  openMeteoRequests: { what: 'openmeteo-requests', by: 'Open-Meteo', url: 'https://pypi.org/project/openmeteo-requests/', license: 'MIT' },
}

/** Credit ids used on each page (About shows all of them). */
export const PAGE_CREDITS = {
  home: [],
  missionControl: [
    'earthTexture',
    'capeStream',
    'novaScotiaWeather',
    'issStream',
    'issPosition',
    'googleMaps',
    'weatherForecast',
    'scheduledLaunches',
    'debrisCatalogue',
  ],
  info: ['challengeBrief'],
  presentation: ['radarsat'],
  software: ['react', 'vite', 'mantine', 'reactRouter', 'three', 'globeGl', 'flask', 'sgp4', 'numpy', 'pandas', 'requests', 'openMeteoRequests'],
}
