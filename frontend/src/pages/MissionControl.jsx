import { useCallback, useEffect, useState } from 'react'
import { Center, Loader, Text } from '@mantine/core'
import SceneViewport from '../features/mission-control/SceneViewport.jsx'
import HudOverlay from '../features/mission-control/HudOverlay.jsx'
import MissionInputPanel from '../features/mission-control/MissionInputPanel.jsx'
import { DEFAULT_PARAMS } from '../features/mission-control/launchConfig.js'
import { fetchLaunchWindows, fetchTrajectory } from '../api/missionApi.js'
import { DEFAULT_TIME_SCALE } from '../features/mission-control/simulationConfig.js'
import classes from '../features/mission-control/MissionControl.module.css'

/**
 * Mission Control page: full-screen 3D scene, with panels on top.
 *
 * Data flow:
 *   1. user fills in the Mission Inputs panel (left) → `params`
 *   2. load mission + launch windows for those params   (GET /api/launch-windows)
 *   3. user selects a window (bottom bar, or in 3D via onSelect)
 *   4. load that window's trajectory                     (GET /api/launch-windows/<id>/trajectory)
 *   5. SceneViewport draws the orbit/ascent path (independent of the selected window)
 *   6. pressing Simulate sets `simulation`, which SceneViewport animates
 *
 * Data comes from src/api/missionApi.js (mock data until USE_MOCK = false).
 */
export default function MissionControl() {
  const [previewParams, setPreviewParams] = useState(DEFAULT_PARAMS)
  const [submittedParams, setSubmittedParams] = useState(DEFAULT_PARAMS)
  const [mission, setMission] = useState(null)
  const [windows, setWindows] = useState([])
  const [loadingWindows, setLoadingWindows] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [trajectory, setTrajectory] = useState([])
  const [error, setError] = useState(null)
  const [shellsVisible, setShellsVisible] = useState({ leo: false, polar: false, sso: false })
  const [simulation, setSimulation] = useState(null)
  const [timeScale, setTimeScale] = useState(DEFAULT_TIME_SCALE)

  // 2. mission + windows, re-run whenever the user submits a real mission change
  useEffect(() => {
    let cancelled = false
    setLoadingWindows(true)
    setError(null)
    setTrajectory([])
    setSelectedId(null)
    setSimulation(null)
    setTimeScale(DEFAULT_TIME_SCALE)
    fetchLaunchWindows(submittedParams)
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
  }, [submittedParams])

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

  // Stable callbacks (hooks must stay above the early return below)
  const handleTargetBaseChange = useCallback((nextTarget) => {
    if (!nextTarget?.id) return
    setPreviewParams((current) => ({ ...current, siteId: nextTarget.id }))
  }, [])

  const handleSimulateLaunch = useCallback(
    (windowId) => {
      const w = windows.find((win) => win.id === windowId)
      if (!w || !mission) return

      console.log('=== SIMULATE LAUNCH ===', {
        window: {
          id: w.id,
          opensAt: w.opensAt,
          closesAt: w.closesAt,
          durationMin: w.durationMin,
          weather: w.weather,
        },
        launchParams: {
          site: mission.launchSite,
          targetOrbit: mission.targetOrbit,
          inclinationDeg: mission.inclinationDeg,
          altitudeKm: mission.altitudeKm,
        },
      })

      // New object each press so repeat clicks re-trigger the animation
      setSimulation({ windowId, nonce: Date.now() })
    },
    [windows, mission]
  )

  // Picking (or clearing) a time frame resets the animation and the time scale
  const handleSelectWindow = useCallback((windowId) => {
    setSelectedId(windowId)
    setSimulation(null)
    setTimeScale(DEFAULT_TIME_SCALE)
  }, [])

  const handleSubmit = useCallback((next) => {
    setSubmittedParams(next)
    setPreviewParams(next)
  }, [])

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
        shellsVisible={shellsVisible}
        draftParams={previewParams}
        onTargetBaseChange={handleTargetBaseChange}
        simulation={simulation}
        timeScale={timeScale}
      />
      <HudOverlay
        mission={mission}
        windows={windows}
        selectedId={selectedId}
        onSelect={handleSelectWindow}
        simulation={simulation}
        timeScale={timeScale}
        onTimeScaleChange={setTimeScale}
        shellsVisible={shellsVisible}
        onShellsChange={setShellsVisible}
        onSimulate={handleSimulateLaunch}
      >
        <MissionInputPanel
          params={previewParams}
          onPreviewChange={setPreviewParams}
          onSubmit={handleSubmit}
          loading={loadingWindows}
        />
      </HudOverlay>
      {error && (
        <Text c="red" size="sm" className={classes.errorBanner}>
          {error}
        </Text>
      )}
    </div>
  )
}