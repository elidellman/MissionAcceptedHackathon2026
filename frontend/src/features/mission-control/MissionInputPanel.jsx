import { useEffect, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Button,
  Collapse,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { LAUNCH_SITES, ORBIT_PRESETS, getSite, isDirectlyReachable } from './launchConfig.js'
import classes from './MissionControl.module.css'

/**
 * MissionInputPanel — collapsible panel on the LEFT of the 3D render.
 * The user picks a launch site + orbit preset (+ days to search) and hits "Calculate windows".
 * Orbit values are editable in-place using the preset midpoints as default values.
 */
export default function MissionInputPanel({ params, onPreviewChange, onSubmit, loading }) {
  const [open, setOpen] = useState(() => window.innerWidth >= 700)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const updateValue = (key, value) => {
    const next = { ...params, [key]: value }
    if (onPreviewChange) onPreviewChange(next)
  }

  const updateNumericValue = (key, value) => {
    const next = { ...params, [key]: Number(value) || 0 }
    if (onPreviewChange) onPreviewChange(next)
  }

  const updateOptionalNumericValue = (key, value) => {
    const next = {
      ...params,
      [key]: value === '' || value === null ? '' : Number(value),
    }

    if (onPreviewChange) onPreviewChange(next)
  }

  const commitDraft = (nextDraft) => {
    const normalized = {
      ...nextDraft,
      inclinationDeg: Number(nextDraft.inclinationDeg),
      altitudeKm: Number(nextDraft.altitudeKm),
      days: Number(nextDraft.days),
      raanDeg:
        nextDraft.raanDeg === '' || nextDraft.raanDeg == null
          ? ''
          : Number(nextDraft.raanDeg),

      vehicleDurationSec:
        nextDraft.vehicleDurationSec === '' || nextDraft.vehicleDurationSec == null
          ? ''
          : Number(nextDraft.vehicleDurationSec),
    }

    delete normalized.launchSite

    // Always submit: `params` is the live preview, so comparing against it would skip real changes
    if (onPreviewChange) onPreviewChange(normalized)
    if (onSubmit) onSubmit(normalized)
  }

  const pickOrbit = (orbit) => {
    const preset = ORBIT_PRESETS[orbit]
    const next = {
      ...params,
      orbit,
      inclinationDeg: preset.inclinationDeg,
      altitudeKm: preset.altitudeKm,
    }
    if (onPreviewChange) onPreviewChange(next)
  }

  const site = getSite(params.siteId)
  const incl = Number(params.inclinationDeg)
  const reachable = Number.isFinite(incl) && isDirectlyReachable(incl, site.lat)
  const valid = Number(params.days) >= 1

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
    <Paper className={`${classes.panel} ${classes.inputPanel}`}>
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <span className={classes.label}>Mission</span>
        <ActionIcon variant="subtle" color="gray" onClick={() => setOpen(false)} aria-label="Collapse mission inputs">
          ✕
        </ActionIcon>
      </Group>

      <ScrollArea.Autosize mah="calc(100dvh - 330px)" offsetScrollbars>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) commitDraft({ ...params, inclinationDeg: incl, altitudeKm: Number(params.altitudeKm) })
          }}
        >
          <Stack gap="sm">
            <Select
              label="Launch site"
              data={LAUNCH_SITES.map((site) => ({ value: site.id, label: site.name }))}
              value={params.siteId}
              onChange={(value) => {
                if (!value || value === params.siteId) return
                updateValue('siteId', value)
              }}
              allowDeselect={false}
              description={`${site.region} · ${site.lat.toFixed(2)}°, ${site.lon.toFixed(2)}°`}
              comboboxProps={{ withinPortal: true }}
            />

            <div>
              <Text size="sm" fw={500} mb={4}>
                Orbit
              </Text>
              <SegmentedControl
                fullWidth
                data={['LEO', 'Polar', 'SSO']}
                value={params.orbit}
                onChange={pickOrbit}
              />
              <Text size="xs" c="dimmed" mt={4}>
                {params.inclinationDeg}° inclination · {params.altitudeKm} km up
              </Text>
            </div>

            <NumberInput
              label="Search ahead (days)"
              value={params.days}
              onChange={(value) => updateNumericValue('days', value)}
              min={1}
              max={16}
            />

            <UnstyledButton onClick={() => setAdvancedOpen((wasOpen) => !wasOpen)} aria-expanded={advancedOpen}>
              <Text size="xs" c="dimmed">
                Advanced {advancedOpen ? '▴' : '▾'}
              </Text>
            </UnstyledButton>

            <Collapse expanded={advancedOpen}>
              <Stack gap="xs">
                <NumberInput
                  label="Inclination (°)"
                  value={params.inclinationDeg}
                  onChange={(value) => updateNumericValue('inclinationDeg', value)}
                  min={0}
                  max={180}
                  step={0.1}
                />
                <NumberInput
                  label="Altitude (km)"
                  value={params.altitudeKm}
                  onChange={(value) => updateNumericValue('altitudeKm', value)}
                  min={0}
                  step={1}
                />
                <NumberInput
                  label="RAAN (°)"
                  description="Optional: orientation of the target orbit's plane"
                  value={params.raanDeg ?? ''}
                  onChange={(value) => updateOptionalNumericValue('raanDeg', value)}
                  min={0}
                  max={360}
                  step={0.1}
                  placeholder="Optional"
                />
                <NumberInput
                  label="Vehicle duration (s)"
                  description="Optional: time from liftoff to orbit"
                  value={params.vehicleDurationSec ?? ''}
                  onChange={(value) => updateOptionalNumericValue('vehicleDurationSec', value)}
                  min={0}
                  step={1}
                  placeholder="Optional"
                />
              </Stack>
            </Collapse>

            {!reachable && Number.isFinite(incl) && (
              <Alert color="yellow" variant="light" p="xs">
                <Text size="xs">
                  {incl}° is below this site's latitude ({site.lat.toFixed(1)}°), so it can't be reached directly. It
                  would need an extra plane-change manoeuvre.
                </Text>
              </Alert>
            )}

            <Button type="submit" loading={loading} disabled={!valid} fullWidth>
              Calculate windows
            </Button>
          </Stack>
        </form>
      </ScrollArea.Autosize>
    </Paper>
  )
}
