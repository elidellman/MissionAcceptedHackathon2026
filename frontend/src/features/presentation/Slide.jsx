import { Grid, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import classes from './Presentation.module.css'

/** Screenshot slot: shows the image if `src` is set, otherwise a dashed placeholder. */
export function ImageHolder({ image, i = 0 }) {
  return (
    <div className={`${classes.imageHolder} ${classes.anim}`} style={{ '--i': i }}>
      {image?.src ? (
        <img src={image.src} alt={image.label || ''} />
      ) : (
        <div className={classes.placeholder}>
          <span className={classes.placeholderIcon}>🖼️</span>
          <Text size="sm" fw={600}>{image?.label || 'Image'}</Text>
          <Text size="xs" c="dimmed">Set `src` in features/presentation/slides.js</Text>
        </div>
      )}
    </div>
  )
}

/** Glass text box with kicker, title and body. */
function TextBox({ slide, i = 0, center = false, big = false }) {
  return (
    <div className={`${classes.textBox} ${classes.anim}`} style={{ '--i': i, textAlign: center ? 'center' : undefined }}>
      <Stack gap="sm" align={center ? 'center' : 'flex-start'}>
        {slide.kicker && <span className={classes.kicker}>{slide.kicker}</span>}
        <Title order={big ? 1 : 2} fz={big ? { base: 40, sm: 64 } : { base: 28, sm: 40 }} lh={1.1}>
          {slide.title}
        </Title>
        {slide.body && (
          <Text size={big ? 'xl' : 'lg'} c="gray.4">
            {slide.body}
          </Text>
        )}
      </Stack>
    </div>
  )
}

/** Picks the arrangement for one section based on `slide.layout`. */
export default function Slide({ slide }) {
  const img = slide.images || []

  switch (slide.layout) {
    case 'title':
    case 'closing':
      return (
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <TextBox slide={slide} center big />
        </div>
      )

    case 'right':
    case 'left': {
      const text = <TextBox slide={slide} i={slide.layout === 'right' ? 0 : 1} />
      const pic = <ImageHolder image={img[0]} i={slide.layout === 'right' ? 1 : 0} />
      return (
        <Grid gutter={{ base: 'lg', md: 48 }} align="center">
          <Grid.Col span={{ base: 12, md: 5 }} order={{ base: 1, md: slide.layout === 'right' ? 1 : 2 }}>
            {text}
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }} order={{ base: 2, md: slide.layout === 'right' ? 2 : 1 }}>
            {pic}
          </Grid.Col>
        </Grid>
      )
    }

    case 'duo':
      return (
        <Stack gap="xl">
          <TextBox slide={slide} />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <ImageHolder image={img[0]} i={1} />
            <ImageHolder image={img[1]} i={2} />
          </SimpleGrid>
        </Stack>
      )

    case 'wide':
      return (
        <Stack gap="xl">
          <TextBox slide={slide} />
          <ImageHolder image={img[0]} i={1} />
        </Stack>
      )

    case 'trio':
      return (
        <Stack gap="xl">
          <div className={classes.anim} style={{ '--i': 0 }}>
            <span className={classes.kicker}>{slide.kicker}</span>
            <Title order={2} fz={{ base: 28, sm: 40 }} mt={6}>
              {slide.title}
            </Title>
          </div>
          <Grid gutter="lg" align="stretch">
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Stack gap="md" h="100%">
                {(slide.points || []).map((p, k) => (
                  <div key={k} className={`${classes.textBox} ${classes.anim}`} style={{ '--i': k + 1, padding: '18px 22px' }}>
                    <Text fw={700}>{p.title}</Text>
                    <Text size="sm" c="gray.4">{p.body}</Text>
                  </div>
                ))}
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <ImageHolder image={img[0]} i={2} />
            </Grid.Col>
          </Grid>
        </Stack>
      )

    default:
      return <TextBox slide={slide} />
  }
}
