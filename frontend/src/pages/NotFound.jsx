import { Button, Container, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { ROUTES } from '../routes.js'

export default function NotFound() {
  return (
    <Container size="sm" py={80}>
      <Stack align="center" gap="md">
        <Title order={1}>Lost in space</Title>
        <Text c="dimmed">This page doesn't exist.</Text>
        <Button component={Link} to={ROUTES.home.path}>Back home</Button>
      </Stack>
    </Container>
  )
}
