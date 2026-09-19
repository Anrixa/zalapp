/**
 * Runtime configuration.
 *
 * Read through helpers rather than inline `process.env` so a missing value
 * fails once, at startup, with a message that says which variable is missing —
 * instead of surfacing as `undefined/v1/venues` in a fetch somewhere.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
