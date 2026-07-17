/*
 * Display-edge unit conversion. Storage and scoring are always canonical
 * metric (°C, km/h, mm); these helpers convert for eyes and inputs only.
 *
 * Part of kairos. AGPL-3.0-or-later.
 */

import type { MetricId, Units } from '../types';

export type Dim = 'temperature' | 'speed' | 'percent' | 'index' | 'degrees' | 'hours';

export function metricDim(m: MetricId): Dim {
  switch (m) {
    case 'temp':
    case 'feels':
      return 'temperature';
    case 'wind':
    case 'gusts':
      return 'speed';
    case 'precipProb':
    case 'cloud':
    case 'humidity':
    case 'moonLight':
      return 'percent';
    case 'uv':
      return 'index';
    case 'sunAlt':
      return 'degrees';
    case 'hoursSinceRain':
    case 'hoursUntilRain':
      return 'hours';
  }
}

export const METRIC_LABEL: Record<MetricId, string> = {
  temp: 'Temperature',
  feels: 'Feels like',
  precipProb: 'Rain chance',
  cloud: 'Cloud cover',
  wind: 'Wind',
  gusts: 'Gusts',
  humidity: 'Humidity',
  uv: 'UV index',
  sunAlt: 'Sun altitude',
  moonLight: 'Moonlight',
  hoursSinceRain: 'Dry hours behind',
  hoursUntilRain: 'Dry hours ahead',
};

const cToF = (c: number) => (c * 9) / 5 + 32;
const fToC = (f: number) => ((f - 32) * 5) / 9;
const kmhToMph = (k: number) => k / 1.609344;
const mphToKmh = (m: number) => m * 1.609344;

/** Canonical metric → display number. */
export function toDisplay(dim: Dim, v: number, u: Units): number {
  if (u === 'imperial') {
    if (dim === 'temperature') return cToF(v);
    if (dim === 'speed') return kmhToMph(v);
  }
  return v;
}

/** Display number → canonical metric. */
export function fromDisplay(dim: Dim, v: number, u: Units): number {
  if (u === 'imperial') {
    if (dim === 'temperature') return fToC(v);
    if (dim === 'speed') return mphToKmh(v);
  }
  return v;
}

export function unitSuffix(dim: Dim, u: Units): string {
  switch (dim) {
    case 'temperature':
      return u === 'imperial' ? '°F' : '°C';
    case 'speed':
      return u === 'imperial' ? ' mph' : ' km/h';
    case 'percent':
      return '%';
    case 'index':
      return '';
    case 'degrees':
      return '°';
    case 'hours':
      return ' h';
  }
}

/** Format a canonical value for display, with unit. */
export function fmtMetric(m: MetricId, v: number, u: Units): string {
  const dim = metricDim(m);
  const dv = toDisplay(dim, v, u);
  const digits = dim === 'index' ? 1 : 0;
  return `${dv.toFixed(digits)}${unitSuffix(dim, u)}`;
}

export function fmtPrecip(mm: number, u: Units): string {
  return u === 'imperial' ? `${(mm / 25.4).toFixed(2)} in` : `${mm.toFixed(1)} mm`;
}
