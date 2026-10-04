import { Badge, Button, Container, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { ROUTES } from '../routes.js'
import classes from './Home.module.css'
import PageCredits from '../components/PageCredits.jsx'
import { PAGE_CREDITS } from '../credits.js'

const FEATURES = [
  {
    icon: '⏱️',
    title: 'Real launch windows',
    body: 'Calculated from the launch site, the target orbit (LEO, Polar or SSO) and Earth’s rotation, avoiding launches already scheduled at the site.',
  },
  {
    icon: '🌦️',
    title: 'Two-layer weather check',
    body: 'Every window is rated GO, CAUTION or NO-GO from a live forecast at the pad: strict launch rules (wind, gusts, rain, visibility, winds aloft, storms, low cloud) plus an early warning for marginal conditions.',
  },
  {
    icon: '🚀',
    title: 'Launch simulation',
    body: 'Watch the rocket climb to orbit and release its satellite, with a camera that follows the flight.',
  },
  {
    icon: '🛰️',
    title: 'Space debris check',
    body: 'Tracked debris is moved to launch time and checked against the ascent path, flagging anything within 10 km.',
  },
  {
    icon: '🌍',
    title: '3D globe',
    body: 'Miniature launch sites, the ascent path and target orbit, orbital shells, the Sun, the Moon and the live ISS.',
  },
  {
    icon: '📡',
    title: 'Live feeds',
    body: 'A live pad camera at Cape Canaveral, live weather over Spaceport Nova Scotia and NASA’s video from the ISS.',
  },
]

// Stagger helper for the entrance animation
const delay = (order) => ({ animationDelay: `${0.15 + order * 0.12}s` })

export default function Home() {
  return (
    <>
      <section className={classes.hero}>
        <div className={classes.heroBg} aria-hidden />
        <div className={classes.heroShade} aria-hidden />

        <Container size="lg" w="100%" py={{ base: 48, sm: 96 }}>
          <Stack gap="xl" align="flex-start" maw={680}>
            <Badge variant="light" size="lg" className={classes.reveal} style={delay(0)}>
              MDA Space Mission Accepted 2026 · Challenge 2 (Thank You Ben)
            </Badge>

            <Title order={1} fz={{ base: 40, sm: 64 }} lh={1.05} className={classes.reveal} style={delay(1)}>
              Calculate the right moment to launch.
            </Title>

            <Text size="lg" c="gray.4" className={classes.reveal} style={delay(2)}>
              Mission Control matches a rocket's target orbit with Earth's rotation, launch-site location, space debris, weather conditions, and launch conflicts to show when a launch can happen and what the path to orbit looks like.
            </Text>

            <Group className={classes.reveal} style={delay(3)}>
              <Button component={Link} to={ROUTES.missionControl.path} size="md">
                Open Mission Control
              </Button>
              <Button component={Link} to={ROUTES.guide.path} size="md" variant="default">
                Read the guide
              </Button>
              <Button component={Link} to={ROUTES.info.path} size="md" variant="subtle">
                How launch windows work
              </Button>
            </Group>
          </Stack>
        </Container>
      </section>

      <Container size="lg" className={classes.features}>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          {FEATURES.map((feature, index) => (
            <Paper key={feature.title} p="lg" radius="md" className={`${classes.card} ${classes.reveal}`} style={delay(4 + index)}>
              <Stack gap="xs">
                <ThemeIcon size={44} radius="md" variant="light" fz={22}>
                  {feature.icon}
                </ThemeIcon>
                <Text fw={700}>{feature.title}</Text>
                <Text size="sm" c="dimmed">
                  {feature.body}
                </Text>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
        <PageCredits ids={PAGE_CREDITS.home} mt="xl" />
      </Container>
    </>
  )
}
