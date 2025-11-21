const RANGE_CONFIG = {
  daily: { days: 7, bucket: 'day', label: 'Past 7 days' },
  weekly: { days: 28, bucket: 'week', label: 'Past 4 weeks' },
  monthly: { days: 180, bucket: 'month', label: 'Past 6 months' },
};

document.addEventListener('DOMContentLoaded', () => {
  const promptTarget = document.querySelector('[data-weekly-prompt]');
  if (promptTarget) {
    fetch('/api/weekly_prompt')
      .then((response) => response.json())
      .then((data) => {
        if (data.prompt) {
          promptTarget.textContent = data.prompt;
        }
      })
      .catch(() => {
        // Fail silently; server already renders a fallback prompt.
      });
  }

  initDashboardVisualizations();
});

function initDashboardVisualizations() {
  const root = document.querySelector('[data-dashboard-root]');
  if (!root) return;

  const statusEl = root.querySelector('[data-viz-status]');
  const supabaseUrl = root.dataset.supabaseUrl;
  const supabaseKey = root.dataset.supabaseKey;
  const userId = root.dataset.userId;

  if (!supabaseUrl || !supabaseKey || !userId) {
    setStatus(statusEl, 'Supabase configuration missing. Add anon keys to load charts.');
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function' || typeof window.Chart === 'undefined') {
    setStatus(statusEl, 'Charts unavailable—libraries did not load.');
    return;
  }

  const client = window.supabase.createClient(supabaseUrl, supabaseKey);
  const charts = {};
  let activeRange = 'daily';
  const rangeButtons = root.querySelectorAll('[data-range]');

  rangeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const newRange = button.dataset.range;
      if (!newRange || newRange === activeRange) return;
      activeRange = newRange;
      rangeButtons.forEach((btn) => btn.classList.toggle('is-active', btn === button));
      loadAndRender();
    });
  });

  loadAndRender();

  async function loadAndRender() {
    const config = RANGE_CONFIG[activeRange];
    if (!config) return;

    setStatus(statusEl, 'Loading Supabase data…');
    const since = new Date();
    since.setDate(since.getDate() - (config.days - 1));
    const fromIso = since.toISOString();

    const [meals, workouts, sleep] = await Promise.all([
      client
        .from('meals')
        .select('created_at, meal_type, calories')
        .gte('created_at', fromIso)
        .eq('user_id', userId),
      client
        .from('workouts')
        .select('created_at, workout_type, duration_min')
        .gte('created_at', fromIso)
        .eq('user_id', userId),
      client
        .from('sleep')
        .select('start_time, end_time, quality')
        .gte('start_time', fromIso)
        .eq('user_id', userId),
    ]);

    if (meals.error || workouts.error || sleep.error) {
      const message = [meals.error, workouts.error, sleep.error]
        .filter(Boolean)
        .map((entry) => entry.message || entry)
        .join('; ');
      setStatus(statusEl, `Unable to load Supabase data: ${message}`);
      return;
    }

    const bucket = config.bucket;
    const mealsAgg = aggregateSeries(meals.data, 'created_at', bucket, (item) => Number(item.calories) || 0);
    const workoutsAgg = aggregateSeries(
      workouts.data,
      'created_at',
      bucket,
      (item) => Number(item.duration_min) || 0
    );
    const sleepAgg = aggregateSeries(
      sleep.data,
      'start_time',
      bucket,
      (item) => calculateSleepHours(item.start_time, item.end_time)
    );

    const bucketKeys = Array.from(
      new Set([...Object.keys(mealsAgg), ...Object.keys(workoutsAgg), ...Object.keys(sleepAgg)])
    ).sort((a, b) => new Date(a) - new Date(b));
    const labels = bucketKeys.map((key) => bucketLabel(key, bucket));

    renderOrUpdateChart({
      charts,
      key: 'meals',
      element: root.querySelector('[data-chart-target="meals"]'),
      labels,
      data: bucketKeys.map((key) => mealsAgg[key] || 0),
      type: 'bar',
      colors: { background: '#3b82f6', border: '#2563eb' },
    });

    renderOrUpdateChart({
      charts,
      key: 'workouts',
      element: root.querySelector('[data-chart-target="workouts"]'),
      labels,
      data: bucketKeys.map((key) => workoutsAgg[key] || 0),
      type: 'line',
      colors: { background: 'rgba(16, 185, 129, 0.16)', border: '#10b981' },
    });

    renderOrUpdateChart({
      charts,
      key: 'sleep',
      element: root.querySelector('[data-chart-target="sleep"]'),
      labels,
      data: bucketKeys.map((key) => sleepAgg[key] || 0),
      type: 'line',
      colors: { background: 'rgba(139, 92, 246, 0.18)', border: '#a78bfa' },
      fill: true,
    });

    const hasData = bucketKeys.length > 0;
    setStatus(statusEl, hasData ? `${config.label} · Supabase live data` : 'No Supabase data yet. Seed to preview charts.');
  }
}

function aggregateSeries(items, dateField, bucket, mapValue) {
  const buckets = {};
  const rows = Array.isArray(items) ? items : [];
  rows.forEach((item) => {
    const dateValue = item?.[dateField];
    if (!dateValue) return;
    const bucketKey = bucketLabelKey(dateValue, bucket);
    const value = mapValue(item);
    if (!Number.isFinite(value)) return;
    buckets[bucketKey] = (buckets[bucketKey] || 0) + value;
  });
  return buckets;
}

function bucketLabelKey(dateValue, bucket) {
  const date = new Date(dateValue);
  if (bucket === 'week') {
    const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = copy.getUTCDay();
    const diff = (day + 6) % 7; // Monday as start
    copy.setUTCDate(copy.getUTCDate() - diff);
    copy.setUTCHours(0, 0, 0, 0);
    return copy.toISOString();
  }
  if (bucket === 'month') {
    const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    return first.toISOString();
  }
  const dayDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return dayDate.toISOString();
}

function bucketLabel(key, bucket) {
  const date = new Date(key);
  if (bucket === 'week') {
    return `Week of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }
  if (bucket === 'month') {
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function calculateSleepHours(start, end) {
  if (!start || !end) return 0;
  const duration = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, duration / 3.6e6);
}

function renderOrUpdateChart({ charts, key, element, labels, data, type, colors, fill = false }) {
  if (!element || typeof Chart === 'undefined') return;
  const existing = charts[key];
  const dataset = {
    label: '',
    data,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 2,
    fill,
    tension: 0.35,
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' } },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { precision: 0 },
      },
    },
  };

  if (existing) {
    existing.data.labels = labels;
    existing.data.datasets[0].data = data;
    existing.update();
  } else {
    charts[key] = new Chart(element, {
      type,
      data: { labels, datasets: [dataset] },
      options,
    });
  }
}

function setStatus(node, message) {
  if (!node) return;
  node.textContent = message || '';
}
