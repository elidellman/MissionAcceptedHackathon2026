import { Badge, Button, Container, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { ROUTES } from '../routes.js'

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

export default function Home() {
  return (
    <Container size="lg" py={{ base: 40, sm: 80 }}>
      <Stack gap="xl" align="flex-start">
        <Badge variant="light" size="lg">Mission Accepted 2026 · Challenge 2</Badge>

        <Title order={1} fz={{ base: 36, sm: 56 }} lh={1.1} maw={760}>
          Find the right moment to launch.
        </Title>

        <Text size="lg" c="dimmed" maw={620}>
          Mission Control matches a rocket's target orbit with Earth's rotation, launch-site
          location and weather to show when a launch can happen and what the path to orbit looks like.
        </Text>

        <Group>
          <Button component={Link} to={ROUTES.missionControl.path} size="md">
            Open Mission Control
          </Button>
          <Button component={Link} to={ROUTES.info.path} size="md" variant="default">
            How launch windows work
          </Button>
        </Group>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" mt={{ base: 48, sm: 96 }}>
        {FEATURES.map((f) => (
          <Stack key={f.title} gap="xs">
            <ThemeIcon size={44} radius="md" variant="light" fz={22}>
              {f.icon}
            </ThemeIcon>
            <Text fw={700}>{f.title}</Text>
            <Text size="sm" c="dimmed">{f.body}</Text>
          </Stack>
        ))}
      </SimpleGrid>
    </Container>
  )
}
