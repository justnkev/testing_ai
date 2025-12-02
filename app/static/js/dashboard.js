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

  const chartSection = document.querySelector('.chart-section');
  const chartLibraryReady = () => typeof Chart !== 'undefined';

  if (chartSection && chartLibraryReady()) {
    const sampleRanges = {
      daily: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        meals: [3, 4, 3, 2, 4, 3, 5],
        workouts: [1, 0, 1, 0, 1, 0, 1],
        sleep: [7.5, 7, 6.8, 7.2, 8, 7.6, 7.9],
      },
      weekly: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        meals: [19, 21, 22, 20],
        workouts: [3, 4, 4, 3],
        sleep: [49, 51, 48, 50],
      },
      monthly: {
        labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
        meals: [82, 87, 90, 88, 92, 95],
        workouts: [14, 15, 16, 15, 17, 18],
        sleep: [205, 212, 208, 214, 216, 218],
      },
    };

    const supabaseConfig = {
      url: chartSection.dataset.supabaseUrl,
      key: chartSection.dataset.supabaseKey,
      userId: chartSection.dataset.userId,
    };

    const cache = new Map();
    const inFlight = new Map();
    const lastFetchTime = {};
    const CACHE_TTL = 60_000;
    const THROTTLE_MS = 1_200;

    const statusElement = (() => {
      const existing = chartSection.querySelector('[data-chart-status]');
      if (existing) {
        return existing;
      }
      const status = document.createElement('p');
      status.className = 'stat-detail';
      status.dataset.chartStatus = 'loading';
      status.textContent = 'Loading dashboard data...';
      const header = chartSection.querySelector('.chart-header');
      if (header) {
        header.appendChild(status);
      } else {
        chartSection.appendChild(status);
      }
      return status;
    })();

    const updateStatus = (state, message = '') => {
      if (!statusElement) return;
      statusElement.dataset.state = state;
      chartSection.dataset.state = state;
      chartSection.setAttribute('aria-busy', state === 'loading');
      if (message) {
        statusElement.textContent = message;
        statusElement.hidden = false;
      } else {
        statusElement.hidden = true;
      }
    };

    const chartStatus = {
      loading: (msg) => updateStatus('loading', msg || 'Loading dashboard data...'),
      ready: () => updateStatus('ready', ''),
      error: (msg) => updateStatus('error', msg || 'Unable to load latest data.'),
    };

    const supabaseClient = (() => {
      let client = null;
      return () => {
        if (client) return client;
        if (!supabaseConfig.url || !supabaseConfig.key) return null;
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
          return null;
        }
        client = window.supabase.createClient(supabaseConfig.url, supabaseConfig.key);
        return client;
      };
    })();

    const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    const startOfWeek = (date) => {
      const day = date.getDay();
      const diff = (day === 0 ? -6 : 1) - day; // Monday as start
      return startOfDay(addDays(date, diff));
    };
    const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

    const formatLabel = (date, rangeKey) => {
      if (rangeKey === 'daily') {
        return date.toLocaleDateString(undefined, { weekday: 'short' });
      }
      if (rangeKey === 'weekly') {
        const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
        return `Week of ${formatter.format(date)}`;
      }
      const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' });
      return formatter.format(date);
    };

    const buildBuckets = (rangeKey) => {
      const today = startOfDay(new Date());
      if (rangeKey === 'weekly') {
        const buckets = [];
        for (let i = 3; i >= 0; i -= 1) {
          const start = addDays(startOfWeek(today), -7 * i);
          const end = addDays(start, 7);
          buckets.push({ label: formatLabel(start, rangeKey), start, end });
        }
        return buckets;
      }

      if (rangeKey === 'monthly') {
        const buckets = [];
        for (let i = 5; i >= 0; i -= 1) {
          const pivot = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const start = startOfMonth(pivot);
          const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
          buckets.push({ label: formatLabel(start, rangeKey), start, end });
        }
        return buckets;
      }

      const buckets = [];
      for (let i = 6; i >= 0; i -= 1) {
        const start = addDays(today, -i);
        const end = addDays(start, 1);
        buckets.push({ label: formatLabel(start, 'daily'), start, end });
      }
      return buckets;
    };

    const parseDate = (value) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return startOfDay(date);
    };

    const parseFloatFromValue = (value) => {
      const match = String(value || '').match(/\d+(?:\.\d+)?/);
      return match ? parseFloat(match[0]) : 0;
    };

    const bucketize = (entries, buckets, valueResolver) => {
      const totals = new Array(buckets.length).fill(0);
      entries.forEach((entry) => {
        const date = parseDate(entry.date_inferred || entry.created_at);
        if (!date) return;
        const bucketIndex = buckets.findIndex((bucket) => date >= bucket.start && date < bucket.end);
        if (bucketIndex === -1) return;
        totals[bucketIndex] += valueResolver(entry);
      });
      return totals.map((value) => Math.round(value * 10) / 10);
    };

    const defaultRangeData = (rangeKey) => {
      const source = sampleRanges[rangeKey] || sampleRanges.daily;
      return {
        labels: [...source.labels],
        meals: [...source.meals],
        workouts: [...source.workouts],
        sleep: [...source.sleep],
      };
    };

    const querySupabase = async (rangeKey) => {
      const client = supabaseClient();
      if (!client || !supabaseConfig.userId) {
        throw new Error('Supabase client unavailable.');
      }

      const buckets = buildBuckets(rangeKey);
      const earliest = buckets[0]?.start;
      const lowerBound = earliest ? earliest.toISOString().split('T')[0] : null;

      const baseFilter = (query) => {
        let filtered = query.eq('user_id', supabaseConfig.userId).order('date_inferred', { ascending: true });
        if (lowerBound) {
          filtered = filtered.gte('date_inferred', lowerBound);
        }
        return filtered;
      };

      const [mealsResult, workoutsResult, sleepResult] = await Promise.all([
        baseFilter(client.from('meals').select('id, date_inferred, created_at')),
        baseFilter(client.from('workouts').select('id, date_inferred, created_at')),
        baseFilter(client.from('sleep').select('id, date_inferred, created_at, time_asleep, metadata')),
      ]);

      const supabaseError = mealsResult.error || workoutsResult.error || sleepResult.error;
      if (supabaseError) {
        throw new Error(supabaseError.message || 'Supabase query failed.');
      }

      const sleepHours = bucketize(sleepResult.data || [], buckets, (entry) => {
        const fromMetadata = entry.metadata && parseFloatFromValue(entry.metadata.hours || entry.metadata.time_asleep);
        const parsed = parseFloatFromValue(entry.time_asleep);
        return parsed || fromMetadata || 0;
      });

      return {
        labels: buckets.map((bucket) => bucket.label),
        meals: bucketize(mealsResult.data || [], buckets, () => 1),
        workouts: bucketize(workoutsResult.data || [], buckets, () => 1),
        sleep: sleepHours,
      };
    };

    const fetchRangeData = async (rangeKey) => {
      const cached = cache.get(rangeKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached;
      }

      if (inFlight.has(rangeKey)) {
        return inFlight.get(rangeKey);
      }

      const now = Date.now();
      const lastFetch = lastFetchTime[rangeKey] || 0;
      if (now - lastFetch < THROTTLE_MS && inFlight.has(rangeKey)) {
        return inFlight.get(rangeKey);
      }

      lastFetchTime[rangeKey] = now;

      const promise = (async () => {
        try {
          const data = await querySupabase(rangeKey);
          const payload = { data, isFallback: false, timestamp: Date.now() };
          cache.set(rangeKey, payload);
          return payload;
        } catch (error) {
          console.warn('dashboard.data.fetch_error', error);
          const fallback = defaultRangeData(rangeKey);
          const payload = { data: fallback, isFallback: true, timestamp: Date.now(), error };
          cache.set(rangeKey, payload);
          return payload;
        }
      })();

      inFlight.set(rangeKey, promise);
      promise.finally(() => inFlight.delete(rangeKey));
      return promise;
    };

    const canvasElements = {
      meals: document.getElementById('mealsChart'),
      workouts: document.getElementById('workoutsChart'),
      sleep: document.getElementById('sleepChart'),
    };

    const chartInstances = {};

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 700,
        easing: 'easeOutQuad',
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(12, 16, 31, 0.9)',
          borderColor: 'rgba(140, 123, 255, 0.35)',
          borderWidth: 1,
          padding: 12,
          titleFont: { weight: '600' },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(140, 123, 255, 0.12)' },
          ticks: { color: '#9ba7c6', font: { weight: '600' } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(140, 123, 255, 0.12)' },
          ticks: { color: '#9ba7c6' },
        },
      },
    };

    const sleepGradient = (ctx) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
      gradient.addColorStop(0, 'rgba(61, 214, 208, 0.3)');
      gradient.addColorStop(1, 'rgba(61, 214, 208, 0.05)');
      return gradient;
    };

    const renderCharts = (range) => {
      if (canvasElements.meals) {
        if (!chartInstances.meals) {
          chartInstances.meals = new Chart(canvasElements.meals, {
            type: 'bar',
            data: {
              labels: range.labels,
              datasets: [
                {
                  data: range.meals,
                  backgroundColor: 'rgba(140, 123, 255, 0.65)',
                  borderColor: 'rgba(140, 123, 255, 0.95)',
                  borderRadius: 12,
                  hoverBackgroundColor: 'rgba(160, 143, 255, 0.8)',
                },
              ],
            },
            options: baseOptions,
          });
        } else {
          chartInstances.meals.data.labels = range.labels;
          chartInstances.meals.data.datasets[0].data = range.meals;
          chartInstances.meals.update();
        }
      }

      if (canvasElements.workouts) {
        if (!chartInstances.workouts) {
          chartInstances.workouts = new Chart(canvasElements.workouts, {
            type: 'line',
            data: {
              labels: range.labels,
              datasets: [
                {
                  data: range.workouts,
                  borderColor: '#3dd6d0',
                  backgroundColor: 'rgba(61, 214, 208, 0.15)',
                  borderWidth: 3,
                  pointRadius: 4,
                  pointBackgroundColor: '#3dd6d0',
                  pointHoverRadius: 6,
                  tension: 0.4,
                  fill: true,
                },
              ],
            },
            options: {
              ...baseOptions,
              plugins: {
                ...baseOptions.plugins,
                tooltip: {
                  ...baseOptions.plugins.tooltip,
                  callbacks: {
                    title: (items) => `${items[0].label} activity`,
                  },
                },
              },
            },
          });
        } else {
          chartInstances.workouts.data.labels = range.labels;
          chartInstances.workouts.data.datasets[0].data = range.workouts;
          chartInstances.workouts.update();
        }
      }

      if (canvasElements.sleep) {
        if (!chartInstances.sleep) {
          const context = canvasElements.sleep.getContext('2d');
          chartInstances.sleep = new Chart(context, {
            type: 'line',
            data: {
              labels: range.labels,
              datasets: [
                {
                  data: range.sleep,
                  borderColor: '#ffc773',
                  backgroundColor: sleepGradient(context),
                  fill: true,
                  borderWidth: 3,
                  tension: 0.35,
                  pointRadius: 4,
                  pointBackgroundColor: '#ffc773',
                  pointHoverRadius: 6,
                },
              ],
            },
            options: {
              ...baseOptions,
              scales: {
                ...baseOptions.scales,
                y: {
                  ...baseOptions.scales.y,
                  suggestedMax: Math.max(...range.sleep, 0) + 2,
                },
              },
            },
          });
        } else {
          chartInstances.sleep.data.labels = range.labels;
          chartInstances.sleep.data.datasets[0].data = range.sleep;
          chartInstances.sleep.options.scales.y.suggestedMax = Math.max(...range.sleep, 0) + 2;
          chartInstances.sleep.update();
        }
      }
    };

    const loadRange = async (rangeKey = 'daily') => {
      chartStatus.loading('Loading dashboard data...');
      const result = await fetchRangeData(rangeKey);
      renderCharts(result.data);
      if (result.isFallback) {
        chartStatus.error('Showing cached sample data while Supabase is unreachable.');
      } else {
        chartStatus.ready();
      }
    };

    const toggleButtons = chartSection.querySelectorAll('[data-range]');
    toggleButtons.forEach((button) => {
      button.addEventListener('click', () => {
        toggleButtons.forEach((btn) => btn.classList.remove('is-active'));
        button.classList.add('is-active');
        loadRange(button.dataset.range);
      });
    });

    loadRange('daily');
  }
});
