// Simulation speeds. 10× means 1 real second = 10 simulated seconds.
export const TIME_SCALES = [1, 5, 10, 30, 60, 300]

// DEFAULT_TIME_SCALE: the speed used on load and whenever a new launch is simulated.
// At 10× the climb to orbit (9 minutes) takes about a minute, slow enough to watch
// the stages separate and the booster land.
export const DEFAULT_TIME_SCALE = 10

/** The clock shared by the 3D animation (which advances it) and the timeline (which reads it). */
export const createSimClock = () => ({ simMs: 0, follow: 'rocket' })
