import { useEffect, useState } from 'react'
import { Center, Loader, Text } from '@mantine/core'
import SceneViewport from '../features/mission-control/SceneViewport.jsx'
import HudOverlay from '../features/mission-control/HudOverlay.jsx'
import MissionInputPanel from '../features/mission-control/MissionInputPanel.jsx'
import { DEFAULT_PARAMS } from '../features/mission-control/launchConfig.js'
import { fetchLaunchWindows, fetchTrajectory } from '../api/missionApi.js'
import classes from '../features/mission-control/MissionControl.module.css'

/**
 * Mission Control page: full-screen 3D scene, with panels on top.
 *
 * Data flow:
 *   1. user fills in the Mission Inputs panel (left) → `params`
 *   2. load mission + launch windows for those params   (GET /api/launch-windows)
 *   3. user selects a window (bottom bar, or in 3D via onSelect)
 *   4. load that window's trajectory                     (GET /api/launch-windows/<id>/trajectory)
 *   5. SceneViewport draws it
 *
 * Data comes from src/api/missionApi.js (mock data until USE_MOCK = false).
 */
export default function MissionControl() {
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [mission, setMission] = useState(null)
  const [windows, setWindows] = useState([])
  const [loadingWindows, setLoadingWindows] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [trajectory, setTrajectory] = useState([])
  const [error, setError] = useState(null)
  const [shellsVisible, setShellsVisible] = useState({ leo: true, polar: true, sso: true })

  // 2. mission + windows, re-run whenever the inputs are submitted
  useEffect(() => {
    let cancelled = false
    setLoadingWindows(true)
    setError(null)
    fetchLaunchWindows(params)
      .then(({ mission, windows }) => {
        if (cancelled) return
        setMission(mission)
        setWindows(windows)
        setSelectedId(windows[0]?.id ?? null)
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingWindows(false))
    return () => {
      cancelled = true
    }
  }, [params])

  // 4. trajectory for the selected window
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

  if (!mission) {
    return (
      <Center className={classes.root}>
        {error ? <Text c="red">Couldn't load mission data: {error}</Text> : <Loader />}
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
        shellsVisible={shellsVisible}
      />
      <HudOverlay mission={mission} windows={windows} selectedId={selectedId} onSelect={setSelectedId} shellsVisible={shellsVisible} onShellsChange={setShellsVisible}>
        <MissionInputPanel params={params} onSubmit={setParams} loading={loadingWindows} />
      </HudOverlay>
      {error && (
        <Text c="red" size="sm" className={classes.errorBanner}>
          {error}
        </Text>
      )}
    </div>
  )
}
