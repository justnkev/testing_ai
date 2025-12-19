"use strict";

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfWeek(date) {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function startOfMonth(date) {
  const copy = startOfDay(date);
  copy.setDate(1);
  return copy;
}

function formatBucketLabel(start, timeframe) {
  if (timeframe === 'day') {
    return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (timeframe === 'week') {
    return `Week of ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }
  return start.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function buildBuckets(timeframe) {
  const today = startOfDay(new Date());

  if (timeframe === 'day') {
    return Array.from({ length: 7 }, (_, idx) => {
      const start = new Date(today);
      start.setDate(today.getDate() - (6 - idx));
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      return { start, end, label: formatBucketLabel(start, timeframe) };
    });
  }

  if (timeframe === 'week') {
    const base = startOfWeek(today);
    return Array.from({ length: 4 }, (_, idx) => {
      const start = new Date(base);
      start.setDate(base.getDate() - (3 - idx) * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { start, end, label: formatBucketLabel(start, timeframe) };
    });
  }

  const baseMonth = startOfMonth(today);
  return Array.from({ length: 6 }, (_, idx) => {
    const start = startOfMonth(new Date(baseMonth.getFullYear(), baseMonth.getMonth() - (5 - idx), 1));
    const end = startOfMonth(new Date(start.getFullYear(), start.getMonth() + 1, 1));
    return { start, end, label: formatBucketLabel(start, timeframe) };
  });
}

function parseSleepHours(text, fallback) {
  if (typeof text === 'number') return text;
  if (!text && typeof fallback === 'number') return fallback;
  const textValue = String(text || '').toLowerCase();
  const hoursMatch = textValue.match(/(\d+(?:\.\d+)?)\s*h/);
  const minutesMatch = textValue.match(/(\d+(?:\.\d+)?)\s*m/);
  const hours = hoursMatch ? parseFloat(hoursMatch[1]) : null;
  const minutes = minutesMatch ? parseFloat(minutesMatch[1]) / 60 : 0;
  if (hours !== null || minutesMatch) return (hours || 0) + minutes;
  const numeric = textValue.match(/\d+(?:\.\d+)?/);
  if (numeric) return parseFloat(numeric[0]);
  return typeof fallback === 'number' ? fallback : 0;
}

function aggregateMacros(meals, buckets) {
  return buckets.map((bucket) => {
    const totals = { protein_g: 0, carbs_g: 0, fat_g: 0, calories: 0 };
    meals.forEach((meal) => {
      const date = parseDate(meal.date_inferred);
      if (date && date >= bucket.start && date < bucket.end) {
        totals.protein_g += Number(meal.protein_g || 0);
        totals.carbs_g += Number(meal.carbs_g || 0);
        totals.fat_g += Number(meal.fat_g || 0);
        totals.calories += Number(meal.calories || 0);
      }
    });
    return { label: bucket.label, ...totals };
  });
}

function aggregateSleep(sleepEntries, buckets) {
  const qualities = [];
  const rows = buckets.map((bucket) => {
    const row = { label: bucket.label };
    sleepEntries.forEach((entry) => {
      const date = parseDate(entry.date_inferred);
      if (date && date >= bucket.start && date < bucket.end) {
        const quality = entry.quality || 'Unknown';
        if (!qualities.includes(quality)) qualities.push(quality);
        const hours = parseSleepHours(entry.time_asleep, entry.hours);
        row[quality] = (row[quality] || 0) + hours;
      }
    });
    return row;
  });
  return { rows, qualities };
}

function aggregateWorkouts(workouts, buckets) {
  if (!buckets.length) return [];
  const rangeStart = buckets[0].start;
  const rangeEnd = buckets[buckets.length - 1].end;
  const totals = {};
  workouts.forEach((workout) => {
    const date = parseDate(workout.date_inferred);
    if (date && date >= rangeStart && date < rangeEnd) {
      const type = workout.workout_type || 'Other';
      if (!totals[type]) {
        totals[type] = { type, count: 0, duration: 0 };
      }
      totals[type].count += 1;
      totals[type].duration += Number(workout.duration_min || 0);
    }
  });
  return Object.values(totals).sort((a, b) => b.count - a.count);
}

const exported = {
  parseDate,
  startOfDay,
  startOfWeek,
  startOfMonth,
  formatBucketLabel,
  buildBuckets,
  parseSleepHours,
  aggregateMacros,
  aggregateSleep,
  aggregateWorkouts,
};

// Support CommonJS consumers (Node, Jest) and allow esbuild to bundle for the browser.
module.exports = exported;
