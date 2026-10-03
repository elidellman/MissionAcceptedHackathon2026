// ASCENT_REAL_MS: how long a real launch takes to reach orbit (about 9 minutes), in milliseconds.
// At 1x the animation takes this long; at 60x it takes 9 seconds.
export const ASCENT_REAL_MS = 540_000

// TIME_SCALES: the speeds the user can pick. 60x means 1 real second = 60 simulated seconds.
export const TIME_SCALES = [1, 10, 30, 60, 120, 300]

// DEFAULT_TIME_SCALE: the speed used on load and whenever a new time frame is picked
export const DEFAULT_TIME_SCALE = 60