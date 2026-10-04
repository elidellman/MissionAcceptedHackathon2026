import { VIEWING_SPOTS } from './viewingSpotsData.js'
import ViewingSpots from './ViewingSpots'
import PageCredits from '../../components/PageCredits.jsx'
import { PAGE_CREDITS } from '../../credits.js'
import { useEffect, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import classes from './MissionControl.module.css'
import { TIME_SCALES } from './simConfig.js'

const WEATHER = {
  green: { color: 'green', label: 'GO' },
  yellow: { color: 'yellow', label: 'CAUTION' },
  red: { color: 'red', label: 'NO-GO' },
  unknown: { color: 'gray', label: 'NO FORECAST' },
}

// formatTime: formats a timestamp (ms) as a regular clock time, e.g. 02:35:09 PM
const formatTime = (ms) =>
  new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

/**
 * Simulation clock, shown as a regular time of day.
 *  - No window selected             → the current wall-clock time.
 *  - Window selected, not simulated → that window's opening time (stopped).
 *  - Simulate pressed               → starts at the window's opening time and runs
 *                                     forward at `timeScale` x real speed.
 *
 * launchIso:      ISO string of the selected window's opening time (or undefined)
 * simStartedAtMs: unique id of the current simulation run (the Date.now() when Simulate
 *                 was pressed), or null when no simulation is running
 * timeScale:      1 real second = timeScale simulated seconds
 */
function useSimulationClock(launchIso, simStartedAtMs, timeScale) {
  // now: current real time in ms, refreshed every second (used when no simulation is running)
  const [now, setNow] = useState(() => Date.now())

  // sim: simulated milliseconds elapsed since Simulate was pressed.
  // `key` records which run the value belongs to, so a new run always starts from 0.
  const [sim, setSim] = useState({ key: null, ms: 0 })

  // timeScaleRef: always holds the latest time scale, so changing it mid-run changes the
  // clock speed from that moment on without restarting the interval or resetting the clock
  const timeScaleRef = useRef(timeScale)
  useEffect(() => {
    timeScaleRef.current = timeScale
  }, [timeScale])

  // Real clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Simulation tick: adds (real time passed x time scale) every 100 ms
  useEffect(() => {
    if (!simStartedAtMs) {
      setSim({ key: null, ms: 0 })
      return
    }

    // last: timestamp of the previous tick, used to measure real time passed between ticks
    let last = performance.now()

    const id = setInterval(() => {
      const tickTime = performance.now()
      // dt: real milliseconds since the previous tick
      const dt = tickTime - last
      last = tickTime

      setSim((prev) => ({
        key: simStartedAtMs,
        ms:
          (prev.key === simStartedAtMs ? prev.ms : 0) +
          dt * timeScaleRef.current,
      }))
    }, 100)

    return () => clearInterval(id)
  }, [simStartedAtMs])

  // No window selected: show the real current time
  if (!launchIso) {
    return { label: 'Current time', text: formatTime(now) }
  }

  // launchMs: the selected window's opening time in ms
  const launchMs = new Date(launchIso).getTime()

  // Window selected but Simulate not pressed yet: show its opening time, stopped
  if (!simStartedAtMs) {
    return { label: 'Simulation time', text: formatTime(launchMs) }
  }

  // simElapsedMs: simulated time since Simulate was pressed (0 until this run's first tick)
  const simElapsedMs = sim.key === simStartedAtMs ? sim.ms : 0

  return { label: 'Simulation time', text: formatTime(launchMs + simElapsedMs) }
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

// Weather colour comes straight from the backend (`weather` on each window) — the frontend doesn't compute it.
// The left side is the MissionInputPanel (rendered by pages/MissionControl.jsx), not part of this file.
export default function HudOverlay({
  mission,
  siteId,
  loading,
  windows,
  selectedId,
  onSelect, // page handler: also resets the animation and the time scale
  shellsVisible,
  onShellsChange,
  onSimulate,
  simulation, // { windowId, nonce } for the current run, or null
  timeScale,
  onTimeScaleChange,
  liveFeedSite,
  onCloseLiveFeed,
  children,
}) {
  const topRightRef = useRef(null)
  const topRightWidth = useWidth(topRightRef)
  const [windowsOpen, setWindowsOpen] = useState(true)
  // Window ids whose weather reason is expanded ("Why? ▾")
  const [openReasons, setOpenReasons] = useState(() => new Set())
  const toggleReason = (id) =>
    setOpenReasons((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // selectedWindow: the window the user clicked (undefined if none is selected)
  const selectedWindow = windows.find((launchWindow) => launchWindow.id === selectedId)

  // simStartedAtMs: identifies the current run. Only counts while the simulated window is
  // still the selected one; the page clears `simulation` whenever a new time is picked.
  const simStartedAtMs =
    simulation && simulation.windowId === selectedId ? simulation.nonce : null

  const clock = useSimulationClock(
    selectedWindow?.opensAt,
    simStartedAtMs,
    timeScale
  )

  const toggleShell = (shell) => {
    onShellsChange({
      ...shellsVisible,
      [shell]: !shellsVisible[shell],
    })
  }

  // Clicking a time selects it; clicking the selected time again clears it
  // (the clock goes back to the current time).
  const handleSelect = (windowId) => {
    onSelect(windowId === selectedId ? null : windowId)
  }

  // Simulate starts the animation and the clock from this window's opening time.
  // Only selects when it's a different window, because selecting resets the time scale.
  const handleSimulate = (windowId) => {
    if (windowId !== selectedId) {
      onSelect(windowId)
    }
    onSimulate?.(windowId)
  }

  // Debris is on unless the state says otherwise
  const debrisOn = shellsVisible.debris ?? false
  const issOn = shellsVisible.iss ?? false

  return (
    <div className={classes.hud}>
      {/* Left: mission input panel is passed in as children */}
      {children}

      {/* Top-right: simulation clock + current mission summary */}
      <Paper
        ref={topRightRef}
        className={`${classes.panel} ${classes.topRight}`}
        p="sm"
      >
        <Text size="xs" c="dimmed" tt="uppercase" fw={700} ta="center">
          {clock.label}
        </Text>

        <Text className={classes.countdown} ta="center">
          {clock.text}
        </Text>

        {/* Time scale picker (only useful once a time frame is selected) */}
        <Group justify="center" mt={4}>
          <Menu shadow="md" position="bottom" withinPortal zIndex={1000}>
            <Menu.Target>
              <Button
                size="xs"
                variant="light"
                color="gray"
                disabled={!selectedWindow}
              >
                Speed: {timeScale}×
              </Button>
            </Menu.Target>

            <Menu.Dropdown>
              {TIME_SCALES.map((scale) => (
                <Menu.Item
                  key={scale}
                  fw={scale === timeScale ? 700 : 400}
                  onClick={() => onTimeScaleChange(scale)}
                >
                  {scale}×{scale === 1 ? ' (real time)' : ''}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>

        {mission ? (
          <>
            {/* The site the windows were calculated for (not the dropdown preview) */}
            <Text size="xs" c="dimmed" ta="center" mt={6}>
              {mission.launchSite.name}
            </Text>
            <Group gap={6} mt={4} justify="center">
              <Badge size="sm" variant="light">
                {mission.targetOrbit}
              </Badge>
              <Badge size="sm" variant="outline" color="gray">
                {mission.inclinationDeg}°
              </Badge>
              <Badge size="sm" variant="outline" color="gray">
                {mission.altitudeKm} km
              </Badge>
            </Group>
          </>
        ) : (
          <Text size="xs" c="dimmed" ta="center" mt={6}>
            {loading ? 'Calculating…' : 'Click “Calculate windows” to start'}
          </Text>
        )}

        {/* Shell toggle buttons */}
        <Stack
          gap="xs"
          mt={12}
          pt={8}
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} ta="center">
            Orbital shells
          </Text>

          <Group gap={6} justify="center">
            <Button
              size="xs"
              variant={shellsVisible.leo ? 'filled' : 'light'}
              color="green"
              onClick={() => toggleShell('leo')}
            >
              LEO
            </Button>

            <Button
              size="xs"
              variant={shellsVisible.polar ? 'filled' : 'light'}
              color="orange"
              onClick={() => toggleShell('polar')}
            >
              Polar
            </Button>

            <Button
              size="xs"
              variant={shellsVisible.sso ? 'filled' : 'light'}
              color="blue"
              onClick={() => toggleShell('sso')}
            >
              SSO
            </Button>
          </Group>

          {/* Debris + ISS toggles, side by side */}
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} ta="center" mt={4}>
            Debris &amp; space station
          </Text>
          <Group gap={6} justify="center">
            <Button
              size="xs"
              variant={debrisOn ? 'filled' : 'light'}
              color="red"
              onClick={() => onShellsChange({ ...shellsVisible, debris: !debrisOn })}
            >
              {debrisOn ? 'Hide debris' : 'Show debris'}
            </Button>
            <Button
              size="xs"
              variant={issOn ? 'filled' : 'light'}
              color="cyan"
              onClick={() => onShellsChange({ ...shellsVisible, iss: !issOn })}
            >
              {issOn ? 'Hide ISS' : 'Show ISS'}
            </Button>
          </Group>
        </Stack>

        <ViewingSpots
          spots={VIEWING_SPOTS[mission?.launchSite?.id ?? siteId] ?? []}
        />

        <PageCredits ids={PAGE_CREDITS.missionControl} collapsible mt={12} />
      </Paper>

      {/* Top-right, left of the countdown panel: live feed of the clicked site or ISS */}
      {liveFeedSite?.liveFeed && (
        <div
          className={classes.liveFeed}
          style={{ right: 12 + topRightWidth + 12 }}
        >
          <div className={classes.liveFeedHeader}>
            <span className={classes.liveDot} />
            <span className={classes.liveFeedTitle}>
              {liveFeedSite.liveFeed.title || liveFeedSite.name}
            </span>
            <button
              type="button"
              className={classes.liveFeedClose}
              onClick={onCloseLiveFeed}
              aria-label="Close live feed"
            >
              ×
            </button>
          </div>

          <iframe
            key={liveFeedSite.id}
            className={classes.liveFeedVideo}
            src={liveFeedSite.liveFeed.embedUrl}
            title={
              liveFeedSite.liveFeed.title ||
              `${liveFeedSite.name} live feed`
            }
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Bottom: launch windows list */}
      <Paper className={`${classes.panel} ${classes.bottom}`} p="sm">
        <UnstyledButton
          onClick={() => setWindowsOpen((wasOpen) => !wasOpen)}
          aria-expanded={windowsOpen}
          style={{ display: 'block', width: '100%' }}
        >
          <Group justify="center" gap={6}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Launch windows
            </Text>

            <Text size="xs" c="dimmed">
              {windowsOpen ? '▾' : '▴'}
            </Text>
          </Group>
        </UnstyledButton>

        {/* Calculated, but nothing came back (e.g. orbit not reachable from this site) */}
        {windowsOpen && mission && !windows.length && (
          <Text size="xs" c="dimmed" ta="center" mt={6}>
            No launch windows for {mission.targetOrbit} from {mission.launchSite.name}.
          </Text>
        )}

        {windowsOpen && windows.length > 0 && (
          <Group gap="xs" wrap="nowrap" mt={6} className={classes.windowRow}>
            {windows.map((launchWindow) => {
            const weatherStyle = WEATHER[launchWindow.weather?.rating] ?? WEATHER.yellow
              return (
                // A div (not a <button>) because it contains the Simulate button,
                // and a button can't be nested inside another button.
                <Paper
                  key={launchWindow.id}
                  component="div"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(launchWindow.id)}
                  onKeyDown={(event) => {
                    // ignore key presses that came from the Simulate button inside the card
                    if (event.target !== event.currentTarget) return
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleSelect(launchWindow.id)
                    }
                  }}
                  className={classes.windowCard}
                  data-selected={launchWindow.id === selectedId || undefined}
                  p="xs"
                >
                  <Stack gap={2} align="flex-start">
                    <Text size="sm" fw={600}>
                      {new Date(launchWindow.opensAt).toLocaleString([], {
                        weekday: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {launchWindow.durationMin} min
                    </Text>
                    <Group>
                    <Badge size="xs" color={weatherStyle.color}>
                      {weatherStyle.label}
                    </Badge>

                    {/* No simulating a launch the weather rules out */}
                    {launchWindow.weather?.rating !== 'red' && (
                      <Button
                        size="xs"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleSimulate(launchWindow.id)
                        }}
                      >
                        Simulate
                      </Button>
                    )}
                  </Group>

                  {/* Weather reason, collapsed by default */}
                  {launchWindow.weather?.description && (
                    <>
                      <UnstyledButton
                        onClick={(event) => {
                          event.stopPropagation() // don't select the window
                          toggleReason(launchWindow.id)
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        aria-expanded={openReasons.has(launchWindow.id)}
                      >
                        <Text size="xs" c="dimmed" td="underline">
                          Why? {openReasons.has(launchWindow.id) ? '▴' : '▾'}
                        </Text>
                      </UnstyledButton>
                      {openReasons.has(launchWindow.id) && (
                        <Text size="xs" c="dimmed" maw={220}>
                          {launchWindow.weather.description}
                        </Text>
                      )}
                    </>
                  )}
                  </Stack>
                </Paper>
              )
            })}
          </Group>
        )}
      </Paper>
    </div>
  )
}