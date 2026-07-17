/*
 * Part of kairos. AGPL-3.0-or-later.
 */

import { useState } from 'react';
import type { Place } from '../types';
import { geocode, locateMe, type GeoResult } from '../lib/weather';

interface Props {
  hero?: boolean;
  onPick: (p: Place) => void;
  onClose: () => void;
}

export default function LocationSetup({ hero, onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setError(null);
    try {
      const r = await geocode(query);
      setResults(r);
      if (r.length === 0) setError('No places matched. Try a nearby city name.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const useGps = async () => {
    setBusy(true);
    setError(null);
    try {
      onPick(await locateMe());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get your location.');
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <div className={hero ? 'setup hero-setup' : 'setup'}>
      {hero && (
        <div className="hero-copy">
          <p className="hero-lede">
            The Greeks had two words for time. <em>Chronos</em> is the kind that passes.{' '}
            <strong>Kairos</strong> is the opening — the right hour for the thing.
          </p>
          <p className="hero-sub">
            kairos scores every hour of your week against what each activity actually
            needs — temperature, wind, dry spells, daylight, even moonlight — and shows
            you the windows. Pick a place to start.
          </p>
        </div>
      )}
      <div className="setup-row">
        <input
          type="text"
          value={q}
          placeholder="Search a city or town…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
          autoFocus
        />
        <button onClick={() => void search()} disabled={busy}>
          Search
        </button>
        <button className="secondary" onClick={() => void useGps()} disabled={busy}>
          Use my location
        </button>
      </div>
      {error && <p className="err">{error}</p>}
      {results.length > 0 && (
        <ul className="setup-results">
          {results.map((r, i) => (
            <li key={i}>
              <button onClick={() => onPick(r)}>
                <strong>{r.name}</strong>
                {r.region ? <span className="muted"> — {r.region}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (hero) return body;
  return (
    <div className="modal-scrim" onClick={onClose} role="dialog" aria-label="Choose a place">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Choose a place</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {body}
      </div>
    </div>
  );
}
