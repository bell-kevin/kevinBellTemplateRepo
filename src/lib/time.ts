/*
 * Time display pinned to the *place's* timezone (from the forecast), so the
 * chart is correct even when you're planning a week somewhere else.
 *
 * Part of kairos. AGPL-3.0-or-later.
 */

export function fmt(unixSec: number, tz: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz }).format(
    new Date(unixSec * 1000),
  );
}

/** "Tue 7 AM" style. */
export function fmtDayHour(unixSec: number, tz: string): string {
  return fmt(unixSec, tz, { weekday: 'short', hour: 'numeric' });
}

/** "7 AM" / "11 PM". */
export function fmtHour(unixSec: number, tz: string): string {
  return fmt(unixSec, tz, { hour: 'numeric' });
}

/** "6:12 AM". */
export function fmtClock(unixSec: number, tz: string): string {
  return fmt(unixSec, tz, { hour: 'numeric', minute: '2-digit' });
}

/** Local calendar day key, "2026-07-17", in the place's timezone. */
export function dayKey(unixSec: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(unixSec * 1000));
}

/** Local hour of day 0–23 in the place's timezone. */
export function hourOfDay(unixSec: number, tz: string): number {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date(unixSec * 1000));
  return parseInt(s, 10);
}

/** "Tue 7–9 AM" or "Tue 11 PM – Wed 1 AM" for a window spanning hours. */
export function fmtWindowRange(
  startSec: number,
  endSecExclusive: number,
  tz: string,
): string {
  const sameDay = dayKey(startSec, tz) === dayKey(endSecExclusive, tz);
  const start = fmtDayHour(startSec, tz);
  const end = sameDay ? fmtHour(endSecExclusive, tz) : fmtDayHour(endSecExclusive, tz);
  return `${start}–${end}`.replace(/ (AM|PM)–/, (m, ap) => {
    // Drop a redundant AM/PM on the start when the end shares it.
    return end.endsWith(ap) ? '–' : m;
  });
}

/* ------------------------------------------------------------------ */
/* iCalendar export                                                    */
/* ------------------------------------------------------------------ */

function icsStamp(unixSec: number): string {
  return new Date(unixSec * 1000)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Build and download a single-event .ics file for a window. */
export function downloadIcs(opts: {
  title: string;
  description: string;
  location: string;
  startSec: number;
  endSec: number;
}): void {
  const uid = `${opts.startSec}-${Math.random().toString(36).slice(2)}@kairos`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//kairos//opportune hour//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(Date.now() / 1000)}`,
    `DTSTART:${icsStamp(opts.startSec)}`,
    `DTEND:${icsStamp(opts.endSec)}`,
    `SUMMARY:${icsEscape(opts.title)}`,
    `DESCRIPTION:${icsEscape(opts.description)}`,
    `LOCATION:${icsEscape(opts.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${opts.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
