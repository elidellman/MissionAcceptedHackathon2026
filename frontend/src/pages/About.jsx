import { useState } from 'react'
import { Anchor, Button, Card, Code, Container, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { ROUTES } from '../routes.js'
import PageCredits from '../components/PageCredits.jsx'
import { PAGE_CREDITS } from '../credits.js'

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
          The frontend is built with React, Vite and Mantine, with a 3D globe from three.js and globe.gl. The backend is a
          Flask API in Python: it calculates the launch windows, removes clashes with scheduled launches, rates the
          weather against launch rules and an early warning, and screens the ascent for space debris using SGP4.
        </Text>
        <Text>
          New here? The <Anchor component={Link} to={ROUTES.guide.path}>Guide</Anchor> walks through every feature,
          including the less obvious ones.
        </Text>
        <Text c="dimmed" size="sm">
          Challenge presented by MDA Space, ShiftKey Labs and the Canadian Space Agency.
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

        <Stack gap="md">
          <Title order={2} size="h3">Sources & credits</Title>
          <Text size="sm" c="dimmed">
            Mission Control uses the following third-party content and open-source software. All trademarks belong to
            their owners; embedded videos and maps are shown through their providers' official embeds.
          </Text>
          <PageCredits ids={PAGE_CREDITS.missionControl} title="Mission Control" />
          <PageCredits ids={[...PAGE_CREDITS.home, ...PAGE_CREDITS.presentation]} title="Home & Presentation" />
          <PageCredits ids={PAGE_CREDITS.info} title="Launch Info" />
          <PageCredits ids={PAGE_CREDITS.software} title="Open-source software" />
        </Stack>
      </Stack>
    </Container>
  )
}
