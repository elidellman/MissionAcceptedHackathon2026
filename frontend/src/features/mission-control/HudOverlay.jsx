import { VIEWING_SPOTS } from './viewingSpotsData.js'
import ViewingSpots from './ViewingSpots'
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
import { TIME_SCALES } from './simulationConfig.js'

const WEATHER = {
  green: { color: 'green', label: 'GO' },
  yellow: { color: 'yellow', label: 'CAUTION' },
  red: { color: 'red', label: 'NO-GO' },
}

const formatTime = (ms) =>
  new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

function useSimulationClock(
  launchIso,
  simStartedAtMs,
  timeScale
) {
  const [now, setNow] = useState(() => Date.now())

  const [sim, setSim] = useState({
    key: null,
    ms: 0,
  })

  const timeScaleRef = useRef(timeScale)

  useEffect(() => {
    timeScaleRef.current = timeScale
  }, [timeScale])

  // Real clock
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => clearInterval(id)
  }, [])

  // Simulation clock
  useEffect(() => {
    if (!simStartedAtMs) {
      // IMPORTANT:
      // Completely reset the simulated clock when the simulation
      // is cancelled.
      setSim({
        key: null,
        ms: 0,
      })

      return
    }

    let last = performance.now()

    const id = setInterval(() => {
      const t = performance.now()
      const dt = t - last

      last = t

      setSim((prev) => ({
        key: simStartedAtMs,
        ms:
          (prev.key === simStartedAtMs
            ? prev.ms
            : 0) +
          dt * timeScaleRef.current,
      }))
    }, 100)

    return () => {
      clearInterval(id)
    }
  }, [simStartedAtMs])

  // No window selected
  if (!launchIso) {
    return {
      label: 'Current time',
      text: formatTime(now),
    }
  }

  const launchMs =
    new Date(launchIso).getTime()

  // Window selected but not running
  if (!simStartedAtMs) {
    return {
      label: 'Simulation time',
      text: formatTime(launchMs),
    }
  }

  const simElapsedMs =
    sim.key === simStartedAtMs
      ? sim.ms
      : 0

  return {
    label: 'Simulation time',
    text: formatTime(
      launchMs + simElapsedMs
    ),
  }
}

export default function HudOverlay({
  mission,
  windows,
  selectedId,
  onSelect,
  shellsVisible,
  onShellsChange,
  onSimulate,
  simulation,
  timeScale,
  onTimeScaleChange,
  children,
}) {
  const [windowsOpen, setWindowsOpen] =
    useState(true)

  const selectedWindow =
    windows.find(
      (w) => w.id === selectedId
    )

  /*
   * Only consider the simulation active if it
   * belongs to the currently selected window.
   *
   * When the user selects another time, the parent
   * should clear/replace `simulation`.
   */
  const simStartedAtMs =
    simulation &&
    simulation.windowId === selectedId
      ? simulation.nonce
      : null

  const clock =
    useSimulationClock(
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

  /*
   * Selecting a different time automatically
   * invalidates the old simulation in the parent.
   *
   * Selecting the currently selected time again
   * clears the selection entirely.
   */
  const handleSelect = (windowId) => {
    const nextId =
      windowId === selectedId
        ? null
        : windowId

    onSelect(nextId)
  }

  /*
   * Start a new simulation.
   *
   * If this is a different window, select it first.
   * The parent should create a NEW simulation nonce
   * through onSimulate.
   */
  const handleSimulate = (windowId) => {
    if (windowId !== selectedId) {
      onSelect(windowId)
    }

    onSimulate?.(windowId)
  }

  return (
    <div className={classes.hud}>
      {children}

      {/* ============================= */}
      {/* TOP RIGHT                      */}
      {/* ============================= */}

      <Paper
        className={`${classes.panel} ${classes.topRight}`}
        p="sm"
      >
        <Text
          size="xs"
          c="dimmed"
          tt="uppercase"
          fw={700}
          ta="center"
        >
          {clock.label}
        </Text>

        <Text
          className={classes.countdown}
          ta="center"
        >
          {clock.text}
        </Text>

        <Group justify="center" mt={4}>
          <Menu
            shadow="md"
            position="bottom"
            withinPortal
            zIndex={1000}
          >
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
                  fw={
                    scale === timeScale
                      ? 700
                      : 400
                  }
                  onClick={() =>
                    onTimeScaleChange(scale)
                  }
                >
                  {scale}×
                  {scale === 1
                    ? ' (real time)'
                    : ''}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Text
          size="xs"
          c="dimmed"
          ta="center"
          mt={6}
        >
          {mission.launchSite.name}
        </Text>

        <Group
          gap={6}
          mt={4}
          justify="center"
        >
          <Badge
            size="sm"
            variant="light"
          >
            {mission.targetOrbit}
          </Badge>

          <Badge
            size="sm"
            variant="outline"
            color="gray"
          >
            {mission.inclinationDeg}°
          </Badge>

          <Badge
            size="sm"
            variant="outline"
            color="gray"
          >
            {mission.altitudeKm} km
          </Badge>
        </Group>

        <Stack
          gap="xs"
          mt={12}
          pt={8}
          style={{
            borderTop:
              '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Text
            size="xs"
            c="dimmed"
            tt="uppercase"
            fw={700}
            ta="center"
          >
            Orbital shells
          </Text>

          <Group
            gap={6}
            justify="center"
          >
            <Button
              size="xs"
              variant={
                shellsVisible.leo
                  ? 'filled'
                  : 'light'
              }
              color="green"
              onClick={() =>
                toggleShell('leo')
              }
            >
              LEO
            </Button>

            <Button
              size="xs"
              variant={
                shellsVisible.polar
                  ? 'filled'
                  : 'light'
              }
              color="orange"
              onClick={() =>
                toggleShell('polar')
              }
            >
              Polar
            </Button>

            <Button
              size="xs"
              variant={
                shellsVisible.sso
                  ? 'filled'
                  : 'light'
              }
              color="blue"
              onClick={() =>
                toggleShell('sso')
              }
            >
              SSO
            </Button>
          </Group>
        </Stack>

        <ViewingSpots
          spots={
            VIEWING_SPOTS[
              mission.launchSite.id
            ] ?? []
          }
        />
      </Paper>

      {/* ============================= */}
      {/* LAUNCH WINDOWS                 */}
      {/* ============================= */}

      <Paper
        className={`${classes.panel} ${classes.bottom}`}
        p="sm"
      >
        <UnstyledButton
          onClick={() =>
            setWindowsOpen((o) => !o)
          }
          aria-expanded={windowsOpen}
          style={{
            display: 'block',
            width: '100%',
          }}
        >
          <Group
            justify="center"
            gap={6}
          >
            <Text
              size="xs"
              c="dimmed"
              tt="uppercase"
              fw={700}
            >
              Launch windows
            </Text>

            <Text
              size="xs"
              c="dimmed"
            >
              {windowsOpen
                ? '▾'
                : '▴'}
            </Text>
          </Group>
        </UnstyledButton>

        {windowsOpen && (
          <Group
            gap="xs"
            wrap="nowrap"
            mt={6}
            className={
              classes.windowRow
            }
          >
            {windows.map((w) => {
              const wx =
                WEATHER[w.weather]

              return (
                <Paper
                  key={w.id}
                  component="button"
                  type="button"
                  onClick={() =>
                    handleSelect(w.id)
                  }
                  className={
                    classes.windowCard
                  }
                  data-selected={
                    w.id === selectedId ||
                    undefined
                  }
                  p="xs"
                >
                  <Stack
                    gap={2}
                    align="flex-start"
                  >
                    <Text
                      size="sm"
                      fw={600}
                    >
                      {new Date(
                        w.opensAt
                      ).toLocaleString(
                        [],
                        {
                          weekday:
                            'short',
                          hour: '2-digit',
                          minute:
                            '2-digit',
                        }
                      )}
                    </Text>

                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      {w.durationMin} min
                    </Text>

                    <Group>
                      <Badge
                        size="xs"
                        color={
                          wx.color
                        }
                      >
                        {wx.label}
                      </Badge>

                      <Button
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSimulate(
                            w.id
                          )
                        }}
                      >
                        Simulate
                      </Button>
                    </Group>
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
