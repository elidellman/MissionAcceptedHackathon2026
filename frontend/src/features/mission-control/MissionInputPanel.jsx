import { useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { LAUNCH_SITES, ORBIT_PRESETS, getSite, isDirectlyReachable } from './launchConfig.js'
import classes from './MissionControl.module.css'

/**
 * MissionInputPanel — collapsible panel on the LEFT of the 3D render.
 * The user picks a launch site + orbit type (+ days to search) and hits "Calculate windows".
 * Inclination and altitude are NOT editable: they come from ORBIT_PRESETS in launchConfig.js.
 * Weather is NOT entered here: the backend fills it in automatically per window.
 *
 * Props:
 *   params    current submitted params { siteId, orbit, inclinationDeg, altitudeKm, days }
 *   onSubmit  (params) => void — MissionControl re-fetches launch windows with these
 *   loading   true while windows are being calculated
 */
export default function MissionInputPanel({ params, onSubmit, loading }) {
  const [open, setOpen] = useState(() => window.innerWidth >= 700)
  const [draft, setDraft] = useState(params)

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }))

  const pickOrbit = (orbit) => {
    const p = ORBIT_PRESETS[orbit]
    setDraft((d) => ({ ...d, orbit, inclinationDeg: p.inclinationDeg, altitudeKm: p.altitudeKm }))
  }

  const site = getSite(draft.siteId)
  const incl = Number(draft.inclinationDeg)
  const reachable = Number.isFinite(incl) && isDirectlyReachable(incl, site.lat)
  const valid = Number(draft.days) >= 1

  if (!open) {
    return (
      <Tooltip label="Mission inputs" position="right">
        <ActionIcon
          className={`${classes.panel} ${classes.panelToggle}`}
          size="xl"
          variant="filled"
          onClick={() => setOpen(true)}
          aria-label="Open mission inputs"
        >
          ☰
        </ActionIcon>
      </Tooltip>
    )
  }

  return (
    <Paper className={`${classes.panel} ${classes.inputPanel}`} p="md">
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          Mission inputs
        </Text>
        <ActionIcon variant="subtle" color="gray" onClick={() => setOpen(false)} aria-label="Collapse mission inputs">
          ✕
        </ActionIcon>
      </Group>

      <ScrollArea.Autosize mah="calc(100dvh - 330px)" offsetScrollbars>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) onSubmit({ ...draft, inclinationDeg: incl, altitudeKm: Number(draft.altitudeKm) })
          }}
        >
          <Stack gap="sm">
            <Select
              label="Launch site"
              data={LAUNCH_SITES.map((s) => ({ value: s.id, label: s.name }))}
              value={draft.siteId}
              onChange={(v) => v && set('siteId')(v)}
              allowDeselect={false}
              description={`${site.region} · ${site.lat.toFixed(2)}°, ${site.lon.toFixed(2)}°`}
              comboboxProps={{ withinPortal: true }}
            />

            <div>
              <Text size="sm" fw={500} mb={4}>
                Orbit type
              </Text>
              <SegmentedControl fullWidth data={['LEO', 'Polar', 'SSO']} value={draft.orbit} onChange={pickOrbit} />
            </div>

            <Group gap="xs">
              <Badge variant="outline" color="gray">Inclination {draft.inclinationDeg}°</Badge>
              <Badge variant="outline" color="gray">Altitude {draft.altitudeKm} km</Badge>
            </Group>

            <NumberInput
              label="Search ahead (days)"
              value={draft.days}
              onChange={set('days')}
              min={1}
              max={30}
            />

            {!reachable && Number.isFinite(incl) && (
              <Alert color="yellow" variant="light" p="xs">
                <Text size="xs">
                  {incl}° is below this site's latitude ({site.lat.toFixed(1)}°), so it can't be reached directly. It
                  would need an extra plane-change manoeuvre.
                </Text>
              </Alert>
            )}

            <Text size="xs" c="dimmed">
              Weather is checked automatically for each window.
            </Text>

            <Button type="submit" loading={loading} disabled={!valid} fullWidth>
              Calculate windows
            </Button>
          </Stack>
        </form>
      </ScrollArea.Autosize>
    </Paper>
  )
}
