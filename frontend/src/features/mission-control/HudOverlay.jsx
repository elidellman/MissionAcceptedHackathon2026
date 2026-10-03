import { useEffect, useState } from 'react'
import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core'
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
export default function HudOverlay({ mission, windows, selectedId, onSelect, shellsVisible, onShellsChange, children }) {
  const next = windows[0]
  const countdown = useCountdown(next?.opensAt)

  const toggleShell = (shell) => {
    onShellsChange({ ...shellsVisible, [shell]: !shellsVisible[shell] })
  }

  return (
    <div className={classes.hud}>
      {/* Left: mission input panel is passed in as children */}
      {children}

      {/* Top-right: countdown + current mission summary */}
      <Paper className={`${classes.panel} ${classes.topRight}`} p="sm">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Next window</Text>
        <Text className={classes.countdown}>{next ? countdown : '—'}</Text>
        <Text size="xs" c="dimmed">{mission.launchSite.name}</Text>
        <Group gap={6} mt={4} justify="flex-end">
          <Badge size="sm" variant="light">{mission.targetOrbit}</Badge>
          <Badge size="sm" variant="outline" color="gray">{mission.inclinationDeg}°</Badge>
          <Badge size="sm" variant="outline" color="gray">{mission.altitudeKm} km</Badge>
        </Group>
        
        {/* Shell toggle buttons */}
        <Stack gap="xs" mt={12} pt={8} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Orbital shells</Text>
          <Group gap={6}>
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
        </Stack>
      </Paper>

      {/* Bottom: launch windows list */}
      <Paper className={`${classes.panel} ${classes.bottom}`} p="sm">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={6}>Launch windows</Text>
        <Group gap="xs" wrap="nowrap" className={classes.windowRow}>
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
      </Paper>
    </div>
  )
}
