import { Avatar, Card, Container, SimpleGrid, Stack, Text, Title } from '@mantine/core'

// Edit roles / add links here.
const TEAM = [
  { name: 'Eli', role: 'Team member' },
  { name: 'Ely', role: 'Team member' },
  { name: 'Oliver', role: 'Team member' },
  { name: 'Hazem', role: 'Team member' },
  { name: 'Jeremy', role: 'Frontend' },
  { name: 'Jeremiah', role: 'Team member' },
]

export default function Team() {
  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Stack gap="xs">
          <Title order={1}>Our team</Title>
          <Text c="dimmed" size="lg">
            The people building Mission Control for Mission Accepted 2026.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
          {TEAM.map((m) => (
            <Card key={m.name} withBorder padding="lg">
              <Stack align="center" gap="xs">
                <Avatar size={64} radius="xl" color="orange" variant="light">
                  {m.name.slice(0, 2).toUpperCase()}
                </Avatar>
                <Text fw={700}>{m.name}</Text>
                <Text size="sm" c="dimmed">{m.role}</Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  )
}
