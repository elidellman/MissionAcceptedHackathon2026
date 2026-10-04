import { createTheme } from '@mantine/core'

// Shared Mantine theme. Change colours / fonts here and every page picks it up.
export const theme = createTheme({
  primaryColor: 'orange',
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    fontWeight: '700',
  },
  fontFamilyMonospace: 'JetBrains Mono, ui-monospace, Menlo, Consolas, monospace',
  defaultRadius: 'md',
  colors: {
    // Slightly cooler, darker greys for the dark theme
    dark: ['#c9ced6', '#a6adb8', '#7c8594', '#5a6271', '#3a404c', '#262b35', '#1a1e26', '#12151c', '#0c0f15', '#07090e'],
  },
})
