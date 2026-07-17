/*
 * The activity library editor. Every preset is just data: a name, a
 * minimum window length, and a stack of trapezoid bands. Edit any bound,
 * invert a band (breeze is good for laundry), add your own activities,
 * and share the whole library as JSON.
 *
 * Part of kairos. AGPL-3.0-or-later.
 */

import { useRef, useState } from 'react';
import type { Activity, Constraint, MetricId, Units } from '../types';
import { METRIC_LABEL, fromDisplay, metricDim, toDisplay, unitSuffix } from '../lib/units';
import { PRESETS } from '../data/presets';
import { downloadActivitiesJson } from '../lib/storage';

interface Props {
  activities: Activity[];
  units: Units;
  onChange: (a: Activity[]) => void;
}

const ALL_METRICS = Object.keys(METRIC_LABEL) as MetricId[];

export default function Activities({ activities, units, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const update = (id: string, patch: Partial<Activity>) =>
    onChange(activities.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const updateConstraint = (id: string, ci: number, patch: Partial<Constraint>) =>
    onChange(
      activities.map((a) =>
        a.id === id
          ? { ...a, constraints: a.constraints.map((c, i) => (i === ci ? { ...c, ...patch } : c)) }
          : a,
      ),
    );

  const removeConstraint = (id: string, ci: number) =>
    onChange(
      activities.map((a) =>
        a.id === id ? { ...a, constraints: a.constraints.filter((_, i) => i !== ci) } : a,
      ),
    );

  const addConstraint = (id: string, metric: MetricId) =>
    onChange(
      activities.map((a) =>
        a.id === id ? { ...a, constraints: [...a.constraints, { metric }] } : a,
      ),
    );

  const addActivity = () => {
    const a: Activity = {
      id: `custom-${Date.now().toString(36)}`,
      name: 'New activity',
      icon: '✳',
      enabled: true,
      minHours: 1,
      constraints: [
        { metric: 'feels', hardMin: 4.4, idealMin: 12.8, idealMax: 25.6, hardMax: 32.2 },
        { metric: 'precipProb', idealMax: 20, hardMax: 50 },
      ],
    };
    onChange([...activities, a]);
    setExpanded(a.id);
    setOpen(true);
  };

  const duplicate = (a: Activity) => {
    const copy: Activity = {
      ...a,
      id: `custom-${Date.now().toString(36)}`,
      name: `${a.name} (copy)`,
      builtin: false,
      constraints: a.constraints.map((c) => ({ ...c })),
    };
    onChange([...activities, copy]);
    setExpanded(copy.id);
  };

  const remove = (id: string) => onChange(activities.filter((a) => a.id !== id));

  const restoreDefaults = () => {
    const customs = activities.filter((a) => !PRESETS.some((p) => p.id === a.id));
    onChange([
      ...PRESETS.map((p) => ({ ...p, constraints: p.constraints.map((c) => ({ ...c })) })),
      ...customs,
    ]);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming: Activity[] = Array.isArray(parsed?.activities) ? parsed.activities : [];
        if (incoming.length === 0) return;
        const byId = new Map(activities.map((a) => [a.id, a]));
        for (const a of incoming) {
          if (a && typeof a.id === 'string' && Array.isArray(a.constraints)) byId.set(a.id, a);
        }
        onChange([...byId.values()]);
      } catch {
        /* unreadable file — leave the library as it is */
      }
    };
    reader.readAsText(file);
  };

  return (
    <section className="activities">
      <button className="section-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <h2 className="section-title">Activities &amp; conditions</h2>
        <span className="muted">{open ? 'hide' : `${activities.filter((a) => a.enabled).length} on · edit`}</span>
      </button>

      {open && (
        <>
          <ul className="act-list">
            {activities.map((a) => (
              <li key={a.id} className="act">
                <div className="act-row">
                  <label className="act-enable">
                    <input
                      type="checkbox"
                      checked={a.enabled}
                      onChange={(e) => update(a.id, { enabled: e.target.checked })}
                    />
                    <span aria-hidden="true">{a.icon}</span>
                    <span className="act-name">{a.name}</span>
                  </label>
                  <span className="muted act-meta">
                    {a.constraints.length} conditions · ≥{a.minHours} h
                  </span>
                  <button
                    className="linklike"
                    onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  >
                    {expanded === a.id ? 'done' : 'edit'}
                  </button>
                </div>

                {expanded === a.id && (
                  <div className="act-edit">
                    <div className="act-fields">
                      <label>
                        Name
                        <input
                          type="text"
                          defaultValue={a.name}
                          onBlur={(e) => update(a.id, { name: e.target.value || a.name })}
                        />
                      </label>
                      <label>
                        Icon
                        <input
                          type="text"
                          className="icon-input"
                          defaultValue={a.icon}
                          maxLength={4}
                          onBlur={(e) => update(a.id, { icon: e.target.value || '✳' })}
                        />
                      </label>
                      <label>
                        Min window (h)
                        <input
                          type="number"
                          min={1}
                          max={12}
                          defaultValue={a.minHours}
                          onBlur={(e) =>
                            update(a.id, {
                              minHours: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                            })
                          }
                        />
                      </label>
                    </div>

                    <div className="con-table" role="table" aria-label="Conditions">
                      <div className="con-head" role="row">
                        <span>Condition</span>
                        <span>no less than</span>
                        <span>ideal from</span>
                        <span>ideal to</span>
                        <span>no more than</span>
                        <span />
                      </div>
                      {a.constraints.map((c, ci) => (
                        <div className="con-row" role="row" key={`${c.metric}-${ci}`}>
                          <span className="con-name">
                            {METRIC_LABEL[c.metric]}
                            <em className="muted"> {unitSuffix(metricDim(c.metric), units).trim()}</em>
                          </span>
                          <BoundInput a={a} c={c} field="hardMin" units={units} onCommit={(v) => updateConstraint(a.id, ci, { hardMin: v })} />
                          <BoundInput a={a} c={c} field="idealMin" units={units} onCommit={(v) => updateConstraint(a.id, ci, { idealMin: v })} />
                          <BoundInput a={a} c={c} field="idealMax" units={units} onCommit={(v) => updateConstraint(a.id, ci, { idealMax: v })} />
                          <BoundInput a={a} c={c} field="hardMax" units={units} onCommit={(v) => updateConstraint(a.id, ci, { hardMax: v })} />
                          <button
                            className="linklike"
                            onClick={() => removeConstraint(a.id, ci)}
                            aria-label={`Remove ${METRIC_LABEL[c.metric]}`}
                          >
                            remove
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="act-actions">
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) addConstraint(a.id, e.target.value as MetricId);
                        }}
                        aria-label="Add a condition"
                      >
                        <option value="">+ add condition…</option>
                        {ALL_METRICS.filter((m) => !a.constraints.some((c) => c.metric === m)).map(
                          (m) => (
                            <option key={m} value={m}>
                              {METRIC_LABEL[m]}
                            </option>
                          ),
                        )}
                      </select>
                      <button className="linklike" onClick={() => duplicate(a)}>duplicate</button>
                      <button className="linklike danger" onClick={() => remove(a.id)}>delete</button>
                    </div>
                    <p className="muted con-hint">
                      Leave a box empty for "no limit". Score is full inside the ideal range and
                      tapers to zero at the outer bounds.
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="lib-actions">
            <button onClick={addActivity}>+ New activity</button>
            <button className="secondary" onClick={() => downloadActivitiesJson(activities)}>
              Export library
            </button>
            <button className="secondary" onClick={() => fileRef.current?.click()}>
              Import library
            </button>
            <button className="secondary" onClick={restoreDefaults}>
              Restore defaults
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = '';
              }}
            />
          </div>
        </>
      )}
    </section>
  );
}

function BoundInput({
  a,
  c,
  field,
  units,
  onCommit,
}: {
  a: Activity;
  c: Constraint;
  field: 'hardMin' | 'idealMin' | 'idealMax' | 'hardMax';
  units: Units;
  onCommit: (v: number | undefined) => void;
}) {
  const dim = metricDim(c.metric);
  const v = c[field];
  const display = v === undefined ? '' : String(round1(toDisplay(dim, v, units)));
  return (
    <input
      type="number"
      className="bound"
      key={`${a.id}-${c.metric}-${field}-${units}-${display}`}
      defaultValue={display}
      placeholder="—"
      onBlur={(e) => {
        const raw = e.target.value.trim();
        if (raw === '') {
          onCommit(undefined);
          return;
        }
        const n = Number(raw);
        if (Number.isFinite(n)) onCommit(round2(fromDisplay(dim, n, units)));
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      aria-label={field}
    />
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
