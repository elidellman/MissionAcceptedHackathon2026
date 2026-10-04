import { Accordion, Badge, Button, Card, Container, Group, List, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { ROUTES } from '../routes.js'

/**
 * Guide page: how to use Mission Control, including the features that are easy to miss.
 * Keep this in sync with the Mission Control page when features change.
 */

const QUICK_START = [
  { n: 1, title: 'Pick a mission', body: 'In the Mission panel (left), choose one of eight launch sites and an orbit: LEO, Polar or SSO.' },
  { n: 2, title: 'Calculate windows', body: 'The bar at the bottom fills with launch windows, each rated GO, CAUTION or NO-GO.' },
  { n: 3, title: 'Pick a window', body: 'Click a window card. The clock jumps to that window’s opening time.' },
  { n: 4, title: 'Simulate', body: 'Press Simulate to watch the launch: stage separation, the booster landing, orbit and satellite release. Use the timeline to pause or jump around.' },
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
            {QUICK_START.map((step) => (
              <Card key={step.n} withBorder padding="lg">
                <Group gap="sm" align="flex-start" wrap="nowrap">
                  <ThemeIcon radius="xl" size={32} variant="light">{step.n}</ThemeIcon>
                  <Stack gap={2}>
                    <Text fw={700}>{step.title}</Text>
                    <Text size="sm" c="dimmed">{step.body}</Text>
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
                  <List.Item><b>Launch site</b>: eight sites: Spaceport Nova Scotia, Cape Canaveral, Vandenberg, Wallops, Kourou (Guiana Space Centre), Baikonur, Tanegashima and SpaceX Starbase.</List.Item>
                  <List.Item><b>Orbit</b>: LEO, Polar or SSO fills in a typical inclination and altitude. Open <b>Advanced ▾</b> to edit them.</List.Item>
                  <List.Item><b>Search ahead</b>: how many days of windows to look for. The backend searches up to 16 days.</List.Item>
                  <List.Item>
                    <b>RAAN</b> (optional, under Advanced): the orientation of the target orbit. With it, the backend finds the exact moments
                    Earth’s rotation carries the pad under the orbit, usually two short windows a day. Without it, you get
                    hourly launch slots.
                  </List.Item>
                  <List.Item><b>Vehicle duration</b> (optional, under Advanced): seconds from liftoff to orbit, used to correct the launch heading for Earth’s rotation during the climb.</List.Item>
                  <List.Item><b>Reachability warning</b>: if the orbit’s inclination is lower than the site’s latitude, the rocket can’t reach it directly. For example, Nova Scotia (45.3° N) and Baikonur (45.9° N) can’t reach LEO at 45.1°.</List.Item>
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
                                    <List.Item>If no windows come back, the bar says so. Usually the orbit can’t be reached from that site.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="simulation">
              <Accordion.Control>Launch simulation</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item>Press <b>▶ Simulate</b> on a GO or CAUTION window. The rocket lifts off vertically, pitches over (gravity turn) and climbs along the red ascent path, leaving an orange trail. The path follows a realistic profile: about 70 km up and 100 km downrange when the first stage shuts down, reaching orbit roughly 1,900 km downrange after 9 minutes.</List.Item>
                  <List.Item>
                    <b>Stages</b>: at <b>T+2:30</b> the first-stage engines cut off and the stages separate. The second stage lights,
                    the <b>fairing halves</b> peel away at T+3:15, the engine cuts off in orbit at T+9:00 and the <b>satellite</b> is
                    released at T+10:00, then carries on around the target orbit (red ring).
                  </List.Item>
                  <List.Item>
                    <b>Booster recovery</b> (blue dashed line) depends on the site. At <b>Cape Canaveral</b> and <b>Vandenberg</b> it flips,
                    burns back and lands at the landing zone; at <b>Starbase</b> it returns to the tower. From <b>Nova Scotia</b>, <b>Wallops</b> and
                    <b>Kourou</b> it lands on a <b>drone ship</b> about 600 km out at sea. <b>Baikonur</b> and <b>Tanegashima</b> boosters aren’t
                    recovered, so they fall away. Watch for the boostback, entry and landing burns, and the legs opening just before touchdown.
                  </List.Item>
                  <List.Item>The <b>camera follows</b> automatically: a chase view during the climb, then a slow zoom out once in orbit.</List.Item>
                  <List.Item><b>Scroll</b> to zoom while it keeps following. <b>Click or drag</b> the globe to stop following and look around yourself.</List.Item>
                  <List.Item>A <b>debris banner</b> at the top shows whether anything tracked passes within 10 km of the ascent path, and names the closest object.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="timeline">
              <Accordion.Control>Simulation timeline</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item>While a launch plays, a <b>timeline</b> appears at the bottom (the window list tucks away; reopen it with ▴).</List.Item>
                  <List.Item><b>❚❚ / ▶</b> pauses and plays, <b>↺</b> restarts from liftoff, and the <b>T+ clock</b> shows mission time with the current phase next to it.</List.Item>
                  <List.Item>Each dot is a mission event: hover for its name and time, <b>click</b> to jump there. Blue dots are booster events. <b>Drag</b> anywhere on the bar to scrub, forwards or backwards.</List.Item>
                  <List.Item>The first three-quarters of the bar is the 12-minute launch; the last quarter is the satellite’s first full orbit.</List.Item>
                  <List.Item><b>Camera</b>: follow the <b>Rocket</b> (then the satellite), follow the <b>Booster</b> home, or <b>Free</b> to look around yourself.</List.Item>
                  <List.Item><b>Speed</b>: 1× (real time) up to 300×. Each new launch starts at 10×, so the climb to orbit takes about a minute.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="globe">
              <Accordion.Control>The 3D globe</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><b>Drag</b> to rotate, <b>scroll</b> to zoom. Hover over objects to see their names.</List.Item>
                  <List.Item>The <b>launch sites</b> are miniature 3D models: each has a pad, tower and rocket, and the big sites (Cape Canaveral, Kourou, Baikonur) also have an assembly building. The yellow ring marks the selected site.</List.Item>
                  <List.Item><b>Click a launch site</b> to select it and fly the camera there.</List.Item>
                  <List.Item>The <b>red line</b> is the ascent path, the <b>red ring</b> is the target orbit, the <b>green dot</b> is where the rocket reaches orbit, and the <b>blue dashed line</b> is the booster’s way home.</List.Item>
                  <List.Item>The Sun, the Moon and a 3D star field surround the scene.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="feeds">
              <Accordion.Control>Live feeds and the ISS</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><b>Click Cape Canaveral</b> on the globe to open a live video of the launch pads (top right).</List.Item>
                  <List.Item><b>Click any other site</b> to open a live weather map over it. None of them has a reliable public pad camera.</List.Item>
                  <List.Item>Turn on the <b>ISS</b> layer (top right) to add the International Space Station at its real, live position, with its orbit: a fading trail behind and moving dashes ahead.</List.Item>
                  <List.Item><b>Click the ISS</b> to open NASA’s live video from the station. Hover over it to see its altitude and speed.</List.Item>
                  <List.Item>The feed follows the site you select, and closes with <b>×</b>. Videos start muted; unmute them in the player.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="layers">
              <Accordion.Control>Orbital shells and space debris</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item>The <b>LEO / Polar / SSO</b> layers (top right) show the altitude band each orbit type uses, as see-through shells around Earth.</List.Item>
                  <List.Item>The <b>Debris</b> layer draws thousands of tracked debris objects as a red cloud. Bright red points are close to where your rocket reaches orbit.</List.Item>
                  <List.Item>Toggling these layers never moves the camera.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="extras">
              <Accordion.Control>Viewing spots, credits and other extras</Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><b>Viewing spots & sources ▾</b> (top-right panel): expand it for nearby public viewing places, with photos, distance from the pad and a Google Maps link.</List.Item>
                  <List.Item><b>Sources & credits</b> (same section, and the About page): where every image, video and dataset comes from.</List.Item>
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
