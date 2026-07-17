/*
 * The "why" panel. Click an hour, see the verdict: every constraint's
 * measured value, its sub-score as a small bar, and the limiting factor
 * named in plain words. No black boxes.
 *
 * Part of kairos. AGPL-3.0-or-later.
 */

import type { Activity, Forecast, HourScore, Units } from '../types';
import type { DerivedHour } from '../lib/score';
import { bandScore, metricValue } from '../lib/score';
import { METRIC_LABEL, fmtMetric, fmtPrecip, metricDim, toDisplay, unitSuffix } from '../lib/units';
import { moonPhaseName } from '../lib/lunar';
import { skyState } from '../lib/solar';
import { fmt } from '../lib/time';

interface Props {
  forecast: Forecast;
  derived: DerivedHour[];
  idx: number;
  activity: Activity;
  score?: HourScore;
  units: Units;
  onClose: () => void;
}

const SKY_LABEL: Record<string, string> = {
  day: 'daylight',
  golden: 'golden hour',
  twilight: 'twilight',
  night: 'night',
};

export default function HourDetail({ forecast, derived, idx, activity, score, units, onClose }: Props) {
  const h = forecast.hours[idx];
  const d = derived[idx];
  const tz = forecast.timezone;
  const pct = Math.round((score?.s ?? 0) * 100);

  const rows = activity.constraints.map((c) => {
    const v = metricValue(forecast, derived, idx, c.metric);
    const s = bandScore(v, c);
    const limiting = score?.limiting === c.metric && s < 0.995;
    let note = '';
    if (s === 0) {
      if (c.hardMin !== undefined && v < c.hardMin) note = `below ${fmtBound(c.metric, c.hardMin, units)}`;
      else if (c.hardMax !== undefined && v > c.hardMax) note = `above ${fmtBound(c.metric, c.hardMax, units)}`;
    } else if (s < 1) {
      if (c.idealMin !== undefined && v < c.idealMin) note = 'under ideal';
      else if (c.idealMax !== undefined && v > c.idealMax) note = 'over ideal';
    }
    return { c, v, s, limiting, note };
  });

  return (
    <aside className="hourdetail" aria-label="Hour detail">
      <div className="hd-head">
        <div>
          <h3>{fmt(h.t, tz, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric' })}</h3>
          <p className="muted">
            {SKY_LABEL[skyState(d.sunAlt)]} · sun {d.sunAlt >= 0 ? '+' : ''}
            {d.sunAlt.toFixed(0)}° · moon {Math.round(d.moonLight)}% ({moonPhaseName(h.t)})
          </p>
        </div>
        <div className="hd-score">
          <span className="hd-score-num">{pct}</span>
          <span className="hd-score-label">fit for {activity.name.toLowerCase()}</span>
        </div>
        <button className="ghost" onClick={onClose} aria-label="Close detail">✕</button>
      </div>

      <div className="hd-conditions muted">
        {fmtMetric('temp', h.temp, units)} (feels {fmtMetric('feels', h.feels, units)}) ·
        wind {fmtMetric('wind', h.wind, units)}, gusts {fmtMetric('gusts', h.gusts, units)} ·
        rain {Math.round(h.precipProb)}% / {fmtPrecip(h.precip, units)} ·
        cloud {Math.round(h.cloud)}% · humidity {Math.round(h.humidity)}% · UV {h.uv.toFixed(1)}
      </div>

      <ul className="hd-rows">
        {rows.map(({ c, v, s, limiting, note }, i) => (
          <li key={i} className={limiting ? 'hd-row limiting' : 'hd-row'}>
            <span className="hd-metric">
              {METRIC_LABEL[c.metric]}
              {limiting && <span className="hd-flag"> ← limiting</span>}
            </span>
            <span className="hd-value">
              {fmtMetric(c.metric, v, units)}
              {note ? <span className="hd-note"> · {note}</span> : null}
            </span>
            <span className="hd-bar" aria-hidden="true">
              <span className="hd-bar-fill" style={{ width: `${Math.round(s * 100)}%` }} />
            </span>
            <span className="hd-sub">{Math.round(s * 100)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function fmtBound(m: Parameters<typeof fmtMetric>[0], v: number, u: Units): string {
  const dim = metricDim(m);
  return `${Math.round(toDisplay(dim, v, u))}${unitSuffix(dim, u)}`;
}
