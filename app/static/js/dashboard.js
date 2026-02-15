document.addEventListener('DOMContentLoaded', () => {
  const promptTarget = document.querySelector('[data-weekly-prompt]');
  if (!promptTarget) return;

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
});
