import { useCallback, useEffect, useRef, useState } from 'react'
import Slide from '../features/presentation/Slide.jsx'
import classes from '../features/presentation/Presentation.module.css'
import { CREDITS, PAGE_CREDITS } from '../credits.js'

/**
 * Presentation page: full-screen sections that snap into place and animate in.
 * Slide content is hard-coded below in SLIDES (same fields and layouts as before,
 * plus a `subtitle` on every slide).
 *
 * To add a screenshot: import it at the top, then set `src` on the image, e.g.
 *   import demoShot from '../assets/screenshots/demo.png'
 *   images: [{ src: demoShot, label: '...' }]
 *
 * Controls: scroll / swipe, the dots on the right, or the keyboard
 * (↓ / PageDown / Space = next, ↑ / PageUp = previous, Home / End).
 */
const SLIDES = [
  {
    id: 'intro',
    layout: 'title',
    transition: 'blur',
    kicker: 'Mission Accepted 2026 · Challenge 2',
    title: 'Mission Control',
    subtitle: 'Pick a launch site and an orbit, and see when you can launch',
    body: 'Eli · Ely · Oliver · Hazem · Jeremy',
  },
  {
    id: 'demo',
    layout: 'duo',
    transition: 'zoom',
    kicker: '01 · Live demo',
    title: 'Let’s launch something',
    subtitle: 'Calculate the windows, then simulate the launch',
    body:
      'Pick Cape Canaveral or Spaceport Nova Scotia and an orbit (LEO, Polar or SSO), then calculate: the countdown and window cards fill in, ' +
      'each rated GO / CAUTION / NO-GO. Press Simulate to watch the rocket climb along its path, reach orbit and release the satellite, ' +
      'while the ascent is checked for space debris.',
    images: [
      { src: null, label: 'Screenshot: launch windows and countdown' },
      { src: null, label: 'Screenshot: launch simulation' },
    ],
  },
  {
    id: 'backend',
    layout: 'trio',
    transition: 'fade-up',
    kicker: '02 · The backend',
    title: 'How every launch window is found',
    subtitle: 'A Flask API and Python engine that calculates, filters, rates and screens each window',
    points: [
      {
        title: '1. Calculate the windows',
        body:
          'From the site and orbit type the engine works out the launch heading (sin Az = cos i / cos φ) and lists launch times for the next 16 days. ' +
          'Given an orbit’s RAAN, it times exactly when Earth’s rotation carries the pad under the orbit plane.',
      },
      {
        title: '2. Avoid scheduled launches',
        body: 'Upcoming launches at the same site come from The Space Devs Launch Library; any window that overlaps one is removed.',
      },
      {
        title: '3. Rate the weather: two checks',
        body:
          'Two weather engines read a live 16-day Open-Meteo forecast for the pad. Launch rules (surface wind, gusts, rain, visibility, winds aloft, ' +
          'storms, low cloud) decide NO-GO; an early warning flags marginal weather as CAUTION. Beyond 16 days: no forecast.',
      },
      {
        title: '4. Screen for space debris',
        body:
          'Thousands of tracked debris objects from CelesTrak are propagated with SGP4 to launch time. The whole ascent path is checked for anything within 10 km.',
      },
    ],
    images: [{ src: null, label: 'Diagram: site + orbit → windows → launch clash check → weather → debris check' }],
  },
  {
    id: 'closing',
    layout: 'closing',
    transition: 'blur',
    kicker: 'Mission Control',
    title: 'Thank you. Questions?',
    subtitle: 'Mission Accepted 2026 · Challenge 2',
    body: 'Eli · Ely · Oliver · Hazem · Jeremy',
  },
]

export default function Presentation() {
  const rootRef = useRef(null)
  const scrollerRef = useRef(null)
  const sectionRefs = useRef([])
  const [visible, setVisible] = useState(() => new Set([0]))
  const [active, setActive] = useState(0)

  // Mark sections visible as they scroll into view (triggers their transition once).
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = Number(e.target.dataset.index)
          if (e.isIntersecting) {
            setVisible((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)))
            if (e.intersectionRatio > 0.55) setActive(idx)
          }
        })
      },
      { root: scrollerRef.current, threshold: [0.2, 0.6] },
    )
    sectionRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Feed scroll progress (0 → 1) to CSS for the background parallax.
  useEffect(() => {
    const el = scrollerRef.current
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const max = el.scrollHeight - el.clientHeight || 1
        rootRef.current?.style.setProperty('--p', (el.scrollTop / max).toFixed(4))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  const goTo = useCallback((i) => {
    const idx = Math.max(0, Math.min(SLIDES.length - 1, i))
    sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); goTo(active + 1) }
      if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); goTo(active - 1) }
      if (e.key === 'Home') { e.preventDefault(); goTo(0) }
      if (e.key === 'End') { e.preventDefault(); goTo(SLIDES.length - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, goTo])

  return (
    <div ref={rootRef} className={classes.root}>
      {/* Background layers */}
      <div className={`${classes.layer} ${classes.stars}`} aria-hidden />
      <div className={`${classes.layer} ${classes.earth}`} aria-hidden />
      <div className={`${classes.layer} ${classes.sats}`} aria-hidden />
      <div className={`${classes.layer} ${classes.vignette}`} aria-hidden />

      {/* Sections */}
      <div ref={scrollerRef} className={classes.scroller}>
        {SLIDES.map((slide, i) => (
          <section
            key={slide.id}
            ref={(el) => (sectionRefs.current[i] = el)}
            data-index={i}
            data-transition={slide.transition}
            data-visible={visible.has(i)}
            className={classes.section}
          >
            <div className={classes.inner}>
              <Slide slide={slide} />
            </div>
          </section>
        ))}
      </div>

      {/* Navigation */}
      <nav className={classes.dots} aria-label="Presentation sections">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={classes.dot}
            data-active={i === active}
            onClick={() => goTo(i)}
            aria-label={`Go to section ${i + 1}`}
          />
        ))}
      </nav>
      <div className={classes.counter}>
        {String(active + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
      </div>
      <div className={classes.credit}>
        {PAGE_CREDITS.presentation.map((id) => `${CREDITS[id].what}: ${CREDITS[id].by}`).join(' · ')}
      </div>
    </div>
  )
}
