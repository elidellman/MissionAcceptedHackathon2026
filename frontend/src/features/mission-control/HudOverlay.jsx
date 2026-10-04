import { useEffect, useRef, useState } from 'react'
import { UnstyledButton } from '@mantine/core'
import { VIEWING_SPOTS } from './viewingSpotsData.js'
import ViewingSpots from './ViewingSpots'
import PageCredits from '../../components/PageCredits.jsx'
import { PAGE_CREDITS } from '../../credits.js'
import classes from './MissionControl.module.css'
import SimTimeline, { useSimTime, formatMissionTime } from './SimTimeline.jsx'
import { flightEvents } from './flightProfile.js'
import { orbitPeriodSec } from './orbitMath.js'
import { getSite } from './launchConfig.js'
import { landingTypeOf } from './boosterPath.js'

const WEATHER = {
  green: { tone: 'go', label: 'GO' },
  yellow: { tone: 'caution', label: 'CAUTION' },
  red: { tone: 'nogo', label: 'NO-GO' },
  unknown: { tone: 'none', label: 'NO FORECAST' },
}

// Globe layers that can be switched on and off (colour = dot next to the label)
const LAYERS = [
  { key: 'leo', label: 'LEO', color: '#51cf66' },
  { key: 'polar', label: 'Polar', color: '#ff922b' },
  { key: 'sso', label: 'SSO', color: '#4dabf7' },
  { key: 'debris', label: 'Debris', color: '#ff6b6b' },
  { key: 'iss', label: 'ISS', color: '#3bc9db' },
]

// formatTime: a timestamp (ms) as a clock time, e.g. 02:35:09 PM
const formatTime = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** The current wall-clock time, refreshed every second. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Width of an element, kept up to date as it resizes (used to place the live-feed panel). */
function useWidth(ref) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

// Weather colour comes straight from the backend (`weather` on each window).
// The left side is the MissionInputPanel (passed in as children).
export default function HudOverlay({
  mission,
  siteId,
  loading,
  windows,
  selectedId,
  onSelect, // page handler: also resets the animation and the speed
  shellsVisible,
  onShellsChange,
  onSimulate,
  simulation, // { windowId, nonce } for the current run, or null
  simClock,
  playing,
  onPlayingChange,
  timeScale,
  onTimeScaleChange,
  liveFeedSite,
  onCloseLiveFeed,
  children,
}) {
  const topRightRef = useRef(null)
  const topRightWidth = useWidth(topRightRef)
  const [windowsOpen, setWindowsOpen] = useState(true)
  const [moreOpen, setMoreOpen] = useState(false)
  // Window ids whose weather reason is expanded ("Why?")
  const [openReasons, setOpenReasons] = useState(() => new Set())
  const toggleReason = (id) =>
    setOpenReasons((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectedWindow = windows.find((launchWindow) => launchWindow.id === selectedId)
  const simulating = Boolean(simulation && simulation.windowId === selectedId)
  const { simMs } = useSimTime(simClock, simulating, 4)
  const now = useNow()

  // Tuck the window list away while a launch is playing; bring it back afterwards
  useEffect(() => {
    setWindowsOpen(!simulating)
  }, [simulating])

  const launchSite = getSite(mission?.launchSite?.id ?? siteId)
  const landingType = landingTypeOf(launchSite)
  const events = flightEvents(landingType)
  const orbitSec = orbitPeriodSec(Number(mission?.altitudeKm) || 500)

  // Clock: real time → selected window's opening time → running simulation time
  let clockLabel = 'Current time'
  let clockText = formatTime(now)
  if (selectedWindow) {
    const launchMs = new Date(selectedWindow.opensAt).getTime()
    clockLabel = simulating ? `Simulation · ${formatMissionTime(simMs / 1000)}` : 'Window opens'
    clockText = formatTime(launchMs + (simulating ? simMs : 0))
  }

  // Clicking a window selects it; clicking it again clears the selection
  const handleSelect = (windowId) => onSelect(windowId === selectedId ? null : windowId)

  const handleSimulate = (windowId) => {
    if (windowId !== selectedId) onSelect(windowId)
    onSimulate?.(windowId)
  }

  return (
    <div className={classes.hud}>
      {children}

      {/* Top-right: clock, mission summary, layers */}
      <div ref={topRightRef} className={`${classes.panel} ${classes.topRight}`}>
        <div className={classes.label}>{clockLabel}</div>
        <div className={classes.clock}>{clockText}</div>

        {mission ? (
          <div className={classes.missionLine}>
            <span>{mission.launchSite.name}</span>
            <span className={classes.chips}>
              <span className={classes.chip}>{mission.targetOrbit}</span>
              <span className={classes.chip}>{mission.inclinationDeg}°</span>
              <span className={classes.chip}>{mission.altitudeKm} km</span>
            </span>
          </div>
        ) : (
          <div className={classes.hint}>{loading ? 'Calculating…' : 'Pick a site and orbit, then Calculate'}</div>
        )}

        <div className={classes.divider} />
        <div className={classes.label}>Layers</div>
        <div className={classes.layerRow}>
          {LAYERS.map((layer) => (
            <button
              key={layer.key}
              type="button"
              className={classes.layerToggle}
              data-active={shellsVisible[layer.key] || undefined}
              style={{ '--layer-color': layer.color }}
              onClick={() => onShellsChange({ ...shellsVisible, [layer.key]: !shellsVisible[layer.key] })}
            >
              <span className={classes.layerDot} />
              {layer.label}
            </button>
          ))}
        </div>

        <UnstyledButton className={classes.moreToggle} onClick={() => setMoreOpen((wasOpen) => !wasOpen)} aria-expanded={moreOpen}>
          {moreOpen ? 'Less ▴' : 'Viewing spots & sources ▾'}
        </UnstyledButton>
        {moreOpen && (
          <>
            <ViewingSpots spots={VIEWING_SPOTS[mission?.launchSite?.id ?? siteId] ?? []} />
            <PageCredits ids={PAGE_CREDITS.missionControl} collapsible mt={12} />
          </>
        )}
      </div>

      {/* Live feed of the clicked site or the ISS, left of the top-right panel */}
      {liveFeedSite?.liveFeed && (
        <div className={classes.liveFeed} style={{ right: 16 + topRightWidth + 12 }}>
          <div className={classes.liveFeedHeader}>
            <span className={classes.liveDot} />
            <span className={classes.liveFeedTitle}>{liveFeedSite.liveFeed.title || liveFeedSite.name}</span>
            <button type="button" className={classes.liveFeedClose} onClick={onCloseLiveFeed} aria-label="Close live feed">
              ×
            </button>
          </div>
          <iframe
            key={liveFeedSite.id}
            className={classes.liveFeedVideo}
            src={liveFeedSite.liveFeed.embedUrl}
            title={liveFeedSite.liveFeed.title || `${liveFeedSite.name} live feed`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Bottom: timeline (while simulating) + launch windows */}
      <div className={classes.bottom}>
        {simulating && (
          <div className={classes.panel}>
            <SimTimeline
              simClock={simClock}
              events={events}
              orbitSec={orbitSec}
              playing={playing}
              onPlayingChange={onPlayingChange}
              timeScale={timeScale}
              onTimeScaleChange={onTimeScaleChange}
              hasBoosterRecovery={Boolean(landingType)}
            />
          </div>
        )}

        <div className={classes.panel}>
          <UnstyledButton
            className={classes.windowsHeader}
            onClick={() => setWindowsOpen((wasOpen) => !wasOpen)}
            aria-expanded={windowsOpen}
          >
            <span className={classes.label}>Launch windows{windows.length ? ` · ${windows.length}` : ''}</span>
            <span className={classes.label}>{windowsOpen ? '▾' : '▴'}</span>
          </UnstyledButton>

          {windowsOpen && mission && !windows.length && (
            <div className={classes.hint}>No launch windows for {mission.targetOrbit} from {mission.launchSite.name}.</div>
          )}

          {windowsOpen && windows.length > 0 && (
            <div className={classes.windowRow}>
              {windows.map((launchWindow) => {
                const weatherStyle = WEATHER[launchWindow.weather?.rating] ?? WEATHER.yellow
                const reasonOpen = openReasons.has(launchWindow.id)
                return (
                  // A div (not a <button>) because it contains the Simulate button
                  <div
                    key={launchWindow.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelect(launchWindow.id)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleSelect(launchWindow.id)
                      }
                    }}
                    className={classes.windowCard}
                    data-selected={launchWindow.id === selectedId || undefined}
                  >
                    <div className={classes.windowTime}>
                      {new Date(launchWindow.opensAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className={classes.windowMeta}>
                      <span className={classes.weatherPill} data-tone={weatherStyle.tone}>{weatherStyle.label}</span>
                      <span>{launchWindow.durationMin} min</span>
                    </div>

                    <div className={classes.windowActions}>
                      {/* No simulating a launch the weather rules out */}
                      {launchWindow.weather?.rating !== 'red' && (
                        <button
                          type="button"
                          className={classes.simulateButton}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleSimulate(launchWindow.id)
                          }}
                        >
                          ▶ Simulate
                        </button>
                      )}
                      {launchWindow.weather?.description && (
                        <button
                          type="button"
                          className={classes.whyButton}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleReason(launchWindow.id)
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                          aria-expanded={reasonOpen}
                        >
                          Why? {reasonOpen ? '▴' : '▾'}
                        </button>
                      )}
                    </div>
                    {reasonOpen && <div className={classes.windowReason}>{launchWindow.weather.description}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
