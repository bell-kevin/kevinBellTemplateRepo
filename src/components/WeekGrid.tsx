/*
 * The week chart. Rows are days, columns are hours. Three layers of
 * information share each cell: the slate underlay shows the actual sky
 * (night / twilight / golden / day, from the solar math), the teal ink
 * density shows the activity fit, and a thin brass "aperture" rings the
 * best windows. Darkness is drawn, not implied.
 *
 * Part of kairos. AGPL-3.0-or-later.
 */

import { useMemo } from 'react';
import type { Activity, Forecast, HourScore, Window } from '../types';
import type { DerivedHour } from '../lib/score';
import { skyState, sunTimesForDay } from '../lib/solar';
import { dayKey, fmt, fmtClock, fmtDayHour, hourOfDay } from '../lib/time';

interface Props {
  forecast: Forecast;
  derived: DerivedHour[];
  activity: Activity;
  activities: Activity[];
  scores: HourScore[];
  windows: Window[]; // top few, rank order
  nowSec: number;
  pickedHour: number | null;
  onPickActivity: (id: string) => void;
  onPickHour: (idx: number) => void;
}

interface DayRow {
  key: string;
  label: string;
  sub: string;
  slots: (number | null)[]; // hour-of-day → forecast index
  sun: string;
}

export default function WeekGrid(props: Props) {
  const { forecast, derived, activity, activities, scores, windows } = props;
  const tz = forecast.timezone;

  const days: DayRow[] = useMemo(() => {
    const rows: DayRow[] = [];
    let cur: DayRow | null = null;
    for (let i = forecast.firstTodayIdx; i < forecast.hours.length; i++) {
      const t = forecast.hours[i].t;
      const k = dayKey(t, tz);
      if (!cur || cur.key !== k) {
        const hod = hourOfDay(t, tz);
        const dayStart = t - hod * 3600;
        const st = sunTimesForDay(dayStart, forecast.place.lat, forecast.place.lon);
        const sun =
          st.sunrise !== null && st.sunset !== null
            ? `↑${fmtClock(st.sunrise, tz)} ↓${fmtClock(st.sunset, tz)}`
            : ''; // polar day/night: no crossing to show
        cur = {
          key: k,
          label: fmt(t, tz, { weekday: 'short' }),
          sub: fmt(t, tz, { month: 'numeric', day: 'numeric' }),
          slots: new Array<number | null>(24).fill(null),
          sun,
        };
        rows.push(cur);
      }
      cur.slots[hourOfDay(t, tz)] = i;
    }
    return rows;
  }, [forecast, tz]);

  // Which cells belong to a ringed window, and where in the run they sit.
  const winCells = useMemo(() => {
    const m = new Map<number, { pos: 'solo' | 'start' | 'mid' | 'end'; rank: number }>();
    windows.forEach((w, rank) => {
      for (let i = w.startIdx; i <= w.endIdx; i++) {
        const pos =
          w.startIdx === w.endIdx
            ? 'solo'
            : i === w.startIdx
              ? 'start'
              : i === w.endIdx
                ? 'end'
                : 'mid';
        if (!m.has(i)) m.set(i, { pos, rank });
      }
    });
    return m;
  }, [windows]);

  const hourMarks = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => ({
    h,
    label: h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`,
  }));

  return (
    <section className="weekgrid" aria-label="Week chart">
      <div className="tabs" role="tablist" aria-label="Activities">
        {activities.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={a.id === activity.id}
            className={a.id === activity.id ? 'tab selected' : 'tab'}
            onClick={() => props.onPickActivity(a.id)}
          >
            <span aria-hidden="true">{a.icon}</span> {a.name}
          </button>
        ))}
      </div>

      <div className="grid-scroll">
        <div className="grid">
          <div className="grid-row grid-head">
            <div className="day-label" aria-hidden="true" />
            {Array.from({ length: 24 }, (_, h) => {
              const mark = hourMarks.find((m) => m.h === h);
              return (
                <div key={h} className="hour-mark">
                  {mark ? mark.label : ''}
                </div>
              );
            })}
          </div>

          {days.map((d) => (
            <div className="grid-row" key={d.key}>
              <div className="day-label">
                <span className="day-name">
                  {d.label} <span className="day-date">{d.sub}</span>
                </span>
                <span className="day-sun">{d.sun}</span>
              </div>
              {d.slots.map((idx, h) => {
                if (idx === null) return <div key={h} className="cell empty" />;
                const s = scores[idx]?.s ?? 0;
                const sky = skyState(derived[idx].sunAlt);
                const past = forecast.hours[idx].t + 3600 <= props.nowSec;
                const isNow =
                  forecast.hours[idx].t <= props.nowSec &&
                  props.nowSec < forecast.hours[idx].t + 3600;
                const win = winCells.get(idx);
                const cls = [
                  'cell',
                  `sky-${sky}`,
                  past ? 'past' : '',
                  win ? `win win-${win.pos}` : '',
                  isNow ? 'nowcell' : '',
                  props.pickedHour === idx ? 'picked' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                const alpha = past ? 0 : Math.pow(s, 1.35) * 0.92;
                return (
                  <button
                    key={h}
                    className={cls}
                    style={{ ['--s' as string]: alpha }}
                    title={`${fmtDayHour(forecast.hours[idx].t, tz)} — fit ${Math.round(s * 100)}/100`}
                    aria-label={`${fmtDayHour(forecast.hours[idx].t, tz)}, fit ${Math.round(s * 100)} out of 100`}
                    onClick={() => props.onPickHour(idx)}
                  >
                    {win && win.rank === 0 && (win.pos === 'start' || win.pos === 'solo') ? (
                      <span className="cell-star" aria-hidden="true">✶</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="legend muted">
        ink = fit for “{activity.name}” · shaded columns = twilight &amp; night ·{' '}
        <span className="legend-ring">ringed</span> = best windows · tap an hour for the why
      </p>
    </section>
  );
}
