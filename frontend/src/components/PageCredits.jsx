import { useState } from 'react'
import { Anchor, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { CREDITS } from '../credits.js'

/**
 * Small "Sources & credits" list for a page.
 *   <PageCredits ids={PAGE_CREDITS.home} />
 *   <PageCredits ids={...} collapsible />   (starts closed, for tight spaces like the Mission Control HUD)
 */
export default function PageCredits({ ids = [], title = 'Sources & credits', collapsible = false, ...props }) {
  const [open, setOpen] = useState(!collapsible)
  const items = ids.map((id) => CREDITS[id]).filter(Boolean)
  if (!items.length) return null

  const heading = (
    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
      {title}
    </Text>
  )

  return (
    <Stack gap={4} pt={8} style={{ borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }} {...props}>
      {collapsible ? (
        <UnstyledButton onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Group justify="space-between">
            {heading}
            <Text size="xs" c="dimmed" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
              ▾
            </Text>
          </Group>
        </UnstyledButton>
      ) : (
        heading
      )}

      {open &&
        items.map((c) => (
          <Text key={c.what} size="xs" c="dimmed">
            {c.what}:{' '}
            {c.url ? (
              <Anchor href={c.url} target="_blank" rel="noopener noreferrer" size="xs">
                {c.by}
              </Anchor>
            ) : (
              c.by
            )}
            {c.license && ` (${c.license})`}
          </Text>
        ))}
    </Stack>
  )
}
