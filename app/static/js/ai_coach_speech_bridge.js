(function (window) {
  if (window.FitVisionSpeechBridge) {
    return;
  }

  const listeners = new Map();
  const supportedEvents = ["state", "transcript", "error", "permission", "cancel"];
  const pendingCallbacks = new Map();
  let callbackSequence = 0;

  const messageHandler =
    window.webkit &&
    window.webkit.messageHandlers &&
    window.webkit.messageHandlers.FitVisionSpeech;

  function ensureNativeProxy() {
    if (!messageHandler || window.FitVisionSpeech) {
      return;
    }

    window.FitVisionSpeech = {
      requestPermission(rationale) {
        return sendNativeMessage("requestPermission", { rationale });
      },
      startListening(options) {
        return sendNativeMessage("startListening", options || {});
      },
      stopListening() {
        return sendNativeMessage("stopListening", {});
      },
      cancelListening() {
        return sendNativeMessage("cancelListening", {});
      },
      openSettings() {
        return sendNativeMessage("openSettings", {});
      },
    };
  }

  function sendNativeMessage(action, payload) {
    if (!messageHandler || !messageHandler.postMessage) {
      return Promise.resolve();
    }

    const callbackId = `fvSpeech_${Date.now()}_${callbackSequence += 1}`;
    const message = {
      action,
      callbackId,
      payload: payload || {},
    };

    return new Promise((resolve, reject) => {
      pendingCallbacks.set(callbackId, { resolve, reject });

      try {
        messageHandler.postMessage(message);
      } catch (error) {
        pendingCallbacks.delete(callbackId);
        reject(error);
        return;
      }

      const timeout = setTimeout(() => {
        if (pendingCallbacks.has(callbackId)) {
          pendingCallbacks.delete(callbackId);
          reject(new Error("Speech bridge timeout"));
        }
      }, 15000);

      pendingCallbacks.get(callbackId).timeout = timeout;
    });
  }

  ensureNativeProxy();

  supportedEvents.forEach((eventName) => {
    listeners.set(eventName, new Set());
  });

  const recognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let recognitionActive = false;
  let recognitionStopReason = "";
  let accumulatedTranscript = "";

  function emit(eventName, payload) {
    if (!listeners.has(eventName)) {
      return;
    }

    listeners.get(eventName).forEach((callback) => {
      try {
        callback(payload || {});
      } catch (error) {
        // Surface listener errors without breaking other callbacks.
        setTimeout(() => {
          throw error;
        }, 0);
      }
    });
  }

  function callNative(method, ...args) {
    const nativeModule = window.FitVisionSpeech;
    if (!nativeModule || typeof nativeModule[method] !== "function") {
      return null;
    }

    try {
      const result = nativeModule[method](...args);
      if (result && typeof result.then === "function") {
        return result;
      }

      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function normalizePermissionResult(result) {
    if (!result) {
      return { status: "unknown" };
    }

    if (typeof result === "string") {
      return { status: result };
    }

    if (typeof result.status === "string") {
      return result;
    }

    return { status: "unknown" };
  }

  function ensureRecognition() {
    if (!recognitionCtor) {
      return null;
    }

    if (!recognition) {
      recognition = new recognitionCtor();
      recognition.lang = document.documentElement.lang || "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = function () {
        recognitionActive = true;
        emit("state", { status: "listening", source: "web" });
      };

      recognition.onresult = function (event) {
        let interim = "";
        let hasFinal = false;

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = (result[0] && result[0].transcript) || "";

          if (result.isFinal) {
            accumulatedTranscript = (accumulatedTranscript + " " + transcript).trim();
            hasFinal = true;
          } else {
            interim = (interim + " " + transcript).trim();
          }
        }

        if (interim) {
          const text = (accumulatedTranscript + " " + interim).trim();
          emit("transcript", { text, isFinal: false, source: "web" });
        }

        if (hasFinal) {
          emit("transcript", { text: accumulatedTranscript, isFinal: true, source: "web" });
        }
      };

      recognition.onerror = function (event) {
        emit("error", {
          code: event.error || "unknown",
          message: event.message || "Speech recognition failed.",
          source: "web",
        });
        recognitionActive = false;
        recognitionStopReason = "";
        accumulatedTranscript = "";
        emit("state", { status: "idle", source: "web" });
      };

      recognition.onend = function () {
        const lastReason = recognitionStopReason;
        recognitionStopReason = "";
        recognitionActive = false;

        if (lastReason !== "stop") {
          emit("state", { status: "idle", source: "web" });
        } else {
          setTimeout(() => {
            emit("state", { status: "idle", source: "web" });
          }, 200);
        }

        if (lastReason === "cancel") {
          emit("cancel", { reason: "user", source: "web" });
        }

        accumulatedTranscript = "";
        recognition = null;
      };
    }

    return recognition;
  }

  const bridge = {
    requestPermission(options = {}) {
      const rationale = options.rationale || "";
      const nativeCall = callNative("requestPermission", rationale);

      if (nativeCall) {
        return nativeCall
          .then(normalizePermissionResult)
          .then((result) => {
            emit("permission", result);
            return result;
          })
          .catch((error) => {
            emit("error", { code: "permission", message: error.message || String(error) });
            return { status: "error" };
          });
      }

      if (!recognitionCtor) {
        const fallback = { status: "unsupported" };
        emit("permission", fallback);
        return Promise.resolve(fallback);
      }

      const fallback = { status: "granted", source: "web" };
      emit("permission", fallback);
      return Promise.resolve(fallback);
    },

    startListening(options = {}) {
      const nativeCall = callNative("startListening", options);
      if (nativeCall) {
        emit("state", { status: "listening", source: "native" });
        return nativeCall;
      }

      const engine = ensureRecognition();
      if (!engine) {
        const error = {
          code: "unsupported",
          message: "Speech recognition is not supported in this environment.",
        };
        emit("error", error);
        return Promise.reject(new Error(error.message));
      }

      if (!recognitionActive) {
        accumulatedTranscript = "";
        recognitionStopReason = "";
        try {
          engine.lang = options.language || engine.lang;
          engine.start();
        } catch (error) {
          emit("error", { code: "start", message: error.message || String(error) });
          return Promise.reject(error);
        }
      }

      return Promise.resolve();
    },

    stopListening() {
      const nativeCall = callNative("stopListening");
      if (nativeCall) {
        emit("state", { status: "processing", source: "native" });
        return nativeCall;
      }

      if (recognition && recognitionActive) {
        recognitionStopReason = "stop";
        emit("state", { status: "processing", source: "web" });
        recognition.stop();
        return Promise.resolve();
      }

      return Promise.resolve();
    },

    cancelListening() {
      const nativeCall = callNative("cancelListening");
      if (nativeCall) {
        return nativeCall.finally(() => {
          emit("state", { status: "idle", source: "native" });
          emit("cancel", { reason: "user", source: "native" });
        });
      }

      if (recognition) {
        recognitionStopReason = "cancel";
        try {
          recognition.abort();
        } catch (error) {
          recognition.stop();
        }
      }

      return Promise.resolve();
    },

    openSettings() {
      const nativeCall = callNative("openSettings");
      if (nativeCall) {
        return nativeCall;
      }

      // Fallback: provide guidance in environments without native settings access.
      emit("error", {
        code: "settings",
        message: "Unable to open native settings from this environment.",
      });
      return Promise.resolve();
    },

    on(eventName, handler) {
      if (!supportedEvents.includes(eventName) || typeof handler !== "function") {
        return () => {};
      }

      listeners.get(eventName).add(handler);
      return () => {
        listeners.get(eventName).delete(handler);
      };
    },

    off(eventName, handler) {
      if (!supportedEvents.includes(eventName) || typeof handler !== "function") {
        return;
      }

      listeners.get(eventName).delete(handler);
    },

    _handleNativeEvent(eventName, payload) {
      if (!supportedEvents.includes(eventName)) {
        return;
      }

      emit(eventName, payload || {});
    },

    _handleNativeCallback(callbackId, payload, error) {
      if (!callbackId || !pendingCallbacks.has(callbackId)) {
        return;
      }

      const entry = pendingCallbacks.get(callbackId);
      pendingCallbacks.delete(callbackId);

      if (entry.timeout) {
        clearTimeout(entry.timeout);
      }

      if (error) {
        entry.reject(new Error(error.message || String(error)));
        return;
      }

      entry.resolve(payload);
    },
  };

  window.FitVisionSpeechBridge = bridge;
})(window);
