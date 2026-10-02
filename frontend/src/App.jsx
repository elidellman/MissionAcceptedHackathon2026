import { useState } from 'react'
import { Button, Card, Container, Group, Loader, Stack, Text, Title } from '@mantine/core'
import './App.css'

function App() {
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

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
      <Card withBorder radius="md" p="xl">
        <Stack gap="lg" align="center">
          <Title order={1} c="black" size="h2">Mission Accepted 2026 Hackathon</Title>

          <Group>
            <Button onClick={callTestEndpoint} loading={loading}>
              Call /api/test
            </Button>
          </Group>

          {response && (
            <Card withBorder radius="sm" p="md" bg="gray.0">
              <Text component="pre" size="sm" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {response}
              </Text>
            </Card>
          )}
        </Stack>
      </Card>
    </Container>
  )
}

export default App
