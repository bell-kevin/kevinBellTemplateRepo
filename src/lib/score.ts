/*
 * The kairos scoring engine.
 *
 * Every constraint is one shape: a trapezoid band over a metric. Score is
 * 1 inside the ideal range, falls linearly to 0 at the hard bounds, and is
 * 0 beyond them. Derived metrics (sun altitude, moonlight, hours since /
 * until rain) let the same shape express "after dark", "dry grass", and
 * "don't wash the car before a storm". Hour scores combine as a weighted
 * geometric mean, so a single dealbreaker zeroes the hour while everything
 * else blends smoothly.
 *
 * Part of kairos. AGPL-3.0-or-later.
 */

import type {
  Activity,
  Constraint,
  Forecast,
  HourScore,
  MetricId,
  Window,
} from '../types';
import { sunAltitudeDeg } from './solar';
import { moonIlluminationPct } from './lunar';

/** Precipitation at or above this (mm/h) counts as "rain" for dry spells. */
export const RAIN_MM = 0.25;
/** Dry-spell metrics saturate here. */
export const DRY_CAP_H = 48;

export interface DerivedHour {
  sunAlt: number;
  moonLight: number;
  hoursSinceRain: number;
  hoursUntilRain: number;
}

/** Compute the derived metrics for every hour of a forecast. */
export function deriveHours(fc: Forecast): DerivedHour[] {
  const n = fc.hours.length;
  const out: DerivedHour[] = new Array(n);

  // Dry spell looking back: hours since the last rainy hour.
  let sinceRain = DRY_CAP_H; // assume dry before the data begins
  for (let i = 0; i < n; i++) {
    if (fc.hours[i].precip >= RAIN_MM) sinceRain = 0;
    out[i] = {
      sunAlt: 0,
      moonLight: 0,
      hoursSinceRain: Math.min(sinceRain, DRY_CAP_H),
      hoursUntilRain: DRY_CAP_H,
    };
    sinceRain += 1;
  }

  // Dry spell looking ahead: hours until the next rainy hour.
  let untilRain = DRY_CAP_H; // assume dry past the end of the data
  for (let i = n - 1; i >= 0; i--) {
    if (fc.hours[i].precip >= RAIN_MM) untilRain = 0;
    out[i].hoursUntilRain = Math.min(untilRain, DRY_CAP_H);
    untilRain += 1;
  }

  // Sky. Sun evaluated at the middle of each hour block; moon per hour.
  const { lat, lon } = fc.place;
  for (let i = 0; i < n; i++) {
    const t = fc.hours[i].t;
    out[i].sunAlt = sunAltitudeDeg(t + 1800, lat, lon);
    out[i].moonLight = moonIlluminationPct(t);
  }
  return out;
}

/** Read one metric value for hour `i`. */
export function metricValue(fc: Forecast, dv: DerivedHour[], i: number, m: MetricId): number {
  const h = fc.hours[i];
  switch (m) {
    case 'temp': return h.temp;
    case 'feels': return h.feels;
    case 'precipProb': return h.precipProb;
    case 'cloud': return h.cloud;
    case 'wind': return h.wind;
    case 'gusts': return h.gusts;
    case 'humidity': return h.humidity;
    case 'uv': return h.uv;
    case 'sunAlt': return dv[i].sunAlt;
    case 'moonLight': return dv[i].moonLight;
    case 'hoursSinceRain': return dv[i].hoursSinceRain;
    case 'hoursUntilRain': return dv[i].hoursUntilRain;
  }
}

/** Trapezoid band score, 0..1. */
export function bandScore(v: number, c: Constraint): number {
  if (c.hardMin !== undefined && v < c.hardMin) return 0;
  if (c.hardMax !== undefined && v > c.hardMax) return 0;
  let s = 1;
  if (c.idealMin !== undefined && v < c.idealMin) {
    if (c.hardMin !== undefined && c.idealMin > c.hardMin) {
      s = Math.min(s, (v - c.hardMin) / (c.idealMin - c.hardMin));
    }
    // No hard floor: below-ideal is tolerated at full score.
  }
  if (c.idealMax !== undefined && v > c.idealMax) {
    if (c.hardMax !== undefined && c.hardMax > c.idealMax) {
      s = Math.min(s, (c.hardMax - v) / (c.hardMax - c.idealMax));
    }
  }
  return Math.max(0, Math.min(1, s));
}

const EPS = 0.01;

/** Score every hour of the forecast for one activity. */
export function scoreActivity(
  fc: Forecast,
  dv: DerivedHour[],
  act: Activity,
): HourScore[] {
  const n = fc.hours.length;
  const out: HourScore[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let logSum = 0;
    let wSum = 0;
    let worst = 1.01;
    let limiting: MetricId | undefined;
    let dead = false;
    for (const c of act.constraints) {
      const v = metricValue(fc, dv, i, c.metric);
      const s = bandScore(v, c);
      if (s < worst) {
        worst = s;
        limiting = c.metric;
      }
      if (s === 0) {
        dead = true;
        continue;
      }
      const w = c.weight ?? 1;
      logSum += w * Math.log(Math.max(s, EPS));
      wSum += w;
    }
    const s = dead ? 0 : wSum > 0 ? Math.exp(logSum / wSum) : 1;
    out[i] = { s, limiting: worst < 0.995 ? limiting : undefined };
  }
  return out;
}

/** Threshold an hour must clear to belong to a window. */
export const WINDOW_MIN_SCORE = 0.5;

/**
 * Find contiguous windows of at least `minHours` hours with score above the
 * threshold, starting no earlier than `fromIdx` (usually "now"). Windows may
 * cross midnight freely. Ranked by average score, then length.
 */
export function findWindows(
  scores: HourScore[],
  fromIdx: number,
  minHours: number,
): Window[] {
  const wins: Window[] = [];
  let start = -1;
  const flush = (end: number) => {
    if (start >= 0 && end - start + 1 >= Math.max(1, minHours)) {
      let sum = 0;
      let peak = 0;
      for (let i = start; i <= end; i++) {
        sum += scores[i].s;
        peak = Math.max(peak, scores[i].s);
      }
      wins.push({ startIdx: start, endIdx: end, avg: sum / (end - start + 1), peak });
    }
    start = -1;
  };
  for (let i = Math.max(0, fromIdx); i < scores.length; i++) {
    if (scores[i].s >= WINDOW_MIN_SCORE) {
      if (start < 0) start = i;
    } else {
      flush(i - 1);
    }
  }
  flush(scores.length - 1);
  wins.sort((a, b) => b.avg - a.avg || (b.endIdx - b.startIdx) - (a.endIdx - a.startIdx));
  return wins;
}
