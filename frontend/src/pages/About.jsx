import { useState } from 'react'
import { Button, Card, Code, Container, Stack, Text, Title } from '@mantine/core'

export default function About() {
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  // Kept from the original starter page: quick check that the Flask backend is up.
  const callTestEndpoint = async () => {
    setLoading(true)
    setResponse('')
    try {
      const result = await fetch('/api/test')
      const data = await result.json()
      setResponse(JSON.stringify(data, null, 2))
    } catch (error) {
      setResponse(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1}>About</Title>
        <Text>
          Mission Control is our entry for <b>Mission Accepted 2026</b>, Challenge 2: a tool that calculates
          launch windows from orbital requirements and presents them in a way that works for mission planners
          and the general public.
        </Text>
        <Text>
          Built with React, Vite and Mantine on the frontend, and Flask on the backend.
        </Text>
        <Text c="dimmed" size="sm">
          Challenge presented by MDA Space and ShiftKey Labs.
        </Text>

        <Card withBorder padding="md">
          <Stack gap="sm" align="flex-start">
            <Text fw={600}>Backend status</Text>
            <Button size="xs" variant="light" onClick={callTestEndpoint} loading={loading}>
              Call /api/test
            </Button>
            {response && (
              <Code block w="100%">
                {response}
              </Code>
            )}
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
