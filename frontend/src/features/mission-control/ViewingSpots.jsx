import { useState } from 'react'
import { Anchor, Collapse, Group, Image, Paper, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core'

const mapsUrl = (address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

export default function ViewingSpots({ spots = [] }) {
  const [open, setOpen] = useState(false)
  if (!spots.length) return null

  return (
    <Stack gap="xs" mt={12} pt={8} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
      <UnstyledButton onClick={() => setOpen((wasOpen) => !wasOpen)} aria-expanded={open}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Spots to view the launch
          </Text>
          <Text
            size="xs"
            c="dimmed"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
          >
            ▾
          </Text>
        </Group>
      </UnstyledButton>

      {open && (
        <Stack gap="xs">
          {spots.map((spot) => (
            <Paper key={spot.name} withBorder radius="sm" style={{ overflow: 'hidden', background: 'transparent' }}>
              {spot.image && (
                <Image src={spot.image} alt={spot.name} h={90} fit="cover" fallbackSrc="https://placehold.co/300x90?text=No+image" />
              )}
              <Stack gap={2} p="xs">
                <Text size="sm" fw={600}>{spot.name}</Text>
                <Anchor size="xs" href={mapsUrl(spot.address)} target="_blank" rel="noopener noreferrer">
                  {spot.address}
                </Anchor>
                {spot.distanceKm != null && (
                  <Text size="xs" c="dimmed">{spot.distanceKm} km from pad</Text>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  )
}