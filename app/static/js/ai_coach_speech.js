(function (window, document) {
  const bridge = window.FitVisionSpeechBridge;
  if (!bridge) {
    return;
  }

  function select(root, selector) {
    return root ? root.querySelector(selector) : null;
  }

  const composer = document.querySelector(".composer[data-speech-state]");
  if (!composer) {
    return;
  }

  const textarea = select(composer, "[data-role='speech-target']");
  const statusEl = select(composer, "[data-role='speech-status']");
  const toggleButton = select(composer, "[data-role='speech-toggle']");
  const cancelButton = select(composer, "[data-role='speech-cancel']");
  const labelEl = select(composer, "[data-role='speech-label']");
  const modal = document.getElementById("speech-permission-modal");
  const modalDismissButtons = modal ? modal.querySelectorAll("[data-role='modal-dismiss']") : [];
  const openSettingsButton = modal ? modal.querySelector("[data-role='open-settings']") : null;

  if (!textarea || !statusEl || !toggleButton || !cancelButton) {
    return;
  }

  let permissionStatus = "unknown";
  let currentState = composer.dataset.speechState || "idle";
  let requestInFlight = null;
  let baseValue = textarea.value || "";
  let liveTranscript = "";

  const STATUS_MESSAGES = {
    idle: "",
    listening: "Listening… tap Stop when you’re done.",
    processing: "Processing your words…",
    error: "We couldn’t access the microphone.",
    denied: "Microphone permission is required.",
    unsupported: "Speech recognition isn’t available on this device.",
  };

  function setStatusMessage() {
    let message = STATUS_MESSAGES[currentState] || "";

    if (!message) {
      if (permissionStatus === "denied") {
        message = STATUS_MESSAGES.denied;
      } else if (permissionStatus === "unsupported") {
        message = STATUS_MESSAGES.unsupported;
      } else if (permissionStatus === "error") {
        message = STATUS_MESSAGES.error;
      }
    }

    statusEl.textContent = message;
  }

  function setState(nextState) {
    if (currentState === nextState) {
      setStatusMessage();
      return;
    }

    currentState = nextState;
    composer.dataset.speechState = nextState;
    toggleButton.setAttribute("aria-pressed", nextState === "listening" ? "true" : "false");
    toggleButton.disabled = nextState === "processing";
    cancelButton.hidden = !(nextState === "listening" || nextState === "processing");
    cancelButton.disabled = nextState === "processing";

    const isListening = nextState === "listening";
    toggleButton.setAttribute("aria-label", isListening ? "Stop dictation" : "Start dictation");
    toggleButton.title = isListening ? "Stop dictation" : "Start dictation";
    if (labelEl) {
      labelEl.textContent = isListening ? "Stop" : "Dictate";
    }

    setStatusMessage();
  }

  function setPermission(nextStatus) {
    permissionStatus = nextStatus;
    setStatusMessage();
  }

  function showPermissionModal() {
    if (!modal) {
      return;
    }

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    const focusTarget = openSettingsButton || modal.querySelector("button");
    if (focusTarget) {
      focusTarget.focus();
    }
  }

  function hidePermissionModal() {
    if (!modal || modal.hidden) {
      return;
    }

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    if (typeof toggleButton.focus === "function") {
      try {
        toggleButton.focus({ preventScroll: true });
      } catch (error) {
        toggleButton.focus();
      }
    }
  }

  function normalizeStatus(result) {
    if (!result) {
      return "unknown";
    }

    if (typeof result === "string") {
      return result;
    }

    if (typeof result.status === "string") {
      return result.status;
    }

    return "unknown";
  }

  function ensurePermission() {
    if (permissionStatus === "granted") {
      return Promise.resolve("granted");
    }

    if (requestInFlight) {
      return requestInFlight;
    }

    requestInFlight = bridge
      .requestPermission({ rationale: "To enable voice input for your AI Coach." })
      .then((result) => {
        const status = normalizeStatus(result);
        setPermission(status);
        if (status === "denied") {
          showPermissionModal();
        }
        return status;
      })
      .catch(() => {
        setPermission("error");
        return "error";
      })
      .finally(() => {
        requestInFlight = null;
      });

    return requestInFlight;
  }

  function combineText(base, transcript) {
    const baseRaw = typeof base === "string" ? base : "";
    const basePart = baseRaw.trimEnd();
    const transcriptPart = typeof transcript === "string" ? transcript.trim() : "";

    if (!basePart) {
      return transcriptPart;
    }

    if (!transcriptPart) {
      return basePart;
    }

    const needsSpace = !/\s$/.test(baseRaw);
    const prefix = needsSpace ? `${basePart} ` : basePart;
    return `${prefix}${transcriptPart}`;
  }

  function handleTranscript(event) {
    const transcript = event && typeof event.text === "string" ? event.text : "";
    const isFinal = Boolean(event && event.isFinal);
    const combined = combineText(baseValue, transcript);

    textarea.value = combined;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    liveTranscript = transcript;

    if (isFinal) {
      baseValue = combined;
      liveTranscript = "";
      setState("idle");
    }
  }

  function handleState(event) {
    if (!event || !event.status) {
      return;
    }

    const status = event.status;
    if (status === "listening" || status === "processing" || status === "idle") {
      setState(status);
      if (status === "idle") {
        baseValue = textarea.value;
        liveTranscript = "";
      }
    }
  }

  function handleError(event) {
    setState("error");

    if (event && event.code === "unsupported") {
      setPermission("unsupported");
    }

    if (event && event.message) {
      statusEl.textContent = event.message;
    }
  }

  function beginDictation() {
    baseValue = textarea.value || "";
    liveTranscript = "";
    setState("listening");
    textarea.focus({ preventScroll: true });

    bridge.startListening().catch(() => {
      setState("error");
    });
  }

  function stopDictation() {
    setState("processing");
    bridge.stopListening().catch(() => {
      setState("error");
    });
  }

  function cancelDictation() {
    bridge.cancelListening().catch(() => {
      setState("error");
    });
    textarea.value = baseValue;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    liveTranscript = "";
    setState("idle");
  }

  toggleButton.setAttribute("aria-label", "Start dictation");
  toggleButton.title = "Start dictation";
  cancelButton.hidden = true;
  setStatusMessage();

  toggleButton.addEventListener("click", () => {
    if (currentState === "listening") {
      stopDictation();
      return;
    }

    if (currentState === "processing") {
      return;
    }

    ensurePermission().then((status) => {
      if (status === "granted") {
        beginDictation();
      } else if (status === "denied") {
        setState("error");
      } else if (status === "unsupported") {
        setPermission("unsupported");
        setState("error");
      } else if (status === "error") {
        setState("error");
      }
    });
  });

  cancelButton.addEventListener("click", () => {
    cancelDictation();
  });

  if (modal) {
    modalDismissButtons.forEach((button) => {
      button.addEventListener("click", () => {
        hidePermissionModal();
      });
    });

    if (openSettingsButton) {
      openSettingsButton.addEventListener("click", () => {
        bridge.openSettings().finally(() => {
          hidePermissionModal();
        });
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        hidePermissionModal();
      }
    });

    modal.addEventListener("click", (event) => {
      if (event.target && event.target.matches("[data-role='modal-dismiss']")) {
        hidePermissionModal();
      }
    });
  }

  bridge.on("transcript", handleTranscript);
  bridge.on("state", handleState);
  bridge.on("error", handleError);
  bridge.on("permission", (event) => {
    const status = normalizeStatus(event);
    setPermission(status);
    if (status === "denied") {
      showPermissionModal();
    } else if (status === "granted") {
      hidePermissionModal();
    }
  });

  bridge.on("cancel", () => {
    textarea.value = baseValue;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    liveTranscript = "";
    setState("idle");
  });
})(window, document);
