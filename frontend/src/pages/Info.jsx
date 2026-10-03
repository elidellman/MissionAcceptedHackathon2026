import { Badge, Card, Container, Group, List, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import PageCredits from '../components/PageCredits.jsx'
import { PAGE_CREDITS } from '../credits.js'

const ORBITS = [
  {
    name: 'LEO',
    full: 'Low Earth Orbit',
    inclination: '~45.1°',
    body: 'A few hundred kilometres up. Used by crewed stations, Earth imaging and large constellations.',
  },
  {
    name: 'Polar',
    full: 'Polar Orbit',
    inclination: '87.9° – 90°',
    body: 'Passes over both poles, so the satellite sees the whole planet as Earth rotates beneath it.',
  },
  {
    name: 'SSO',
    full: 'Sun-Synchronous Orbit',
    inclination: '~98.1°',
    body: 'Crosses each spot on Earth at the same local solar time, giving consistent lighting for imaging.',
  },
]

export default function Info() {
  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Stack gap="xs">
          <Title order={1}>Launch info</Title>
          <Text c="dimmed" size="lg">
            What a launch window is, and why a missed one can cost millions.
          </Text>
        </Stack>

        <Stack gap="sm">
          <Title order={2} size="h3">What is a launch window?</Title>
          <Text>
            A rocket can't just leave whenever it's ready. The orbit it is aiming for is a fixed plane in
            space, while the launch pad is spinning along with the Earth. A launch window is the stretch of
            time when the pad lines up with that plane well enough for the rocket to reach it without wasting
            fuel.
          </Text>
        </Stack>

        <Stack gap="sm">
          <Title order={2} size="h3">Target orbits</Title>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            {ORBITS.map((o) => (
              <Card key={o.name} withBorder padding="lg">
                <Group justify="space-between" mb="xs">
                  <Text fw={800} size="xl">{o.name}</Text>
                  <Badge variant="light">{o.inclination}</Badge>
                </Group>
                <Text size="sm" fw={600}>{o.full}</Text>
                <Text size="sm" c="dimmed" mt={4}>{o.body}</Text>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>

        <Stack gap="sm">
          <Title order={2} size="h3">What we factor in</Title>
          <List spacing="xs">
            <List.Item><b>Orbital requirements</b>: target orbit type and inclination.</List.Item>
            <List.Item><b>Earth's rotation</b>: when the launch site passes under the orbital plane.</List.Item>
            <List.Item><b>Launch site</b>: latitude limits which inclinations are reachable directly.</List.Item>
            <List.Item><b>Vehicle</b>: rocket capability and how long it takes to reach the injection point.</List.Item>
            <List.Item><b>Weather</b>: wind, lightning and cloud ceiling rated Go / Caution / No-Go.</List.Item>
          </List>
        </Stack>

        <Stack gap="sm">
          <Title order={2} size="h3">Weather indicator</Title>
          <Group>
            <Badge color="green" size="lg">GO</Badge>
            <Badge color="yellow" size="lg">CAUTION</Badge>
            <Badge color="red" size="lg">NO-GO</Badge>
          </Group>
        </Stack>

        <PageCredits ids={PAGE_CREDITS.info} />
      </Stack>
    </Container>
  )
}
