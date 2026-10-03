import { Container, Stack, Text, Title } from '@mantine/core'

/**
 * Presentation page: EMPTY, ready for our hackathon presentation content.
 * Route: /presentation (see src/routes.js)
 *
 * PLACEHOLDER: add slides / sections / embedded media below.
 */
export default function Presentation() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="xs">
        <Title order={1}>Presentation</Title>
        <Text c="dimmed">Content coming soon.</Text>
      </Stack>

      {/* Presentation content goes here */}
    </Container>
  )
}
