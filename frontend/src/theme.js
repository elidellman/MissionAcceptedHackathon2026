import { createTheme } from '@mantine/core'

// Shared Mantine theme. Change colours / fonts here and every page picks it up.
export const theme = createTheme({
  primaryColor: 'orange',
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    fontWeight: '700',
  },
  defaultRadius: 'md',
})
