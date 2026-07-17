/*
 * Moon illumination from the mean synodic cycle. Accurate to within a few
 * hours of phase — more than enough to tell a full moon from a new one
 * when scoring a stargazing window. (Moon *altitude* is not modeled; see
 * the README roadmap.)
 *
 * Part of kairos. AGPL-3.0-or-later.
 */

const SYNODIC_DAYS = 29.530588853;
/** A known new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14) / 1000;

/** Illuminated fraction of the moon's disc, 0–100 %. */
export function moonIlluminationPct(unixSec: number): number {
  const days = (unixSec - NEW_MOON_EPOCH) / 86400;
  const phase = (((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS) / SYNODIC_DAYS;
  return ((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100;
}

/** Human label for the current phase, for the hour-detail panel. */
export function moonPhaseName(unixSec: number): string {
  const days = (unixSec - NEW_MOON_EPOCH) / 86400;
  const phase = (((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS) / SYNODIC_DAYS;
  const names = [
    'new moon',
    'waxing crescent',
    'first quarter',
    'waxing gibbous',
    'full moon',
    'waning gibbous',
    'last quarter',
    'waning crescent',
  ];
  return names[Math.round(phase * 8) % 8];
}
