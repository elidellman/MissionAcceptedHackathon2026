import { useEffect, useState } from 'react'
import { Center, Loader, Text } from '@mantine/core'
import SceneViewport from '../features/mission-control/SceneViewport.jsx'
import HudOverlay from '../features/mission-control/HudOverlay.jsx'
import MissionInputPanel from '../features/mission-control/MissionInputPanel.jsx'
import { DEFAULT_PARAMS, getSite } from '../features/mission-control/launchConfig.js'
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
  const [previewParams, setPreviewParams] = useState(DEFAULT_PARAMS)
  const [submittedParams, setSubmittedParams] = useState(DEFAULT_PARAMS)
  const [mission, setMission] = useState(null)
  const [windows, setWindows] = useState([])
  const [loadingWindows, setLoadingWindows] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [trajectory, setTrajectory] = useState([])
  const [error, setError] = useState(null)
  const [shellsVisible, setShellsVisible] = useState({ leo: false, polar: false, sso: false })
  // Launch site whose live feed is open (set by clicking a site that has `liveFeed` on the globe)
  const [liveFeedSite, setLiveFeedSite] = useState(null)

  // If a live feed is open, keep it on the selected site (dropdown change, globe click or Calculate)
  useEffect(() => {
    const site = getSite(previewParams.siteId)
    setLiveFeedSite((current) => (current ? (site?.liveFeed ? site : null) : null))
  }, [previewParams.siteId])

  // 2. mission + windows, re-run whenever the user submits a real mission change
  useEffect(() => {
    let cancelled = false
    setLoadingWindows(true)
    setError(null)
    setTrajectory([])
    setSelectedId(null)
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
        draftParams={previewParams}
        onTargetBaseChange={(nextTarget) => {
          if (!nextTarget?.id) return
          setPreviewParams((current) => ({
            ...current,
            siteId: nextTarget.id,
          }))
        }}
        onLaunchSiteClick={(site) => setLiveFeedSite(site.liveFeed ? site : null)}
      />
      <HudOverlay mission={mission} windows={windows} selectedId={selectedId} onSelect={setSelectedId} shellsVisible={shellsVisible} onShellsChange={setShellsVisible} liveFeedSite={liveFeedSite} onCloseLiveFeed={() => setLiveFeedSite(null)}>
        <MissionInputPanel
          params={previewParams}
          onPreviewChange={setPreviewParams}
          onSubmit={(next) => {
            setSubmittedParams(next)
            setPreviewParams(next)
          }}
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
