import { CameraSettings } from '../types';
import { getFormattedLocationLine } from './locationService';

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAY_NAMES_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const DAY_NAMES_SHORT = [
  'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
];

/**
 * Format a Date object with a customizable pattern string.
 * Uses single-pass tokenization to avoid corrupting month/day names with AM/PM or other token replacements.
 */
export function formatCustomDate(date: Date, pattern: string): string {
  if (!pattern || typeof pattern !== 'string') {
    pattern = 'dd MMM yyyy, hh:mm:ss a';
  }

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const dayOfWeek = date.getDay();
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const isPM = hours24 >= 12;
  const ampm = isPM ? 'PM' : 'AM';

  // Single-pass tokenizer to prevent replacing tokens inside already-replaced words (e.g. 'a' in 'January')
  const TOKEN_REGEX = /('[^']*'|"[^"]*"|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|H|hh|h|mm|m|ss|s|a|A)/g;

  return pattern.replace(TOKEN_REGEX, (match) => {
    // If it's a quoted literal like 'text' or "text", return inner text without quotes
    if ((match.startsWith("'") && match.endsWith("'")) || (match.startsWith('"') && match.endsWith('"'))) {
      return match.slice(1, -1);
    }

    switch (match) {
      case 'yyyy':
        return String(year);
      case 'yy':
        return String(year).slice(-2);
      case 'MMMM':
        return MONTH_NAMES_FULL[month];
      case 'MMM':
        return MONTH_NAMES_SHORT[month];
      case 'MM':
        return String(month + 1).padStart(2, '0');
      case 'M':
        return String(month + 1);
      case 'dd':
        return String(day).padStart(2, '0');
      case 'd':
        return String(day);
      case 'EEEE':
        return DAY_NAMES_FULL[dayOfWeek];
      case 'EEE':
        return DAY_NAMES_SHORT[dayOfWeek];
      case 'HH':
        return String(hours24).padStart(2, '0');
      case 'H':
        return String(hours24);
      case 'hh':
        return String(hours12).padStart(2, '0');
      case 'h':
        return String(hours12);
      case 'mm':
        return String(minutes).padStart(2, '0');
      case 'm':
        return String(minutes);
      case 'ss':
        return String(seconds).padStart(2, '0');
      case 's':
        return String(seconds);
      case 'a':
      case 'A':
        return ampm;
      default:
        return match;
    }
  });
}

/**
 * Get active Date object based on settings (system or custom user-set time)
 */
export function getActiveDate(settings: CameraSettings, now: Date = new Date()): Date {
  if (settings.timeSource === 'custom' && settings.customDateTimeString) {
    const parsed = new Date(settings.customDateTimeString);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return now;
}

/**
 * Formats the complete overlay text string according to current settings mode and location.
 */
export function generateTimestampText(
  settings: CameraSettings,
  date: Date = new Date(),
  resolvedLocationAddress?: string
): {
  primaryText: string;
  secondaryText?: string;
  locationLine?: string | null;
  fullLines: string[];
} {
  const activeDate = getActiveDate(settings, date);

  let datePattern = settings.dateFormat || 'dd MMM yyyy, hh:mm:ss a';
  if (settings.mode === 'date_only') {
    // If user is in date-only mode and hasn't changed format from default datetime, provide clean date format
    if (datePattern.includes('hh:mm') || datePattern.includes('HH:mm')) {
      datePattern = 'dd MMM yyyy';
    }
  }

  const formattedDate = formatCustomDate(activeDate, datePattern);
  const locationLine = getFormattedLocationLine(settings, resolvedLocationAddress);

  const buildLines = (baseLines: string[]): string[] => {
    if (locationLine) {
      return [...baseLines, locationLine];
    }
    return baseLines;
  };

  switch (settings.mode) {
    case 'date_only':
      return {
        primaryText: formattedDate,
        locationLine,
        fullLines: buildLines([formattedDate]),
      };

    case 'datetime':
      return {
        primaryText: formattedDate,
        locationLine,
        fullLines: buildLines([formattedDate]),
      };

    case 'custom_text_timestamp': {
      const label = settings.customText.trim() || 'Site Visit';
      return {
        primaryText: label,
        secondaryText: formattedDate,
        locationLine,
        fullLines: buildLines([label, formattedDate]),
      };
    }

    default:
      return {
        primaryText: formattedDate,
        locationLine,
        fullLines: buildLines([formattedDate]),
      };
  }
}

export const COMMON_DATE_FORMAT_PRESETS = [
  { label: 'Standard 12h', pattern: 'dd MMM yyyy, hh:mm:ss a' },
  { label: 'Date & Min', pattern: 'dd MMM yyyy, hh:mm a' },
  { label: 'ISO 24h', pattern: 'yyyy-MM-dd HH:mm:ss' },
  { label: 'Short 24h', pattern: 'dd/MM/yyyy HH:mm' },
  { label: 'Full Date', pattern: 'EEEE, dd MMMM yyyy' },
  { label: 'Date Only', pattern: 'dd-MM-yyyy' },
  { label: 'US Format', pattern: 'MM/dd/yyyy hh:mm a' },
];

/**
 * Formats a Date into a local YYYY-MM-DDTHH:mm string suitable for <input type="datetime-local">
 * without UTC timezone shifting.
 */
export function toLocalIsoDateTime(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Safely parse date from customDateTimeString or Date object.
 */
export function parseDateSafe(val?: string | Date, fallback: Date = new Date()): Date {
  if (!val) return fallback;
  if (val instanceof Date) return isNaN(val.getTime()) ? fallback : val;
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? fallback : parsed;
}

/**
 * Format relative offset in minutes into human readable text (e.g. "+2h 30m" or "-45m" or "Live")
 */
export function formatOffsetMinutes(minutes: number): string {
  if (minutes === 0) return 'Live Device Time';
  const sign = minutes > 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const mins = abs % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

  return `${sign}${parts.join(' ')}`;
}

