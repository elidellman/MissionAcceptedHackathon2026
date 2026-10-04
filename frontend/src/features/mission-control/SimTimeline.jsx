import { useEffect, useState } from 'react'
import { Tooltip } from '@mantine/core'
import classes from './MissionControl.module.css'
import { TIME_SCALES } from './simConfig.js'
import { LAUNCH_PHASE_END_SEC, currentEvent } from './flightProfile.js'

/**
 * Reads the shared simulation clock a few times a second (the 3D animation advances it
 * every frame; React doesn't need to re-render that often).
 */
export function useSimTime(simClock, active, fps = 12) {
  const [snapshot, setSnapshot] = useState({ simMs: 0, follow: 'rocket' })
  useEffect(() => {
    if (!active || !simClock) {
      setSnapshot({ simMs: 0, follow: 'rocket' })
      return
    }
    const id = setInterval(() => setSnapshot({ simMs: simClock.simMs, follow: simClock.follow }), 1000 / fps)
    return () => clearInterval(id)
  }, [simClock, active, fps])
  return snapshot
}

/** T+ mm:ss (or h:mm:ss once in orbit for a while). */
export function formatMissionTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = String(whole % 60).padStart(2, '0')
  return hours ? `T+${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `T+${String(minutes).padStart(2, '0')}:${secs}`
}

// The bar has two parts: the launch (first 12 minutes, where all the events are) gets
// most of the width, and the first full orbit is squeezed into the rest.
const LAUNCH_SHARE = 0.75
const toBar = (seconds, orbitSec) =>
  seconds <= LAUNCH_PHASE_END_SEC
    ? (LAUNCH_SHARE * Math.max(0, seconds)) / LAUNCH_PHASE_END_SEC
    : LAUNCH_SHARE + (1 - LAUNCH_SHARE) * Math.min(1, (seconds - LAUNCH_PHASE_END_SEC) / orbitSec)
const fromBar = (fraction, orbitSec) =>
  fraction <= LAUNCH_SHARE
    ? (fraction / LAUNCH_SHARE) * LAUNCH_PHASE_END_SEC
    : LAUNCH_PHASE_END_SEC + ((fraction - LAUNCH_SHARE) / (1 - LAUNCH_SHARE)) * orbitSec

/**
 * Simulation timeline: play/pause, restart, speed, camera target, and a scrubber with a
 * marker for every mission event (click a marker or drag the bar to jump there).
 */
export default function SimTimeline({
  simClock,
  events,
  orbitSec,
  playing,
  onPlayingChange,
  timeScale,
  onTimeScaleChange,
  hasBoosterRecovery,
}) {
  const { simMs, follow } = useSimTime(simClock, true)
  const seconds = simMs / 1000
  const event = currentEvent(events, seconds)
  const inOrbit = seconds > LAUNCH_PHASE_END_SEC
  const progress = toBar(seconds, orbitSec)

  const seek = (targetSec) => {
    simClock.simMs = Math.max(0, targetSec) * 1000
  }
  const setFollow = (target) => {
    simClock.follow = simClock.follow === target ? null : target
  }

  return (
    <div className={classes.timeline}>
      <div className={classes.timelineTop}>
        <button
          type="button"
          className={classes.iconButton}
          onClick={() => onPlayingChange(!playing)}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button type="button" className={classes.iconButton} onClick={() => seek(0)} aria-label="Restart">
          ↺
        </button>

        <span className={classes.missionTime}>{formatMissionTime(seconds)}</span>
        <span className={classes.phaseLabel}>{inOrbit ? 'In orbit' : event.label}</span>

        <span className={classes.timelineSpacer} />

        <div className={classes.segmented} role="group" aria-label="Camera">
          <span className={classes.segmentedLabel}>Camera</span>
          <button type="button" data-active={follow === 'rocket' || undefined} onClick={() => setFollow('rocket')}>
            Rocket
          </button>
          <button
            type="button"
            data-active={follow === 'booster' || undefined}
            onClick={() => setFollow('booster')}
            title={hasBoosterRecovery ? 'Follow the first stage home' : 'This booster is not recovered'}
          >
            Booster
          </button>
          <button type="button" data-active={!follow || undefined} onClick={() => { simClock.follow = null }}>
            Free
          </button>
        </div>

        <div className={classes.segmented} role="group" aria-label="Speed">
          <span className={classes.segmentedLabel}>Speed</span>
          {TIME_SCALES.map((scale) => (
            <button
              key={scale}
              type="button"
              data-active={scale === timeScale || undefined}
              onClick={() => onTimeScaleChange(scale)}
            >
              {scale}×
            </button>
          ))}
        </div>
      </div>

      <div className={classes.track}>
        <div className={classes.trackRail} />
        <div className={classes.trackFill} style={{ width: `${progress * 100}%` }} />
        <div className={classes.trackDivider} style={{ left: `${LAUNCH_SHARE * 100}%` }}>
          <span>Orbit 1</span>
        </div>
        {events.map((marker) => (
          <Tooltip key={marker.key} label={`${formatMissionTime(marker.t)} · ${marker.label}`} withinPortal zIndex={1000}>
            <button
              type="button"
              className={classes.trackMarker}
              data-booster={marker.booster || undefined}
              data-passed={marker.t <= seconds || undefined}
              style={{ left: `${toBar(marker.t, orbitSec) * 100}%` }}
              onClick={() => seek(marker.t)}
              aria-label={`Jump to ${marker.label}`}
            />
          </Tooltip>
        ))}
        <input
          type="range"
          className={classes.trackInput}
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={(event) => seek(fromBar(Number(event.target.value) / 1000, orbitSec))}
          aria-label="Simulation time"
        />
      </div>
    </div>
  )
}
