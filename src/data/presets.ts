/*
 * The default activity library. Values are canonical metric (°C, km/h, %);
 * imperial equivalents in comments. These are sane starting points, not
 * doctrine — every band is editable, and the whole set can be exported,
 * shared, and re-imported as JSON.
 *
 * Part of kairos. AGPL-3.0-or-later.
 */

import type { Activity } from '../types';

export const PRESETS: Activity[] = [
  {
    id: 'run',
    name: 'Go for a run',
    icon: '🏃',
    enabled: true,
    builtin: true,
    minHours: 1,
    constraints: [
      // 35–85 °F hard, 45–65 °F ideal
      { metric: 'feels', hardMin: 1.7, idealMin: 7.2, idealMax: 18.3, hardMax: 29.4 },
      { metric: 'wind', idealMax: 16, hardMax: 29 }, // ideal < 10 mph, hard < 18
      { metric: 'precipProb', idealMax: 20, hardMax: 60 },
      { metric: 'uv', idealMax: 6, hardMax: 9 },
      { metric: 'sunAlt', hardMin: -6, idealMin: 0 }, // civil dawn is fine
    ],
  },
  {
    id: 'cycle',
    name: 'Road cycling',
    icon: '🚴',
    enabled: true,
    builtin: true,
    minHours: 2,
    constraints: [
      // 40–95 °F hard, 55–80 °F ideal
      { metric: 'feels', hardMin: 4.4, idealMin: 12.8, idealMax: 26.7, hardMax: 35 },
      { metric: 'wind', idealMax: 13, hardMax: 24, weight: 1.5 }, // wind matters more
      { metric: 'gusts', hardMax: 40 }, // 25 mph
      { metric: 'precipProb', idealMax: 15, hardMax: 40 },
      { metric: 'hoursSinceRain', hardMin: 1, idealMin: 3 }, // dry pavement
      { metric: 'sunAlt', hardMin: 0 },
    ],
  },
  {
    id: 'stargaze',
    name: 'Stargazing',
    icon: '🔭',
    enabled: true,
    builtin: true,
    minHours: 1,
    constraints: [
      { metric: 'sunAlt', idealMax: -18, hardMax: -12 }, // astronomical dark ideal
      { metric: 'cloud', idealMax: 10, hardMax: 40, weight: 1.5 },
      { metric: 'moonLight', idealMax: 35, hardMax: 85 }, // a full moon washes it out
      { metric: 'precipProb', idealMax: 10, hardMax: 30 },
      { metric: 'humidity', idealMax: 60, hardMax: 85 },
      { metric: 'wind', idealMax: 10, hardMax: 24 }, // telescope shake
    ],
  },
  {
    id: 'golden',
    name: 'Golden-hour photos',
    icon: '📷',
    enabled: true,
    builtin: true,
    minHours: 1,
    constraints: [
      { metric: 'sunAlt', hardMin: -5, idealMin: -3, idealMax: 5, hardMax: 7 },
      // Some clouds make the light — an ideal band in the middle.
      { metric: 'cloud', hardMin: 0, idealMin: 15, idealMax: 60, hardMax: 85 },
      { metric: 'precipProb', idealMax: 20, hardMax: 45 },
      { metric: 'wind', hardMax: 32 },
    ],
  },
  {
    id: 'mow',
    name: 'Mow the lawn',
    icon: '🌱',
    enabled: true,
    builtin: true,
    minHours: 1,
    constraints: [
      { metric: 'hoursSinceRain', hardMin: 3, idealMin: 6, weight: 1.5 }, // dry grass
      { metric: 'feels', hardMin: 4, idealMax: 27.8, hardMax: 33.3 }, // ideal < 82 °F
      { metric: 'precipProb', idealMax: 15, hardMax: 35 },
      { metric: 'wind', hardMax: 32 },
      { metric: 'sunAlt', hardMin: 0 },
    ],
  },
  {
    id: 'carwash',
    name: 'Wash the car',
    icon: '🚗',
    enabled: true,
    builtin: true,
    minHours: 1,
    constraints: [
      // Don't wash before a storm: at least 8 dry hours ahead, 24+ ideal.
      { metric: 'hoursUntilRain', hardMin: 8, idealMin: 24, weight: 2 },
      { metric: 'temp', hardMin: 4.4, idealMin: 10, hardMax: 35 },
      { metric: 'wind', hardMax: 29 }, // dust
      { metric: 'sunAlt', hardMin: 0 },
    ],
  },
  {
    id: 'laundry',
    name: 'Line-dry laundry',
    icon: '🧺',
    enabled: true,
    builtin: true,
    minHours: 3,
    constraints: [
      { metric: 'hoursUntilRain', hardMin: 4, idealMin: 6 },
      { metric: 'humidity', idealMax: 45, hardMax: 70, weight: 1.5 },
      { metric: 'temp', hardMin: 10, idealMin: 15.6 }, // 50 / 60 °F
      // A breeze is *good*: ideal 4–15 mph.
      { metric: 'wind', idealMin: 6, idealMax: 24, hardMax: 40 },
      { metric: 'sunAlt', hardMin: 0 },
    ],
  },
  {
    id: 'patio',
    name: 'Dinner outside',
    icon: '🍽️',
    enabled: true,
    builtin: true,
    minHours: 2,
    constraints: [
      // 55–95 °F hard, 65–82 °F ideal
      { metric: 'feels', hardMin: 12.8, idealMin: 18.3, idealMax: 27.8, hardMax: 35 },
      { metric: 'wind', idealMax: 11, hardMax: 19 }, // napkins stay put
      { metric: 'precipProb', idealMax: 10, hardMax: 25 },
      { metric: 'sunAlt', hardMin: -6 }, // dusk counts
    ],
  },
  {
    id: 'hike',
    name: 'Hike',
    icon: '🥾',
    enabled: true,
    builtin: true,
    minHours: 3,
    constraints: [
      // 30–85 °F hard, 45–70 °F ideal
      { metric: 'feels', hardMin: -1.1, idealMin: 7.2, idealMax: 21.1, hardMax: 29.4 },
      { metric: 'precipProb', idealMax: 20, hardMax: 45 },
      { metric: 'wind', idealMax: 24, hardMax: 40 },
      { metric: 'uv', idealMax: 7, hardMax: 10 },
      { metric: 'sunAlt', hardMin: 0, weight: 1.2 },
    ],
  },
  {
    id: 'sleepwindow',
    name: 'Sleep, windows open',
    icon: '🌙',
    enabled: true,
    builtin: true,
    minHours: 4,
    constraints: [
      { metric: 'sunAlt', hardMax: 0 },
      // 45–73 °F hard, 54–64 °F ideal
      { metric: 'temp', hardMin: 7.2, idealMin: 12.2, idealMax: 17.8, hardMax: 22.8 },
      { metric: 'wind', idealMax: 13, hardMax: 24 },
      { metric: 'precipProb', idealMax: 20, hardMax: 45 },
      { metric: 'humidity', hardMax: 85 },
    ],
  },
];
