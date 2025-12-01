document.addEventListener('DOMContentLoaded', () => {
  const promptTarget = document.querySelector('[data-weekly-prompt]');

  if (window.Chart && Chart.defaults) {
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.aspectRatio = 1.6;
  }

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
});
