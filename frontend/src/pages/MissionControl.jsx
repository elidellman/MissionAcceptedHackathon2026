import { useState } from 'react'
import SceneViewport from '../features/mission-control/SceneViewport.jsx'
import HudOverlay from '../features/mission-control/HudOverlay.jsx'
import { MOCK_MISSION, MOCK_WINDOWS } from '../features/mission-control/mockData.js'
import classes from '../features/mission-control/MissionControl.module.css'

/**
 * Mission Control page — full-screen 3D scene with a HUD on top.
 * State shared between the scene and the HUD lives here (e.g. which window is selected),
 * so clicking a window in the HUD can highlight its trajectory in 3D and vice versa.
 */
export default function MissionControl() {
  const mission = MOCK_MISSION
  const windows = MOCK_WINDOWS
  const [selectedId, setSelectedId] = useState(windows[0]?.id)

  return (
    <div className={classes.root}>
      <SceneViewport mission={mission} windows={windows} selectedId={selectedId} onSelect={setSelectedId} />
      <HudOverlay mission={mission} windows={windows} selectedId={selectedId} onSelect={setSelectedId} />
    </div>
  )
}
