const utils = require('../app/static/js/dashboard_utils.js');

describe('dashboard utils', () => {
  test('parseSleepHours handles hours and minutes text', () => {
    expect(utils.parseSleepHours('7h 30m')).toBeCloseTo(7.5);
    expect(utils.parseSleepHours('6.25h')).toBeCloseTo(6.25);
    expect(utils.parseSleepHours('45m', 0)).toBeCloseTo(0.75);
  });

  test('buildBuckets returns correct counts', () => {
    expect(utils.buildBuckets('day')).toHaveLength(7);
    expect(utils.buildBuckets('week')).toHaveLength(4);
    expect(utils.buildBuckets('month')).toHaveLength(6);
  });

  test('aggregate macros sums per bucket', () => {
    const buckets = utils.buildBuckets('day');
    const target = buckets[6];
    const meals = [
      { date_inferred: target.start.toISOString(), protein_g: 10, carbs_g: 20, fat_g: 5, calories: 200 },
      { date_inferred: target.start.toISOString(), protein_g: 5, carbs_g: 10, fat_g: 3, calories: 120 },
    ];
    const result = utils.aggregateMacros(meals, buckets).find((row) => row.label === target.label);
    expect(result.protein_g).toBeCloseTo(15);
    expect(result.carbs_g).toBeCloseTo(30);
    expect(result.fat_g).toBeCloseTo(8);
    expect(result.calories).toBeCloseTo(320);
  });

  test('aggregateSleep buckets by quality and sums hours', () => {
    const buckets = utils.buildBuckets('week');
    const target = buckets[3];
    const sleep = [
      { date_inferred: target.start.toISOString(), quality: 'Good', time_asleep: '7h' },
      { date_inferred: target.start.toISOString(), quality: 'Fair', time_asleep: '6.5h' },
      { date_inferred: target.start.toISOString(), quality: 'Good', time_asleep: '1h' },
    ];
    const { rows, qualities } = utils.aggregateSleep(sleep, buckets);
    const row = rows.find((entry) => entry.label === target.label);
    expect(qualities.sort()).toEqual(['Fair', 'Good']);
    expect(row.Good).toBeCloseTo(8);
    expect(row.Fair).toBeCloseTo(6.5);
  });

  test('aggregateWorkouts groups counts and duration in range', () => {
    const buckets = utils.buildBuckets('month');
    const start = buckets[0].start.toISOString();
    const workouts = [
      { date_inferred: start, workout_type: 'Cardio', duration_min: 30 },
      { date_inferred: start, workout_type: 'Cardio', duration_min: 20 },
      { date_inferred: start, workout_type: 'Strength', duration_min: 40 },
    ];
    const result = utils.aggregateWorkouts(workouts, buckets);
    expect(result).toHaveLength(2);
    const cardio = result.find((r) => r.type === 'Cardio');
    expect(cardio.count).toBe(2);
    expect(cardio.duration).toBeCloseTo(50);
  });
});
