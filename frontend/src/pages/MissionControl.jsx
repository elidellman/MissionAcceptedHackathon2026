import { useCallback, useEffect, useState } from 'react'
import { Text } from '@mantine/core'
import SceneViewport from '../features/mission-control/SceneViewport.jsx'
import HudOverlay from '../features/mission-control/HudOverlay.jsx'
import MissionInputPanel from '../features/mission-control/MissionInputPanel.jsx'
import { DEFAULT_PARAMS, ISS, getSite } from '../features/mission-control/launchConfig.js'
import { fetchLaunchWindows, fetchTrajectory } from '../api/missionApi.js'
import { DEFAULT_TIME_SCALE } from '../features/mission-control/simConfig.js'
import classes from '../features/mission-control/MissionControl.module.css'

/**
 * Mission Control page: full-screen 3D scene, with panels on top.
 *
 * Data flow:
 *   1. user fills in the Mission Inputs panel (left) → `params`
 *   2. load mission + launch windows for those params
 *   3. user selects a window (bottom bar, or in 3D via onSelect)
 *   4. load that window's trajectory
 *   5. SceneViewport draws the orbit/ascent path
 *   6. pressing Simulate sets `simulation`, which SceneViewport animates
 */
export default function MissionControl() {
  const [previewParams, setPreviewParams] = useState(DEFAULT_PARAMS)
  // null until the user clicks "Calculate windows": the countdown and windows bar start empty
  const [submittedParams, setSubmittedParams] = useState(null)
  const [mission, setMission] = useState(null)
  const [windows, setWindows] = useState([])
  const [loadingWindows, setLoadingWindows] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [trajectory, setTrajectory] = useState([])
  const [error, setError] = useState(null)
  const [shellsVisible, setShellsVisible] = useState({
    leo: false,
    polar: false,
    sso: false,
    debris: false,
    iss: false,
  })
  const [simulation, setSimulation] = useState(null)
  const [timeScale, setTimeScale] = useState(DEFAULT_TIME_SCALE)

  // Launch site whose live feed is open (set by clicking a site that has `liveFeed` on the globe)
  const [liveFeedSite, setLiveFeedSite] = useState(null)

  // Keep a launch-site live feed tied to the currently selected site.
  // The ISS feed is independent of launch-site selection, so it stays open.
  useEffect(() => {
    const site = getSite(previewParams.siteId)
    setLiveFeedSite((current) => {
      if (!current || current.id === ISS.id) return current
      return site?.liveFeed ? site : null
    })
  }, [previewParams.siteId])

  // Any change to the Mission Inputs stops the simulation (rocket, satellite, trail);
  // SceneViewport also hides the old path and orbit until Calculate is pressed again.
  const draftKey = JSON.stringify([
    previewParams.siteId,
    previewParams.orbit,
    Number(previewParams.inclinationDeg),
    Number(previewParams.altitudeKm),
    Number(previewParams.days),
  ])
  useEffect(() => {
    setSimulation(null)
    setTimeScale(DEFAULT_TIME_SCALE)
  }, [draftKey])

  // Load mission + windows whenever the user submits a real mission change.
  useEffect(() => {
    if (!submittedParams) return
    let cancelled = false

    setLoadingWindows(true)
    setError(null)
    setTrajectory([])
    setSelectedId(null)
    setSimulation(null)
    setTimeScale(DEFAULT_TIME_SCALE)
    // Clear the previous site's results so they never show under the new site
    setMission(null)
    setWindows([])

    fetchLaunchWindows(submittedParams)
      .then(({ mission, windows }) => {
        if (cancelled) return
        setMission(mission)
        setWindows(windows)
        setSelectedId(windows[0]?.id ?? null)
      })
      .catch((error) => !cancelled && setError(error.message))
      .finally(() => !cancelled && setLoadingWindows(false))

    return () => {
      cancelled = true
    }


  }, [submittedParams])

  // Load the trajectory for the selected launch window.
  useEffect(() => {
    if (!selectedId) return

    let cancelled = false

    fetchTrajectory(selectedId)
      .then((points) => !cancelled && setTrajectory(points))
      .catch((error) => !cancelled && setError(error.message))

    return () => {
      cancelled = true
    }
  }, [selectedId])

  const handleTargetBaseChange = useCallback((nextTarget) => {
    if (!nextTarget?.id) return
    setPreviewParams((current) => ({
      ...current,
      siteId: nextTarget.id,
    }))
  }, [])

  const handleSimulateLaunch = useCallback(
    (windowId) => {
      const launchWindow = windows.find((candidate) => candidate.id === windowId)
      if (!launchWindow || !mission) return

      console.log('=== SIMULATE LAUNCH ===', {
        window: {
          id: launchWindow.id,
          opensAt: launchWindow.opensAt,
          closesAt: launchWindow.closesAt,
          durationMin: launchWindow.durationMin,
          weather: launchWindow.weather,
        },
        launchParams: {
          site: mission.launchSite,
          targetOrbit: mission.targetOrbit,
          inclinationDeg: mission.inclinationDeg,
          altitudeKm: mission.altitudeKm,
        },
      })

      // New object each press so repeat clicks re-trigger the animation.
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

  const handleSubmit = (params) => {
  setMission(null)
  setWindows([])
  setSelectedId(null)
  setTrajectory(null)

  setSubmittedParams(params)
  setPreviewParams(params)
}

  return (
    <div className={classes.root}>
      <SceneViewport
        mission={mission}
        windows={windows}
        selectedId={selectedId}
        trajectory={trajectory}
        shellsVisible={shellsVisible}
        draftParams={previewParams}
        simulation={simulation}
        timeScale={timeScale}
        onTargetBaseChange={handleTargetBaseChange}
        onLaunchSiteClick={(site) =>
          setLiveFeedSite(site?.liveFeed ? site : null)
        }
        onIssClick={() => setLiveFeedSite(ISS)}
      />

      <HudOverlay
        mission={mission}
        siteId={previewParams.siteId}
        loading={loadingWindows}
        windows={windows}
        selectedId={selectedId}
        onSelect={handleSelectWindow}
        onSimulate={handleSimulateLaunch}
        simulation={simulation}
        timeScale={timeScale}
        onTimeScaleChange={setTimeScale}
        shellsVisible={shellsVisible}
        onShellsChange={setShellsVisible}
        liveFeedSite={liveFeedSite}
        onCloseLiveFeed={() => setLiveFeedSite(null)}
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