/*
 * Weather data via Open-Meteo (https://open-meteo.com) — a keyless, CORS-open
 * API whose server software is itself AGPL-licensed. Data is CC BY 4.0;
 * kairos credits it in the footer. Everything is stored in canonical metric
 * and converted only at the display edge.
 *
 * Part of kairos. AGPL-3.0-or-later.
 */

import type { Forecast, HourPoint, Place } from '../types';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'cloud_cover',
  'wind_speed_10m',
  'wind_gusts_10m',
  'relative_humidity_2m',
  'uv_index',
].join(',');

/** Fetch a 7-day hourly forecast plus 2 past days (for dry-spell lookback). */
export async function fetchForecast(place: Place): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: place.lat.toFixed(4),
    longitude: place.lon.toFixed(4),
    hourly: HOURLY_VARS,
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '7',
    past_days: '2',
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Forecast request failed (${res.status})`);
  const j = await res.json();

  const h = j.hourly;
  const n: number = h.time.length;
  const num = (arr: unknown[] | undefined, i: number): number => {
    const v = arr?.[i];
    return typeof v === 'number' && isFinite(v) ? v : 0;
  };

  const hours: HourPoint[] = [];
  for (let i = 0; i < n; i++) {
    hours.push({
      t: h.time[i],
      temp: num(h.temperature_2m, i),
      feels: num(h.apparent_temperature, i),
      precipProb: num(h.precipitation_probability, i),
      precip: num(h.precipitation, i),
      cloud: num(h.cloud_cover, i),
      wind: num(h.wind_speed_10m, i),
      gusts: num(h.wind_gusts_10m, i),
      humidity: num(h.relative_humidity_2m, i),
      uv: num(h.uv_index, i),
    });
  }

  // First hour of "today" = start of day 2 (0-indexed) since past_days=2.
  const firstTodayIdx = Math.min(48, hours.length);

  return {
    place,
    fetchedAt: Date.now(),
    timezone: typeof j.timezone === 'string' ? j.timezone : 'UTC',
    utcOffsetSeconds: typeof j.utc_offset_seconds === 'number' ? j.utc_offset_seconds : 0,
    hours,
    firstTodayIdx,
  };
}

export interface GeoResult extends Place {
  country?: string;
}

/** Search place names via Open-Meteo's geocoder. */
export async function geocode(query: string): Promise<GeoResult[]> {
  const params = new URLSearchParams({
    name: query,
    count: '6',
    language: 'en',
    format: 'json',
  });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const j = await res.json();
  const results: GeoResult[] = [];
  for (const r of j.results ?? []) {
    results.push({
      name: r.name,
      region: [r.admin1, r.country_code].filter(Boolean).join(', '),
      lat: r.latitude,
      lon: r.longitude,
    });
  }
  return results;
}

/** Browser geolocation wrapped in a promise. */
export function locateMe(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        resolve({
          name: 'My location',
          region: `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
          lat: latitude,
          lon: longitude,
        });
      },
      (err) => reject(new Error(err.message || 'Could not get your location.')),
      { timeout: 12000, maximumAge: 600000 },
    );
  });
}
