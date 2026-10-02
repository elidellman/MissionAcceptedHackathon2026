import { useState } from 'react'
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
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Backend Test</h1>
      <button type="button" onClick={callTestEndpoint} disabled={loading}>
        {loading ? 'Loading...' : 'Call /api/test'}
      </button>

      {response && (
        <pre
          style={{
            marginTop: '1rem',
            background: '#f3f4f6',
            padding: '1rem',
            borderRadius: '8px',
            overflowX: 'auto',
          }}
        >
          {response}
        </pre>
      )}
    </main>
  )
}

export default App
