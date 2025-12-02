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
    const chartRanges = {
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

    const buildCharts = (rangeKey = 'daily') => {
      const range = chartRanges[rangeKey] || chartRanges.daily;

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
                  suggestedMax: Math.max(...range.sleep) + 2,
                },
              },
            },
          });
        } else {
          chartInstances.sleep.data.labels = range.labels;
          chartInstances.sleep.data.datasets[0].data = range.sleep;
          chartInstances.sleep.update();
        }
      }
    };

    const toggleButtons = chartSection.querySelectorAll('[data-range]');
    toggleButtons.forEach((button) => {
      button.addEventListener('click', () => {
        toggleButtons.forEach((btn) => btn.classList.remove('is-active'));
        button.classList.add('is-active');
        buildCharts(button.dataset.range);
      });
    });

    buildCharts('daily');
  }
});
