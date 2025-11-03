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

  const navShell = document.querySelector('[data-nav-shell]');
  const navDrawer = document.querySelector('[data-nav-drawer]');
  const navToggle = document.querySelector('[data-nav-toggle]');

  if (!navShell || !navDrawer || !navToggle) {
    return;
  }

  const navBackdrop = navDrawer.querySelector('[data-nav-backdrop]');
  const focusableSelectors =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const mediaQuery = window.matchMedia('(min-width: 992px)');
  const setDrawerState = (isOpen, { focusToggle = true, moveFocusInside = false } = {}) => {
    if (isOpen) {
      navShell.classList.add('nav-open');
      navDrawer.classList.add('is-open');
      navToggle.setAttribute('aria-expanded', 'true');
      navDrawer.setAttribute('aria-hidden', 'false');
      if (navBackdrop) {
        if (mediaQuery.matches) {
          navBackdrop.setAttribute('hidden', '');
        } else {
          navBackdrop.removeAttribute('hidden');
        }
      }

      if (moveFocusInside) {
        const firstFocusable = navDrawer.querySelector(focusableSelectors);
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }
    } else {
      navShell.classList.remove('nav-open');
      navDrawer.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navDrawer.setAttribute('aria-hidden', 'true');
      if (navBackdrop && !mediaQuery.matches) {
        navBackdrop.setAttribute('hidden', '');
      }

      if (focusToggle) {
        navToggle.focus({ preventScroll: true });
      }
    }
  };

  const toggleDrawer = (forceOpen) => {
    const isOpen = navShell.classList.contains('nav-open');
    const nextState = forceOpen ?? !isOpen;
    setDrawerState(nextState, { moveFocusInside: nextState, focusToggle: !nextState });
  };

  navToggle.addEventListener('click', () => toggleDrawer());

  if (navBackdrop) {
    navBackdrop.addEventListener('click', () => {
      if (navShell.classList.contains('nav-open')) {
        toggleDrawer(false);
      }
    });
  }

  navDrawer.addEventListener('click', (event) => {
    const target = event.target.closest('a[href]');
    if (target && window.matchMedia('(max-width: 991px)').matches) {
      toggleDrawer(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navShell.classList.contains('nav-open')) {
      event.preventDefault();
      toggleDrawer(false);
    }
  });

  const applyResponsiveState = (query) => {
    if (query.matches) {
      setDrawerState(true, { focusToggle: false });
    } else {
      setDrawerState(false, { focusToggle: false });
    }
  };

  applyResponsiveState(mediaQuery);
  mediaQuery.addEventListener('change', (event) => {
    applyResponsiveState(event);
  });
});
