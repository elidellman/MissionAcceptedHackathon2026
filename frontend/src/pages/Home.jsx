import { Badge, Button, Container, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { ROUTES } from '../routes.js'
import classes from './Home.module.css'
import PageCredits from '../components/PageCredits.jsx'
import { PAGE_CREDITS } from '../credits.js'

const FEATURES = [
  {
    icon: '🌍',
    title: '3D Earth view',
    body: 'See the launch site, ascent trajectory and target orbit around a live 3D globe.',
  },
  {
    icon: '⏱️',
    title: 'Launch windows',
    body: 'Compatible launch times for LEO, Polar and Sun-Synchronous orbits, with a countdown to the next one.',
  },
  {
    icon: '🌦️',
    title: 'Weather impact',
    body: 'A simple Go / Caution / No-Go indicator for each window based on weather at the pad.',
  },
]

// Stagger helper for the entrance animation
const delay = (i) => ({ animationDelay: `${0.15 + i * 0.12}s` })

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
              <Button component={Link} to={ROUTES.info.path} size="md" variant="default">
                How launch windows work
              </Button>
            </Group>
          </Stack>
        </Container>
      </section>

      <Container size="lg" className={classes.features}>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          {FEATURES.map((f, i) => (
            <Paper key={f.title} p="lg" radius="md" className={`${classes.card} ${classes.reveal}`} style={delay(4 + i)}>
              <Stack gap="xs">
                <ThemeIcon size={44} radius="md" variant="light" fz={22}>
                  {f.icon}
                </ThemeIcon>
                <Text fw={700}>{f.title}</Text>
                <Text size="sm" c="dimmed">
                  {f.body}
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
