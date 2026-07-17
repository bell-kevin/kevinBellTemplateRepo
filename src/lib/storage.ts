/*
 * Local-first persistence. Your places, activities, and cached forecast
 * never leave the browser. Versioned keys so future schema changes can
 * migrate cleanly.
 *
 * Part of kairos. AGPL-3.0-or-later.
 */

import type { Activity, Forecast, Place, Units } from '../types';
import { PRESETS } from '../data/presets';

const SETTINGS_KEY = 'kairos.settings.v1';
const CACHE_KEY = 'kairos.forecast.v1';

export interface Settings {
  units: Units;
  place: Place | null;
  activities: Activity[];
}

function defaultUnits(): Units {
  const lang = navigator.language || '';
  return /-(US|LR|MM)$/i.test(lang) ? 'imperial' : 'metric';
}

export function loadSettings(): Settings {
  let stored: Partial<Settings> | null = null;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    stored = null;
  }

  const activities = mergePresets(stored?.activities ?? []);
  return {
    units: stored?.units === 'metric' || stored?.units === 'imperial' ? stored.units : defaultUnits(),
    place: stored?.place ?? null,
    activities,
  };
}

/** Keep user edits and custom activities; append any new builtin presets. */
function mergePresets(saved: Activity[]): Activity[] {
  if (saved.length === 0) return PRESETS.map((p) => ({ ...p, constraints: p.constraints.map((c) => ({ ...c })) }));
  const have = new Set(saved.map((a) => a.id));
  const merged = [...saved];
  for (const p of PRESETS) {
    if (!have.has(p.id)) merged.push({ ...p, constraints: p.constraints.map((c) => ({ ...c })) });
  }
  return merged;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage full or unavailable — the app still works for this session */
  }
}

export function loadCachedForecast(): Forecast | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Forecast) : null;
  } catch {
    return null;
  }
}

export function saveCachedForecast(fc: Forecast): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(fc));
  } catch {
    /* ignore */
  }
}

/** Export the user's activities as a shareable JSON file. */
export function downloadActivitiesJson(activities: Activity[]): void {
  const blob = new Blob([JSON.stringify({ kairos: 1, activities }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kairos-activities.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
