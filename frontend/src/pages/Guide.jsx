import { Accordion, Badge, Button, Card, Container, Group, Kbd, List, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { ROUTES } from '../routes.js'

/**
 * Guide page: how to use Mission Control, including the features that are easy to miss.
 * Keep this in sync with the Mission Control page when features change.
 */

const QUICK_START = [
  { n: 1, title: 'Pick a mission', body: 'In Mission inputs (left), choose a launch site and an orbit preset: LEO, Polar or SSO.' },
  { n: 2, title: 'Calculate windows', body: 'The bar at the bottom fills with launch windows, each rated GO, CAUTION or NO-GO.' },
  { n: 3, title: 'Pick a window', body: 'Click a window card. The clock jumps to that window’s opening time.' },
  { n: 4, title: 'Simulate', body: 'Press Simulate on the card to watch the rocket launch, reach orbit and release the satellite.' },
]

const DATA_SOURCES = [
  ['Launch windows', 'Our Python engine (Flask backend)', 'Calculated from the launch site, orbit and Earth’s rotation'],
  ['Scheduled launches', 'The Space Devs Launch Library', 'Windows that clash with launches already booked at the site are removed'],
  ['Weather: launch rules', 'Open-Meteo forecast (weatherApi.py)', 'Hard limits on wind, gusts, rain, visibility, winds aloft, storms and low cloud; any failure = NO-GO'],
  ['Weather: early warning', 'Open-Meteo forecast (weather.py)', 'Flags marginal gusts, rain chance, heavy cloud and temperature extremes as CAUTION; also the backup if the launch-rule engine is down'],
  ['Space debris', 'CelesTrak catalogue + SGP4', 'Tracked debris moved to launch time and checked against the ascent'],
  ['ISS position', 'wheretheiss.at', 'Live position every 15 s, orbit track every 5 min'],
  ['Live video / map', 'YouTube (Spaceflight Now, NASA) and Windy.com', 'Official embeds'],
]

function Section({ title, children }) {
  return (
    <Stack gap="sm">
      <Title order={2} size="h3">{title}</Title>
      {children}
    </Stack>
  )
}

export default function Guide() {
  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Stack gap="xs">
          <Title order={1}>Guide</Title>
          <Text c="dimmed" size="lg">
            Everything Mission Control can do, including the features that are easy to miss.
          </Text>
          <Group mt="xs">
            <Button component={Link} to={ROUTES.missionControl.path}>Open Mission Control</Button>
          </Group>
        </Stack>

        {/* ── Quick start ─────────────────────────────────────────── */}
        <Section title="Quick start">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {QUICK_START.map((s) => (
              <Card key={s.n} withBorder padding="lg">
                <Group gap="sm" align="flex-start" wrap="nowrap">
                  <ThemeIcon radius="xl" size={32} variant="light">{s.n}</ThemeIcon>
                  <Stack gap={2}>
                    <Text fw={700}>{s.title}</Text>
                    <Text size="sm" c="dimmed">{s.body}</Text>
                  </Stack>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        </Section>

        {/* ── Feature reference ───────────────────────────────────── */}
        <Section title="Features">
          <Accordion variant="separated" multiple defaultValue={['inputs']}>
            <Accordion.Item value="inputs">
              <Accordion.Control>Mission inputs (left panel)</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><b>Launch site</b>: Cape Canaveral SLC-40 (Florida) or Spaceport Nova Scotia (Canso).</List.Item>
                  <List.Item><b>Orbit preset</b>: LEO, Polar or SSO fills in a typical inclination and altitude. You can still edit both.</List.Item>
                  <List.Item><b>Search ahead</b>: how many days of windows to look for. The backend searches up to 16 days.</List.Item>
                  <List.Item>
                    <b>RAAN</b> (optional): the orientation of the target orbit. With it, the backend finds the exact moments
                    Earth’s rotation carries the pad under the orbit, usually two short windows a day. Without it, you get
                    hourly launch slots.
                  </List.Item>
                  <List.Item><b>Vehicle duration</b> (optional): seconds from liftoff to orbit, used to correct the launch heading for Earth’s rotation during the climb.</List.Item>
                  <List.Item><b>Reachability warning</b>: if the orbit’s inclination is lower than the site’s latitude, the rocket can’t reach it directly. For example, Nova Scotia (45.3° N) can’t reach LEO at 45.1°.</List.Item>
                  <List.Item><b>Changing any input</b> stops the simulation and hides the old path until you press <b>Calculate windows</b> again, so the globe never shows a path for settings you haven’t calculated.</List.Item>
                  <List.Item>Hide the panel with <b>✕</b> and bring it back with <b>☰</b>.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="windows">
              <Accordion.Control>Launch windows and the clock</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item>The <b>bottom bar</b> lists every window for the site you calculated, soonest first. Collapse it with the <b>▾</b> arrow.</List.Item>
                  <List.Item>
                    Each card shows the start time, length and a weather badge:{' '}
                    <Badge color="green" size="sm">GO</Badge> <Badge color="yellow" size="sm">CAUTION</Badge>{' '}
                    <Badge color="red" size="sm">NO-GO</Badge> <Badge color="gray" size="sm">NO FORECAST</Badge>
                  </List.Item>
                  <List.Item>
                    The weather is checked by <b>two engines</b> reading the same live forecast. <b>Launch rules</b> are hard limits on surface wind (30 mph),
                    gusts (40 mph), rain (1 in/hr), visibility (2 miles), winds aloft (50 mph), thunderstorms and low cloud
                    (50%); breaking any rule makes the window NO-GO. An <b>early warning</b> flags marginal conditions
                    (rising gusts, a chance of rain, heavy cloud, temperature extremes) as CAUTION.
                  </List.Item>
                  <List.Item>Click <b>Why? ▾</b> on a card to see exactly which rule failed or what was flagged.</List.Item>
                  <List.Item><b>NO-GO windows have no Simulate button</b>: you can only launch when the weather allows it.</List.Item>
                  <List.Item>Windows more than 16 days out show NO FORECAST, because weather forecasts don’t reach that far.</List.Item>
                  <List.Item><b>Click a card</b> to select it: the clock (top right) shows that window’s opening time. <b>Click it again</b> to deselect and go back to the current time.</List.Item>
                  <List.Item><b>Speed</b> (under the clock) sets how fast the simulation runs, from 1× (real time) to 300×. It resets to 60× when you pick a new window.</List.Item>
                  <List.Item>If no windows come back, the bar says so. Usually the orbit can’t be reached from that site.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="simulation">
              <Accordion.Control>Launch simulation</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item>Press <b>Simulate</b> on a GO or CAUTION window card. The rocket lifts off from the pad and climbs along the red ascent path, leaving an orange trail.</List.Item>
                  <List.Item>At orbit the rocket releases a <b>satellite</b>, which carries on around the target orbit (red ring). The <b>green marker</b> shows a simplified landing zone.</List.Item>
                  <List.Item>The <b>camera follows</b> automatically: a chase view during the climb, then a slow zoom out once in orbit.</List.Item>
                  <List.Item><b>Scroll</b> to zoom while it keeps following. <b>Click or drag</b> the globe to stop following and look around yourself.</List.Item>
                  <List.Item>A <b>debris banner</b> at the top shows whether anything tracked passes within 10 km of the ascent path, and names the closest object.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="globe">
              <Accordion.Control>The 3D globe</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><b>Drag</b> to rotate, <b>scroll</b> to zoom. Hover over objects to see their names.</List.Item>
                  <List.Item>The <b>launch sites</b> are miniature 3D models: Cape Canaveral has its assembly building, tower and rocket; Nova Scotia has a tower and rocket. The yellow ring marks the selected site.</List.Item>
                  <List.Item><b>Click a launch site</b> to select it and fly the camera there.</List.Item>
                  <List.Item>The <b>red line</b> is the ascent path, the <b>red ring</b> is the target orbit, and the <b>green dot</b> is where the rocket reaches orbit.</List.Item>
                  <List.Item>The Sun, the Moon and a 3D star field surround the scene.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="feeds">
              <Accordion.Control>Live feeds and the ISS</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><b>Click Cape Canaveral</b> on the globe to open a live video of the launch pads (top right).</List.Item>
                  <List.Item><b>Click Spaceport Nova Scotia</b> to open a live weather map of the site. There’s no public pad camera yet.</List.Item>
                  <List.Item>Press <b>Show ISS</b> to add the International Space Station at its real, live position, with its orbit: a fading trail behind and moving dashes ahead.</List.Item>
                  <List.Item><b>Click the ISS</b> to open NASA’s live video from the station. Hover over it to see its altitude and speed.</List.Item>
                  <List.Item>The feed follows the site you select, and closes with <b>×</b>. Videos start muted; unmute them in the player.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="layers">
              <Accordion.Control>Orbital shells and space debris</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><b>LEO / Polar / SSO</b> buttons (top right) show the altitude band each orbit type uses, as see-through shells around Earth.</List.Item>
                  <List.Item><b>Show debris</b> draws thousands of tracked debris objects as a red cloud. Bright red points are close to where your rocket reaches orbit.</List.Item>
                  <List.Item>Toggling these layers never moves the camera.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="extras">
              <Accordion.Control>Viewing spots, credits and other extras</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><b>Spots to view the launch</b> (top-right panel): expand it for nearby public viewing places, with photos, distance from the pad and a Google Maps link.</List.Item>
                  <List.Item><b>Sources & credits</b> (top-right panel and About page): where every image, video and dataset comes from.</List.Item>
                  <List.Item>
                    <b>Presentation page</b>: move between slides with <Kbd>↓</Kbd> / <Kbd>↑</Kbd>, <Kbd>Space</Kbd>,{' '}
                    <Kbd>Page Down</Kbd>, <Kbd>Home</Kbd> / <Kbd>End</Kbd>, or the dots on the right.
                  </List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Section>

        {/* ── Where the data comes from ───────────────────────────── */}
        <Section title="Where the data comes from">
          <Table.ScrollContainer minWidth={520}>
            <Table verticalSpacing="sm" striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>What</Table.Th>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>How it’s used</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {DATA_SOURCES.map(([what, source, how]) => (
                  <Table.Tr key={what}>
                    <Table.Td fw={600}>{what}</Table.Td>
                    <Table.Td>{source}</Table.Td>
                    <Table.Td c="dimmed">{how}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Text size="xs" c="dimmed">
            The weather thresholds and the landing zone are simplified for this demo; they are not official launch criteria.
            Forecasts get less reliable more than a few days out.
          </Text>
        </Section>
      </Stack>
    </Container>
  )
}
