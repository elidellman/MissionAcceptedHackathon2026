// Single source of truth for page paths + nav labels.
// To add a page: create it in src/pages, add it here, and add a <Route> in App.jsx.
export const ROUTES = {
  home: { path: '/', label: 'Home' },
  missionControl: { path: '/mission-control', label: 'Mission Control' },
  guide: { path: '/guide', label: 'Guide' },
  info: { path: '/info', label: 'Launch Info' },
  presentation: { path: '/presentation', label: 'Presentation' },
  team: { path: '/team', label: 'Our Team' },
  about: { path: '/about', label: 'About' },
}

export const NAV_ITEMS = [
  ROUTES.home,
  ROUTES.missionControl,
  ROUTES.guide,
  ROUTES.info,
  ROUTES.presentation,
  ROUTES.team,
  ROUTES.about,
]
