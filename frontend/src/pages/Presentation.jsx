import { useCallback, useEffect, useRef, useState } from 'react'
import Slide from '../features/presentation/Slide.jsx'
import classes from '../features/presentation/Presentation.module.css'

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
    subtitle: 'A launch dashboard that tells planners and the public when to launch, and why',
    body: 'Eli · Ely · Oliver · Hazem · Jeremy ',
  },
  {
    id: 'problem',
    layout: 'right',
    transition: 'slide-right',
    kicker: '01 · The problem',
    title: 'Launching is a timing puzzle',
    subtitle: "A missed window costs millions, and the public can't follow along",
    body:
      "Every launch has to line up a satellite's orbit with a spinning Earth, the weather and what the rocket can do. " +
      'Mission planners need the answer and the reasoning behind it. The public has no simple way to see when the next launch is, ' +
      "where it's going, or whether it's likely to fly.",
    images: [{ src: null, label: 'Screenshot: Mission Control dashboard' }],
  },
  {
    id: 'approach',
    layout: 'trio',
    transition: 'fade-up',
    kicker: '02 · Our approach',
    title: 'Three inputs, three answers',
    subtitle: 'A Track 2 dashboard, built on a real Track 1 engine',
    points: [
      {
        title: 'You pick',
        body: 'Launch site (Cape Canaveral or Spaceport Nova Scotia), orbit type (LEO, Polar or SSO), and how many days to search.',
      },
      {
        title: 'The engine works it out',
        body: "Launch heading, where the orbit plane crosses the pad, and when Earth's rotation lines them up.",
      },
      {
        title: 'You see',
        body: 'A countdown to the next window, the trajectory on a 3D globe, and a GO / CAUTION / NO-GO weather badge. No rocket data to type in.',
      },
    ],
    images: [{ src: null, label: 'Screenshot: Mission Inputs panel' }],
  },
  {
    id: 'demo',
    layout: 'duo',
    transition: 'zoom',
    kicker: '03 · Live demo',
    title: "Let's launch something",
    subtitle: 'One scripted path: Florida first, then Nova Scotia',
    body:
      'Step 1: Cape Canaveral, SSO, 7 days. The countdown starts, window cards show GO / CAUTION / NO-GO, and the ascent draws on the globe. ' +
      "Step 2: switch to Nova Scotia and LEO, and the reachability warning appears. Why? That's the next two slides.",
    images: [
      { src: null, label: 'Screenshot: Cape Canaveral SSO windows' },
      { src: null, label: 'Screenshot: Nova Scotia LEO warning' },
    ],
  },
  {
    id: 'orbital-logic',
    layout: 'trio',
    transition: 'fade-up',
    kicker: '04 · The orbital logic',
    title: 'How our backend finds a launch window',
    subtitle: 'A simple main mode, with precise timing in advanced settings',
    points: [
      {
        title: 'Which way to fly: sin Az = cos i / cos φ',
        body: "Every request gets a launch heading (azimuth) from the orbit's inclination i and the pad's latitude φ. Cape Canaveral to LEO 45.1° gives 53.5°, roughly north-east.",
      },
      {
        title: 'Main mode: hourly slots for 16 days',
        body: 'From just the site and orbit type, the backend lists every hour over the next 16 days (384 slots) as a candidate launch time, ready for the weather check.',
      },
      {
        title: 'Advanced settings (coming to the UI): exact windows',
        body:
          "Give a RAAN Ω and the backend finds where the orbit plane crosses the pad's latitude (sin θ = −tan φ / tan i), " +
          "uses sidereal time and Earth's spin (t = Δλ / ω⊕) to time each crossing, and opens a window 10 minutes either side.",
      },
      {
        title: 'Advanced run: 32 windows in 16 days',
        body: 'Cape Canaveral, LEO, RAAN 30°: two windows a day (one per plane crossing), each about 4 minutes earlier than the day before, because Earth turns once every 23 h 56 min relative to the stars.',
      },
    ],
    images: [{ src: null, label: "Diagram: orbit plane crossing the pad's latitude" }],
  },
  {
    id: 'reachability',
    layout: 'left',
    transition: 'slide-left',
    kicker: '05 · Why the site matters',
    title: 'Not every orbit is reachable',
    subtitle: 'Nova Scotia is built for polar and SSO, and the maths shows it',
    body:
      'An orbit never climbs above its inclination, so a pad further from the equator than that is never passed over. ' +
      'In our advanced calculation, if |tan φ / tan i| > 1 there is no crossing and no windows. Nova Scotia at 45.3° N just misses LEO at 45.1°, ' +
      'so the dashboard warns you. Polar and SSO pass over every latitude, which is why a Canadian spaceport this far north suits them.',
    images: [{ src: null, label: 'Diagram: inclinations each site can reach' }],
  },
  {
    id: 'built',
    layout: 'wide',
    transition: 'fade-up',
    kicker: "06 · How it's built",
    title: 'The stack',
    subtitle: 'React and three.js on top, Flask and Python maths underneath',
    body:
      'React + Vite + Mantine for the dashboard, a three.js globe for the trajectory, and a Flask API (/api/launch-windows) ' +
      'that calls our Python orbital engine. Weather is attached to each window by the backend, so the user never types it. [Mock or live weather API?]',
    images: [{ src: null, label: 'Diagram: React → Flask → Python engine' }],
  },
  {
    id: 'checklist',
    layout: 'trio',
    transition: 'fade-up',
    kicker: '07 · Against the brief',
    title: 'What we delivered',
    subtitle: "What's done, and what's still mocked",
    points: [
      {
        title: 'Done',
        body: 'Countdown to the next window. Backend launch heading and 16-day launch slots from orbit type (Track 1 core).',
      },
      {
        title: 'Simplified or mocked',
        body: '3D trajectory is a simplified ascent arc. Weather is [mock data].',
      },
      {
        title: 'Built in the backend, not in the UI yet',
        body: 'Advanced settings: exact RAAN-based windows and the vehicle-duration heading correction. Still to come: the viewing map bonus.',
      },
    ],
    images: [{ src: null, label: 'Screenshot: window cards with weather badges' }],
  },
  {
    id: 'closing',
    layout: 'closing',
    transition: 'blur',
    kicker: "08 · What's next",
    title: 'Thank you. Questions?',
    subtitle: 'Next: a viewing map, flight time in the windows, live weather and real ascent physics',
    body: 'Mission Control · Eli · Ely · Oliver · Hazem · Jeremy · Jeremiah',
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
      <div className={classes.credit}>Satellites: illustration of the RADARSAT Constellation (built by MDA)</div>
    </div>
  )
}
