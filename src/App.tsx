/*
 * kairos — find the opportune hour.
 * Part of kairos. AGPL-3.0-or-later.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Activity, Forecast, HourScore, Place, Window } from './types';
import {
  loadCachedForecast,
  loadSettings,
  saveCachedForecast,
  saveSettings,
  type Settings,
} from './lib/storage';
import { fetchForecast } from './lib/weather';
import { deriveHours, findWindows, scoreActivity, type DerivedHour } from './lib/score';
import Digest from './components/Digest';
import WeekGrid from './components/WeekGrid';
import HourDetail from './components/HourDetail';
import Activities from './components/Activities';
import LocationSetup from './components/LocationSetup';

const CACHE_FRESH_MS = 60 * 60 * 1000;

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string };

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'idle' });
  const [stale, setStale] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailIdx, setDetailIdx] = useState<number | null>(null);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => saveSettings(settings), [settings]);

  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const refresh = useCallback(async (place: Place) => {
    setFetchState({ kind: 'loading' });
    try {
      const fc = await fetchForecast(place);
      setForecast(fc);
      setStale(false);
      saveCachedForecast(fc);
      setFetchState({ kind: 'idle' });
    } catch (e) {
      const cached = loadCachedForecast();
      if (cached && samePlace(cached.place, place)) {
        setForecast(cached);
        setStale(true);
      }
      setFetchState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Could not reach the forecast service.',
      });
    }
  }, []);

  // Load cache or fetch when the place changes.
  const placeKey = settings.place ? `${settings.place.lat},${settings.place.lon}` : '';
  useEffect(() => {
    const place = settings.place;
    if (!place) return;
    const cached = loadCachedForecast();
    if (cached && samePlace(cached.place, place)) {
      setForecast(cached);
      const fresh = Date.now() - cached.fetchedAt < CACHE_FRESH_MS;
      setStale(!fresh);
      if (fresh) return;
    }
    void refresh(place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey, refresh]);

  const derived: DerivedHour[] | null = useMemo(
    () => (forecast ? deriveHours(forecast) : null),
    [forecast],
  );

  const enabled = settings.activities.filter((a) => a.enabled);

  // Score every enabled activity across the whole forecast.
  const scores: Map<string, HourScore[]> = useMemo(() => {
    const m = new Map<string, HourScore[]>();
    if (forecast && derived) {
      for (const a of enabled) m.set(a.id, scoreActivity(forecast, derived, a));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecast, derived, settings.activities]);

  // First hour that hasn't fully passed.
  const nowIdx = useMemo(() => {
    if (!forecast) return 0;
    const i = forecast.hours.findIndex((h) => h.t + 3600 > nowSec);
    return i < 0 ? forecast.hours.length : i;
  }, [forecast, nowSec]);

  const windows: Map<string, Window[]> = useMemo(() => {
    const m = new Map<string, Window[]>();
    if (!forecast) return m;
    const from = Math.max(nowIdx, forecast.firstTodayIdx);
    for (const a of enabled) {
      const s = scores.get(a.id);
      if (s) m.set(a.id, findWindows(s, from, a.minHours));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, nowIdx, forecast]);

  const selected: Activity | null =
    enabled.find((a) => a.id === selectedId) ?? enabled[0] ?? null;

  const selectActivity = (id: string) => {
    setSelectedId(id);
    setDetailIdx(null);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updatedAgo = forecast
    ? Math.max(0, Math.round((Date.now() - forecast.fetchedAt) / 60000))
    : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="wordmark">
          <svg viewBox="0 0 64 64" aria-hidden="true" className="mark">
            <circle
              cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="7"
              strokeLinecap="round" strokeDasharray="103 35" transform="rotate(-56 32 32)"
            />
            <path className="mark-star" d="M49 8.5l2.1 4.6 4.6 2.1-4.6 2.1L49 22l-2.1-4.7-4.6-2.1 4.6-2.1z" />
          </svg>
          <h1>kairos</h1>
          <span className="tagline">the opportune hour</span>
        </div>
        <div className="topbar-actions">
          {settings.place && (
            <button className="ghost" onClick={() => setPlaceOpen(true)}>
              ◎ {settings.place.name}
            </button>
          )}
          <button
            className="ghost"
            onClick={() =>
              setSettings((s) => ({ ...s, units: s.units === 'imperial' ? 'metric' : 'imperial' }))
            }
            aria-label="Switch units"
          >
            {settings.units === 'imperial' ? '°F' : '°C'}
          </button>
        </div>
      </header>

      {!settings.place ? (
        <LocationSetup
          hero
          onPick={(p) => {
            setSettings((s) => ({ ...s, place: p }));
            setPlaceOpen(false);
          }}
          onClose={() => setPlaceOpen(false)}
        />
      ) : (
        <>
          {placeOpen && (
            <LocationSetup
              onPick={(p) => {
                setForecast(null);
                setSettings((s) => ({ ...s, place: p }));
                setPlaceOpen(false);
              }}
              onClose={() => setPlaceOpen(false)}
            />
          )}

          <div className="statusline">
            {fetchState.kind === 'loading' && <span>Reading the sky…</span>}
            {fetchState.kind === 'error' && (
              <span className="err">
                {stale ? 'Offline — showing your last saved forecast. ' : ''}
                {fetchState.message}{' '}
              </span>
            )}
            {fetchState.kind !== 'loading' && updatedAgo !== null && (
              <span className="muted">
                {stale ? 'saved ' : 'updated '}
                {updatedAgo < 1 ? 'just now' : `${updatedAgo} min ago`}
              </span>
            )}
            {fetchState.kind !== 'loading' && settings.place && (
              <button className="linklike" onClick={() => settings.place && void refresh(settings.place)}>
                refresh
              </button>
            )}
          </div>

          {forecast && derived && (
            <>
              <Digest
                activities={enabled}
                windows={windows}
                forecast={forecast}
                units={settings.units}
                selectedId={selected?.id ?? null}
                onSelect={selectActivity}
              />

              <div ref={gridRef}>
                {selected && (
                  <WeekGrid
                    forecast={forecast}
                    derived={derived}
                    activity={selected}
                    activities={enabled}
                    scores={scores.get(selected.id) ?? []}
                    windows={(windows.get(selected.id) ?? []).slice(0, 3)}
                    nowSec={nowSec}
                    onPickActivity={setSelectedId}
                    onPickHour={setDetailIdx}
                    pickedHour={detailIdx}
                  />
                )}
              </div>

              {selected && detailIdx !== null && forecast.hours[detailIdx] && (
                <HourDetail
                  forecast={forecast}
                  derived={derived}
                  idx={detailIdx}
                  activity={selected}
                  score={scores.get(selected.id)?.[detailIdx]}
                  units={settings.units}
                  onClose={() => setDetailIdx(null)}
                />
              )}
            </>
          )}

          <Activities
            activities={settings.activities}
            units={settings.units}
            onChange={(acts) => setSettings((s) => ({ ...s, activities: acts }))}
          />
        </>
      )}

      <footer className="footer">
        <p>
          Weather by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0) ·
          sun &amp; moon computed in your browser · your data stays on this device.
        </p>
        <p>
          kairos is free software under the{' '}
          <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer">
            AGPL-3.0
          </a>{' '}
          ·{' '}
          <a href="https://github.com/bell-kevin/kairos" target="_blank" rel="noreferrer">
            source
          </a>
        </p>
      </footer>
    </div>
  );
}

function samePlace(a: Place, b: Place): boolean {
  return Math.abs(a.lat - b.lat) < 0.001 && Math.abs(a.lon - b.lon) < 0.001;
}
