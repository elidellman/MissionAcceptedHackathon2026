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
            {ORBITS.map((orbit) => (
              <Card key={orbit.name} withBorder padding="lg">
                <Group justify="space-between" mb="xs">
                  <Text fw={800} size="xl">{orbit.name}</Text>
                  <Badge variant="light">{orbit.inclination}</Badge>
                </Group>
                <Text size="sm" fw={600}>{orbit.full}</Text>
                <Text size="sm" c="dimmed" mt={4}>{orbit.body}</Text>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>

        <Stack gap="sm">
          <Title order={2} size="h3">What we factor in</Title>
          <List spacing="xs">
            <List.Item><b>Orbital requirements</b>: target orbit type, inclination and altitude, plus the orbit’s orientation (RAAN) if you give one.</List.Item>
            <List.Item><b>Earth's rotation</b>: when the launch site passes under the orbital plane. With a RAAN this gives exact windows, usually two a day.</List.Item>
            <List.Item><b>Launch site</b>: latitude limits which inclinations are reachable directly. Nova Scotia (45.3° N) and Baikonur (45.9° N) can’t reach LEO at 45.1°.</List.Item>
            <List.Item><b>Vehicle duration</b>: how long the rocket takes to reach orbit, used to correct the launch heading for Earth’s rotation during the climb (optional).</List.Item>
            <List.Item><b>Scheduled launches</b>: windows that overlap a launch already booked at the same site are removed (The Space Devs Launch Library).</List.Item>
            <List.Item><b>Weather</b>: a live forecast at the pad, checked against launch rules and an early warning (details below).</List.Item>
            <List.Item><b>Space debris</b>: tracked debris (CelesTrak) is moved to launch time and checked against the ascent path when you simulate.</List.Item>
          </List>
        </Stack>

        <Stack gap="sm">
          <Title order={2} size="h3">Weather indicator</Title>
          <Group>
            <Badge color="green" size="lg">GO</Badge>
            <Badge color="yellow" size="lg">CAUTION</Badge>
            <Badge color="red" size="lg">NO-GO</Badge>
            <Badge color="gray" size="lg">NO FORECAST</Badge>
          </Group>
          <Text size="sm">
            Each window is checked against the live Open-Meteo forecast for the pad, in two layers:
          </Text>
          <List spacing="xs" size="sm">
            <List.Item>
              <b>Launch rules</b> (hard limits): surface wind up to 30 mph, gusts up to 40 mph, rain under 1 in/hr,
              visibility at least 2 miles, winds aloft up to 50 mph, no thunderstorms, and low cloud under 50%.
              Breaking any rule makes the window <b>NO-GO</b>.
            </List.Item>
            <List.Item>
              <b>Early warning</b>: softer signs that conditions are marginal, such as rising gusts, a chance of rain,
              heavy cloud or very cold or hot temperatures. If every rule passes but something is flagged, the window is{' '}
              <b>CAUTION</b>; severe conditions make it NO-GO.
            </List.Item>
            <List.Item>
              Windows more than 16 days out show <b>NO FORECAST</b>. Click <b>Why?</b> on any window card to see the reason.
            </List.Item>
          </List>
          <Text size="xs" c="dimmed">
            These are simplified thresholds for this demo, not official launch criteria, and forecasts get less
            reliable more than a few days out.
          </Text>
        </Stack>

        <PageCredits ids={PAGE_CREDITS.info} />
      </Stack>
    </Container>
  )
}
