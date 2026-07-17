/*
 * "This week's openings" — the reason the app exists, rendered as content.
 * One line per activity: its single best window, the score, and a button
 * that drops the window straight onto your calendar.
 *
 * Part of kairos. AGPL-3.0-or-later.
 */

import type { Activity, Forecast, Units, Window } from '../types';
import { downloadIcs, fmtWindowRange } from '../lib/time';

interface Props {
  activities: Activity[];
  windows: Map<string, Window[]>;
  forecast: Forecast;
  units: Units;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Digest({ activities, windows, forecast, selectedId, onSelect }: Props) {
  const tz = forecast.timezone;

  const addToCalendar = (a: Activity, w: Window) => {
    const start = forecast.hours[w.startIdx].t;
    const end = forecast.hours[w.endIdx].t + 3600;
    downloadIcs({
      title: a.name,
      description: `A kairos window — fit ${Math.round(w.avg * 100)}/100 for “${a.name}” given your conditions.`,
      location: forecast.place.name,
      startSec: start,
      endSec: end,
    });
  };

  return (
    <section className="digest" aria-label="This week's openings">
      <h2 className="section-title">This week’s openings</h2>
      <ul className="digest-list">
        {activities.map((a) => {
          const best = windows.get(a.id)?.[0];
          const isSel = a.id === selectedId;
          return (
            <li key={a.id}>
              <button
                className={isSel ? 'opening selected' : 'opening'}
                onClick={() => onSelect(a.id)}
                aria-pressed={isSel}
              >
                <span className="opening-icon" aria-hidden="true">{a.icon}</span>
                <span className="opening-name">{a.name}</span>
                {best ? (
                  <>
                    <span className="opening-when">
                      {fmtWindowRange(
                        forecast.hours[best.startIdx].t,
                        forecast.hours[best.endIdx].t + 3600,
                        tz,
                      )}
                    </span>
                    <span className="opening-score">
                      <span className="star" aria-hidden="true">✶</span>
                      {Math.round(best.avg * 100)}
                    </span>
                  </>
                ) : (
                  <span className="opening-none">no opening this week</span>
                )}
              </button>
              {best && (
                <button
                  className="cal-btn"
                  title="Add this window to your calendar"
                  aria-label={`Add ${a.name} window to calendar`}
                  onClick={() => addToCalendar(a, best)}
                >
                  + cal
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {activities.length === 0 && (
        <p className="muted">No activities enabled — turn some on below.</p>
      )}
    </section>
  );
}
