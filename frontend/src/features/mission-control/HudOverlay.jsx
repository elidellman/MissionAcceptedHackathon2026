import { VIEWING_SPOTS } from './viewingSpotsData.js'
import ViewingSpots from './ViewingSpots'
import PageCredits from '../../components/PageCredits.jsx'
import { PAGE_CREDITS } from '../../credits.js'
import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Group, Paper, Stack, Text, UnstyledButton } from '@mantine/core'
import classes from './MissionControl.module.css'

const WEATHER = {
  green: { color: 'green', label: 'GO' },
  yellow: { color: 'yellow', label: 'CAUTION' },
  red: { color: 'red', label: 'NO-GO' },
}

function useCountdown(targetIso) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const ms = Math.max(0, new Date(targetIso).getTime() - now)
  const s = Math.floor(ms / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `T-${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

// Weather colour comes straight from the backend (`weather` on each window) — the frontend doesn't compute it.
// The left side is the MissionInputPanel (rendered by pages/MissionControl.jsx), not part of this file.
/** Width of an element, kept up to date as it resizes. */
function useWidth(ref) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

export default function HudOverlay({ mission, siteId, loading, windows, selectedId, onSelect, shellsVisible, onShellsChange, liveFeedSite, onCloseLiveFeed, children }) {
  const topRightRef = useRef(null)
  const topRightWidth = useWidth(topRightRef)
  //console.log('launchSite:', mission.launchSite)

  const [windowsOpen, setWindowsOpen] = useState(true)

  const next = windows[0]
  const countdown = useCountdown(next?.opensAt)

  const toggleShell = (shell) => {
    onShellsChange({ ...shellsVisible, [shell]: !shellsVisible[shell] })
  }

  // Debris is on unless the state says otherwise
  const debrisOn = shellsVisible.debris ?? true

  return (
    <div className={classes.hud}>
      {/* Left: mission input panel is passed in as children */}
      {children}

      {/* Top-right: countdown + current mission summary */}
      <Paper ref={topRightRef} className={`${classes.panel} ${classes.topRight}`} p="sm">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700} ta="center">Next window</Text>
        <Text className={classes.countdown} ta="center">{next ? countdown : '—'}</Text>
        {mission ? (
          <>
            {/* The site the windows were calculated for (not the dropdown preview) */}
            <Text size="xs" c="dimmed" ta="center">{mission.launchSite.name}</Text>
            <Group gap={6} mt={4} justify="center">
              <Badge size="sm" variant="light">{mission.targetOrbit}</Badge>
              <Badge size="sm" variant="outline" color="gray">{mission.inclinationDeg}°</Badge>
              <Badge size="sm" variant="outline" color="gray">{mission.altitudeKm} km</Badge>
            </Group>
          </>
        ) : (
          <Text size="xs" c="dimmed" ta="center">{loading ? 'Calculating…' : 'Click “Calculate windows” to start'}</Text>
        )}
        
        {/* Shell toggle buttons */}
        <Stack gap="xs" mt={12} pt={8} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} ta="center">Orbital shells</Text>
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

          {/* Debris toggle */}
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} ta="center" mt={4}>Space debris</Text>
          <Group gap={6} justify="center">
            <Button
              size="xs"
              variant={debrisOn ? 'filled' : 'light'}
              color="red"
              onClick={() => onShellsChange({ ...shellsVisible, debris: !debrisOn })}
            >
              {debrisOn ? 'Hide debris' : 'Show debris'}
            </Button>
          </Group>
        </Stack>
        <ViewingSpots spots={VIEWING_SPOTS[mission?.launchSite.id ?? siteId] ?? []} />
        <PageCredits ids={PAGE_CREDITS.missionControl} collapsible mt={12} />
      </Paper>

      {/* Top-right, left of the countdown panel: live feed of the clicked launch site */}
      {liveFeedSite?.liveFeed && (
        <div className={classes.liveFeed} style={{ right: 12 + topRightWidth + 12 }}>
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

      {/* Bottom: launch windows list */}
      <Paper className={`${classes.panel} ${classes.bottom}`} p="sm">
        <UnstyledButton
          onClick={() => setWindowsOpen((o) => !o)}
          aria-expanded={windowsOpen}
          style={{ display: 'block', width: '100%' }}
        >
          <Group justify="center" gap={6}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Launch windows</Text>
            <Text size="xs" c="dimmed">{windowsOpen ? '▾' : '▴'}</Text>
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
            {windows.map((w) => {
              const wx = WEATHER[w.weather]
              return (
                <Paper
                  key={w.id}
                  component="button"
                  type="button"
                  onClick={() => onSelect(w.id)}
                  className={classes.windowCard}
                  data-selected={w.id === selectedId || undefined}
                  p="xs"
                >
                  <Stack gap={2} align="flex-start">
                    <Text size="sm" fw={600}>
                      {new Date(w.opensAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text size="xs" c="dimmed">{w.durationMin} min</Text>
                    <Badge size="xs" color={wx.color}>{wx.label}</Badge>
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