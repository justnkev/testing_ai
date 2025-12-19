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

  // --- Health trends charts --------------------------------------------
  const trendsSection = document.querySelector('[data-trends-section]');
  if (trendsSection && typeof Chart !== 'undefined' && typeof FVTrends !== 'undefined') {
    const rangeStore = FVTrends.createRangeStore('weekly');
    const macrosCanvas = document.getElementById('macrosTrendsChart');
    const sleepCanvas = document.getElementById('sleepQualityChart');
    const workoutCanvas = document.getElementById('workoutBreakdownChart');
    const statusEl = trendsSection.querySelector('[data-trends-status]');
    const workoutEmptyState = trendsSection.querySelector('[data-workout-empty]');
    const toggleButtons = trendsSection.querySelectorAll('[data-trends-range]');

    const sampleData = {
      daily: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        macros: {
          protein: [120, 135, 118, 130, 140, 110, 125],
          carbs: [180, 190, 175, 185, 200, 170, 190],
          fat: [70, 65, 72, 68, 75, 60, 70],
          calories: [2100, 2200, 2050, 2150, 2300, 1950, 2100],
        },
        sleep: {
          qualities: ['good', 'fair'],
          series: { good: [7.2, 7.5, 7.1, 7.4, 7.6, 7.0, 7.3], fair: [0.8, 0.5, 0.6, 0.4, 0.3, 0.6, 0.5] },
        },
        workouts: {
          types: ['strength', 'cardio'],
          counts: { strength: [1, 0, 1, 0, 1, 0, 0], cardio: [0, 1, 0, 1, 0, 1, 0] },
          durations: { strength: [45, 0, 50, 0, 40, 0, 0], cardio: [0, 25, 0, 30, 0, 35, 0] },
        },
      },
      weekly: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        macros: {
          protein: [770, 790, 810, 780],
          carbs: [1220, 1240, 1260, 1210],
          fat: [410, 420, 430, 405],
          calories: [14800, 15000, 15200, 14850],
        },
        sleep: {
          qualities: ['good', 'fair'],
          series: { good: [52, 54, 53, 52], fair: [5, 4, 6, 5] },
        },
        workouts: {
          types: ['strength', 'mobility'],
          counts: { strength: [3, 3, 4, 3], mobility: [1, 1, 1, 2] },
          durations: { strength: [150, 160, 170, 155], mobility: [40, 35, 38, 45] },
        },
      },
      monthly: {
        labels: ["Jun '24", "Jul '24", "Aug '24", "Sep '24", "Oct '24", "Nov '24"],
        macros: {
          protein: [3200, 3300, 3400, 3350, 3450, 3500],
          carbs: [5100, 5200, 5300, 5250, 5400, 5450],
          fat: [2200, 2250, 2300, 2280, 2350, 2380],
          calories: [62000, 63500, 64800, 64200, 65500, 66000],
        },
        sleep: {
          qualities: ['good', 'fair', 'poor'],
          series: {
            good: [215, 218, 220, 219, 221, 223],
            fair: [14, 15, 16, 15, 14, 15],
            poor: [5, 4, 3, 5, 4, 3],
          },
        },
        workouts: {
          types: ['strength', 'cardio', 'mobility'],
          counts: { strength: [14, 15, 16, 15, 17, 18], cardio: [8, 7, 8, 9, 8, 9], mobility: [6, 6, 6, 7, 7, 7] },
          durations: { strength: [720, 750, 780, 760, 820, 840], cardio: [320, 300, 330, 360, 340, 360], mobility: [210, 220, 215, 225, 230, 235] },
        },
      },
    };

    const cache = new Map();
    const CACHE_TTL = 60_000;

    const chartInstances = {
      macros: null,
      sleep: null,
      workouts: null,
    };

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuad' },
      plugins: {
        legend: { position: 'top', labels: { color: '#c7d2fe' } },
        tooltip: {
          backgroundColor: 'rgba(12, 16, 31, 0.92)',
          borderColor: 'rgba(140, 123, 255, 0.3)',
          borderWidth: 1,
          padding: 10,
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

    const setStatus = (state, message = '') => {
      trendsSection.dataset.state = state;
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.hidden = !message;
    };

    const fetchTrends = async (rangeKey) => {
      const cached = cache.get(rangeKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached;
      }
      try {
        const response = await fetch(`/api/dashboard_trends?range=${encodeURIComponent(rangeKey)}`, {
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error(`status_${response.status}`);
        const payload = await response.json();
        const data = payload.data || payload;
        const entry = { data, isFallback: false, timestamp: Date.now() };
        cache.set(rangeKey, entry);
        return entry;
      } catch (error) {
        console.warn('dashboard.trends.fetch_failed', error);
        const fallback = { data: sampleData[rangeKey] || sampleData.weekly, isFallback: true, timestamp: Date.now() };
        cache.set(rangeKey, fallback);
        return fallback;
      }
    };

    const ensureToggleState = (rangeKey) => {
      toggleButtons.forEach((btn) => {
        const isActive = btn.dataset.trendsRange === rangeKey;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    };

    const renderMacros = (labels, macros) => {
      if (!macrosCanvas) return;
      const datasets = FVTrends.buildMacroDatasets(macros);
      const calories = macros?.calories || [];

      if (!chartInstances.macros) {
        chartInstances.macros = new Chart(macrosCanvas, {
          type: 'bar',
          data: { labels, datasets },
          options: {
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                  footer: (items) => {
                    const idx = items[0]?.dataIndex ?? 0;
                    const caloriesForBucket = calories[idx] || 0;
                    return `Calories: ${Math.round(caloriesForBucket)} kcal`;
                  },
                },
              },
            },
            scales: {
              ...baseOptions.scales,
              x: { ...baseOptions.scales.x, stacked: true },
              y: { ...baseOptions.scales.y, stacked: true },
            },
          },
        });
      } else {
        chartInstances.macros.data.labels = labels;
        chartInstances.macros.data.datasets = datasets;
        chartInstances.macros.options.plugins.tooltip.callbacks.footer = (items) => {
          const idx = items[0]?.dataIndex ?? 0;
          const caloriesForBucket = calories[idx] || 0;
          return `Calories: ${Math.round(caloriesForBucket)} kcal`;
        };
        chartInstances.macros.update();
      }
    };

    const renderSleep = (labels, sleep) => {
      if (!sleepCanvas) return;
      const datasets = FVTrends.buildSleepDatasets(sleep.qualities || [], sleep.series || {});

      if (!chartInstances.sleep) {
        chartInstances.sleep = new Chart(sleepCanvas, {
          type: 'bar',
          data: { labels, datasets },
          options: baseOptions,
        });
      } else {
        chartInstances.sleep.data.labels = labels;
        chartInstances.sleep.data.datasets = datasets;
        chartInstances.sleep.update();
      }
    };

    const renderWorkouts = (workouts) => {
      if (!workoutCanvas) return;
      const { labels, data, backgroundColor } = FVTrends.buildWorkoutChartData(
        workouts?.durations || {},
        workouts?.counts || {}
      );

      const hasData = labels.length > 0 && data.some((value) => value > 0);
      if (workoutEmptyState) workoutEmptyState.hidden = hasData;
      workoutCanvas.hidden = !hasData;

      if (!hasData) {
        if (chartInstances.workouts) {
          chartInstances.workouts.destroy();
          chartInstances.workouts = null;
        }
        return;
      }

      if (!chartInstances.workouts) {
        chartInstances.workouts = new Chart(workoutCanvas, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [
              {
                data,
                backgroundColor,
                borderWidth: 2,
                borderColor: '#0f1527',
              },
            ],
          },
          options: {
            ...baseOptions,
            cutout: '55%',
            plugins: {
              ...baseOptions.plugins,
              legend: { position: 'right', labels: { color: '#c7d2fe' } },
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                  label: (context) => {
                    const label = context.label || 'Workout';
                    const value = context.raw || 0;
                    return `${label}: ${value} min total`;
                  },
                },
              },
            },
            scales: undefined,
          },
        });
      } else {
        chartInstances.workouts.data.labels = labels;
        chartInstances.workouts.data.datasets[0].data = data;
        chartInstances.workouts.data.datasets[0].backgroundColor = backgroundColor;
        chartInstances.workouts.update();
      }
    };

    const loadTrends = async (rangeKey) => {
      setStatus('loading', 'Loading health trends...');
      ensureToggleState(rangeKey);

      const result = await fetchTrends(rangeKey);
      const { labels, macros, sleep, workouts } = result.data || {};

      renderMacros(labels || [], macros || {});
      renderSleep(labels || [], sleep || { qualities: [], series: {} });
      renderWorkouts(workouts || {});

      if (result.isFallback) {
        setStatus('error', 'Using cached sample data while Supabase is unreachable.');
      } else {
        setStatus('ready', '');
      }
    };

    toggleButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const desiredRange = FVTrends.normalizeRangeKey(button.dataset.trendsRange);
        rangeStore.set(desiredRange);
      });
    });

    rangeStore.subscribe((rangeKey) => loadTrends(rangeKey));
    ensureToggleState(rangeStore.get());
    loadTrends(rangeStore.get());
  }
});
