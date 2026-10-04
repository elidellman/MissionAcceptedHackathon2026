import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import MissionControl from './pages/MissionControl.jsx'
import Info from './pages/Info.jsx'
import Guide from './pages/Guide.jsx'
import Presentation from './pages/Presentation.jsx'
import Team from './pages/Team.jsx'
import About from './pages/About.jsx'
import NotFound from './pages/NotFound.jsx'
import { ROUTES } from './routes.js'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path={ROUTES.home.path} element={<Home />} />
        <Route path={ROUTES.missionControl.path} element={<MissionControl />} />
        <Route path={ROUTES.guide.path} element={<Guide />} />
        <Route path={ROUTES.info.path} element={<Info />} />
        <Route path={ROUTES.presentation.path} element={<Presentation />} />
        <Route path={ROUTES.team.path} element={<Team />} />
        <Route path={ROUTES.about.path} element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
