// Timings for animations driven from code. CSS animations (rise, stream, alert-pulse) keep theirs as
// --animate-* tokens in index.css. Every one is short, and none runs under reduced motion: CSS is
// switched off by a media query there, and Motion components check useReducedMotion().

/** A page settling in after navigation, in seconds. */
export const PAGE_ENTER_S = 0.18
/** A graph line drawing in when the dashboard opens, in seconds. */
export const CHART_DRAW_S = 0.6
/** A graph line moving to its new shape when the Target System changes, in seconds. */
export const CHART_RESHAPE_S = 0.35
/** Terminal output appears a line at a time, this far apart in milliseconds... */
export const STREAM_STEP_MS = 15
/** ...but never takes longer than this in all. */
export const STREAM_MAX_MS = 300
