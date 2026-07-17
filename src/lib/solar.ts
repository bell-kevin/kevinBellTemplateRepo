/*
 * Solar position, from the NOAA low-accuracy equations (Spencer 1971 /
 * NOAA Solar Calculator). Good to roughly ±0.2°, which is a minute or two
 * of sunrise — plenty for deciding when to go for a run.
 *
 * Part of kairos. AGPL-3.0-or-later.
 */

const RAD = Math.PI / 180;

/** Sun altitude above the horizon in degrees at a unix time (seconds). */
export function sunAltitudeDeg(unixSec: number, lat: number, lon: number): number {
  const d = new Date(unixSec * 1000);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const doy = Math.floor((unixSec * 1000 - yearStart) / 86400000); // 0-based
  const hourUTC =
    d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;

  // Fractional year, radians.
  const g = ((2 * Math.PI) / 365) * (doy + (hourUTC - 12) / 24);

  // Equation of time (minutes) and solar declination (radians).
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);

  // True solar time (minutes), then hour angle (degrees from solar noon).
  const tst = (hourUTC * 60 + eqtime + 4 * lon + 2880) % 1440;
  const ha = tst / 4 - 180;

  const sinAlt =
    Math.sin(lat * RAD) * Math.sin(decl) +
    Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(ha * RAD);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / RAD;
}

export interface SunTimes {
  /** Unix seconds, or null in polar day/night. */
  sunrise: number | null;
  sunset: number | null;
}

/**
 * Sunrise/sunset within [dayStart, dayStart + 24h). Scans at 10-minute
 * resolution and refines each horizon crossing by linear interpolation.
 */
export function sunTimesForDay(
  dayStartSec: number,
  lat: number,
  lon: number,
): SunTimes {
  const STEP = 600; // 10 minutes
  let sunrise: number | null = null;
  let sunset: number | null = null;
  let prevAlt = sunAltitudeDeg(dayStartSec, lat, lon);

  for (let t = dayStartSec + STEP; t <= dayStartSec + 86400; t += STEP) {
    const alt = sunAltitudeDeg(t, lat, lon);
    if (prevAlt < 0 && alt >= 0 && sunrise === null) {
      const f = -prevAlt / (alt - prevAlt);
      sunrise = t - STEP + f * STEP;
    } else if (prevAlt >= 0 && alt < 0 && sunset === null) {
      const f = prevAlt / (prevAlt - alt);
      sunset = t - STEP + f * STEP;
    }
    prevAlt = alt;
  }
  return { sunrise, sunset };
}

/** Rough label for the sky state at a given altitude. */
export function skyState(altDeg: number): 'day' | 'golden' | 'twilight' | 'night' {
  if (altDeg > 6) return 'day';
  if (altDeg > -0.5) return 'golden';
  if (altDeg > -6) return 'twilight';
  return 'night';
}
