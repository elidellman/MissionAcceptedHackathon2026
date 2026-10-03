import { useCallback, useEffect, useRef, useState } from 'react'
import Slide from '../features/presentation/Slide.jsx'
import { SLIDES } from '../features/presentation/slides.js'
import classes from '../features/presentation/Presentation.module.css'

/**
 * Presentation page: full-screen sections that snap into place and animate in.
 * Content lives in src/features/presentation/slides.js (all placeholders for now).
 *
 * Controls: scroll / swipe, the dots on the right, or the keyboard
 * (↓ / PageDown / Space = next, ↑ / PageUp = previous, Home / End).
 */
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
