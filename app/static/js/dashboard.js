document.addEventListener('DOMContentLoaded', () => {
  const supabaseConfig = (() => {
    const node = document.querySelector('[data-supabase-config]');
    if (!node) return null;
    try {
      const parsed = JSON.parse(node.textContent || '{}');
      if (parsed && typeof parsed === 'object') {
        window.fvSupabaseConfig = parsed;
        return parsed;
      }
    } catch (error) {
      console.warn('supabase.config.parse_failed', error);
    }
    return null;
  })();

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

    const defaultRangeData = (rangeKey) => {
      const source = sampleRanges[rangeKey] || sampleRanges.daily;
      return {
        labels: [...source.labels],
        meals: [...source.meals],
        workouts: [...source.workouts],
        sleep: [...source.sleep],
      };
    };

    const queryDashboard = async (rangeKey) => {
      const response = await fetch(`/api/dashboard_range?range=${encodeURIComponent(rangeKey)}`, {
        credentials: 'same-origin',
      });
      if (response.redirected) {
        throw new Error('Dashboard API redirected; session may be missing.');
      }
      if (!response.ok) {
        throw new Error(`Dashboard data request failed: ${response.status}`);
      }
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) {
        throw new Error('Dashboard API returned HTML. Check login/session.');
      }
      const payload = await response.json();
      if (!payload || !payload.data) {
        throw new Error('Dashboard data missing.');
      }
      return payload.data;
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
          const data = await queryDashboard(rangeKey);
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
        const errorMessage = (result.error && result.error.message) || '';
        const sessionIssue = /401|redirect/i.test(errorMessage);
        const statusMessage = sessionIssue
          ? 'Session expired or missing. Log in locally and verify SUPABASE_URL and SUPABASE_ANON_KEY are set.'
          : 'Showing cached sample data while Supabase is unreachable.';
        chartStatus.error(statusMessage);
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
