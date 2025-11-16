(function bootstrapPWA() {
  if (!('serviceWorker' in navigator)) {
    console.info('Service workers are not supported in this browser.');
    return;
  }

  const currentScript = document.currentScript;
  const serviceWorkerPath =
    (currentScript && currentScript.dataset.swPath) || '/service-worker.js';

  function logTelemetry(level, message, detail) {
    const payload = { level, message, detail };
    if (level === 'error') {
      console.error('pwa.bootstrap', payload);
    } else {
      console.info('pwa.bootstrap', payload);
    }
  }

  function monitorUpdates(registration) {
    if (!registration) {
      return;
    }

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) {
        return;
      }

      logTelemetry('info', 'Service worker update detected', { scope: registration.scope });
      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') {
          const message = navigator.serviceWorker.controller
            ? 'Service worker update installed'
            : 'Service worker installed';
          logTelemetry('info', message, { scope: registration.scope });
        }
      });
    });

    if (registration.waiting) {
      logTelemetry('info', 'Service worker update waiting', { scope: registration.scope });
    }
  }

  navigator.serviceWorker
    .register(serviceWorkerPath)
    .then((registration) => {
      logTelemetry('info', 'Service worker registered', { scope: registration.scope });
      monitorUpdates(registration);
    })
    .catch((error) => {
      logTelemetry('error', 'Service worker registration failed', { error: error.message });
    });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    logTelemetry('info', 'Active service worker changed', {});
  });
})();
