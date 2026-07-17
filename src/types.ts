/*
 * kairos — find the opportune hour
 * Copyright (C) 2026
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.  See LICENSE.
 */

export type Units = 'imperial' | 'metric';

export interface Place {
  name: string;
  region?: string;
  lat: number;
  lon: number;
}

/**
 * Everything an hour can be judged by. All values are canonical metric
 * (°C, km/h, mm, %) regardless of display units.
 *
 *  temp / feels      air & apparent temperature, °C
 *  precipProb        chance of precipitation, %
 *  cloud             total cloud cover, %
 *  wind / gusts      10 m wind speed / gusts, km/h
 *  humidity          relative humidity, %
 *  uv                UV index
 *  sunAlt            solar altitude above horizon, degrees (computed locally)
 *  moonLight         moon illuminated fraction, % (computed locally)
 *  hoursSinceRain    dry spell looking back (capped at 48 h)
 *  hoursUntilRain    dry spell looking ahead (capped at 48 h)
 */
export type MetricId =
  | 'temp'
  | 'feels'
  | 'precipProb'
  | 'cloud'
  | 'wind'
  | 'gusts'
  | 'humidity'
  | 'uv'
  | 'sunAlt'
  | 'moonLight'
  | 'hoursSinceRain'
  | 'hoursUntilRain';

/**
 * A trapezoid band. Score is 1 inside [idealMin, idealMax], falls linearly
 * to 0 at hardMin / hardMax, and is 0 outside the hard bounds. Any side may
 * be omitted (unbounded). This one shape expresses "not too hot", "some
 * breeze is good", "at least 6 dry hours", and "golden hour only".
 */
export interface Constraint {
  metric: MetricId;
  hardMin?: number;
  hardMax?: number;
  idealMin?: number;
  idealMax?: number;
  /** Relative importance when combining (default 1). */
  weight?: number;
}

export interface Activity {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  /** Minimum contiguous hours for a window to count. */
  minHours: number;
  constraints: Constraint[];
  builtin?: boolean;
}

/** One hour of weather, canonical metric units. `t` is unix seconds. */
export interface HourPoint {
  t: number;
  temp: number;
  feels: number;
  precipProb: number;
  precip: number;
  cloud: number;
  wind: number;
  gusts: number;
  humidity: number;
  uv: number;
}

export interface Forecast {
  place: Place;
  fetchedAt: number;
  timezone: string;
  utcOffsetSeconds: number;
  hours: HourPoint[];
  /** Index of the first hour belonging to "today" (past_days excluded). */
  firstTodayIdx: number;
}

/** Per-hour evaluation of one activity. */
export interface HourScore {
  /** 0..1 combined score, 0 if any hard bound is violated. */
  s: number;
  /** Metric that contributed the lowest sub-score (the limiting factor). */
  limiting?: MetricId;
}

export interface Window {
  startIdx: number;
  /** Inclusive index of the last hour in the window. */
  endIdx: number;
  avg: number;
  peak: number;
}
