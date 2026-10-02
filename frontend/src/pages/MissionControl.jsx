import { useEffect, useState } from 'react'
import { Center, Loader, Text } from '@mantine/core'
import SceneViewport from '../features/mission-control/SceneViewport.jsx'
import HudOverlay from '../features/mission-control/HudOverlay.jsx'
import { fetchLaunchWindows, fetchTrajectory } from '../api/missionApi.js'
import classes from '../features/mission-control/MissionControl.module.css'

/**
 * Mission Control page — full-screen 3D scene with a HUD on top.
 *
 * Data flow:
 *   1. load mission + launch windows   (GET /api/launch-windows)
 *   2. user selects a window in the HUD (or in 3D via onSelect)
 *   3. load that window's trajectory    (GET /api/launch-windows/<id>/trajectory)
 *   4. SceneViewport draws it
 *
 * Data comes from src/api/missionApi.js (mock data until USE_MOCK = false).
 */
export default function MissionControl() {
  // TODO(UI): orbit + launch-site are hard-coded. Add a selector in the HUD that sets these.
  const [orbit] = useState('LEO')
  const [siteId] = useState('cape-canaveral')

  const [mission, setMission] = useState(null)
  const [windows, setWindows] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [trajectory, setTrajectory] = useState([])
  const [error, setError] = useState(null)

  // 1. mission + windows
  useEffect(() => {
    let cancelled = false
    fetchLaunchWindows({ orbit, siteId })
      .then(({ mission, windows }) => {
        if (cancelled) return
        setMission(mission)
        setWindows(windows)
        setSelectedId(windows[0]?.id ?? null)
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [orbit, siteId])

  // 3. trajectory for the selected window
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    fetchTrajectory(selectedId)
      .then((points) => !cancelled && setTrajectory(points))
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [selectedId])

  if (error) {
    return (
      <Center className={classes.root}>
        <Text c="red">Couldn't load mission data: {error}</Text>
      </Center>
    )
  }

  if (!mission) {
    return (
      <Center className={classes.root}>
        <Loader />
      </Center>
    )
  }

  return (
    <div className={classes.root}>
      <SceneViewport
        mission={mission}
        windows={windows}
        selectedId={selectedId}
        onSelect={setSelectedId}
        trajectory={trajectory}
      />
      <HudOverlay mission={mission} windows={windows} selectedId={selectedId} onSelect={setSelectedId} />
    </div>
  )
}
