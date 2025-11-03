const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const scriptSource = fs.readFileSync(
  path.join(__dirname, "..", "app", "static", "js", "ai_coach_speech.js"),
  "utf8"
);

const EVENT_NAMES = ["state", "transcript", "error", "permission", "cancel"];

function createBridge(overrides = {}) {
  const listeners = new Map();
  EVENT_NAMES.forEach((name) => listeners.set(name, new Set()));

  const bridge = {
    requestPermission() {
      return Promise.resolve("granted");
    },
    startListening() {
      bridge.started = true;
      return Promise.resolve();
    },
    stopListening() {
      bridge.stopped = true;
      return Promise.resolve();
    },
    cancelListening() {
      bridge.canceled = true;
      return Promise.resolve();
    },
    openSettings() {
      bridge.openedSettings = true;
      return Promise.resolve();
    },
    on(eventName, handler) {
      if (!listeners.has(eventName) || typeof handler !== "function") {
        return () => {};
      }

      listeners.get(eventName).add(handler);
      return () => listeners.get(eventName).delete(handler);
    },
    emit(eventName, payload) {
      if (!listeners.has(eventName)) {
        return;
      }

      listeners.get(eventName).forEach((handler) => handler(payload));
    },
  };

  return Object.assign(bridge, overrides);
}

class FakeElement {
  constructor({ selectors = [], id = null, tagName = "div" } = {}) {
    this._selectors = Array.from(selectors);
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this._queries = new Map();
    this.eventListeners = new Map();
    this.textContent = "";
    this.value = "";
    this.title = "";
    this.disabled = false;
    this.focused = false;
    this.hidden = false;
    this.selectionStart = 0;
    this.selectionEnd = 0;

    const self = this;
    this.dataset = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "speechState") {
            return self.attributes["data-speech-state"];
          }
          return undefined;
        },
        set(_target, prop, value) {
          if (prop === "speechState") {
            self.attributes["data-speech-state"] = String(value);
          }
          return true;
        },
      }
    );
  }

  addQuery(selector, child) {
    if (!this._queries.has(selector)) {
      this._queries.set(selector, []);
    }
    const list = this._queries.get(selector);
    list.push(child);
    if (child && Array.isArray(child._selectors)) {
      child._selectors.push(selector);
    }
    child.parentElement = this;
    return child;
  }

  querySelector(selector) {
    const value = this._queries.get(selector);
    if (!value || value.length === 0) {
      return null;
    }
    return value[0];
  }

  querySelectorAll(selector) {
    const value = this._queries.get(selector);
    if (!value) {
      return [];
    }
    return Array.from(value);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "aria-pressed") {
      this.ariaPressed = String(value);
    }
    if (name === "aria-label") {
      this.ariaLabel = String(value);
    }
    if (name === "aria-hidden") {
      this.ariaHidden = String(value);
    }
    if (name === "data-speech-state") {
      this.dataset.speechState = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  addEventListener(type, handler) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type).push(handler);
  }

  dispatchEvent(event) {
    const handlers = this.eventListeners.get(event.type) || [];
    handlers.forEach((handler) => handler.call(this, event));
  }

  click() {
    this.dispatchEvent({ type: "click", target: this });
  }

  focus(options) {
    this.focused = true;
    this.focusOptions = options;
  }

  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  matches(selector) {
    return this._selectors.includes(selector);
  }
}

class FakeDocument {
  constructor({ composer, modal }) {
    this._composer = composer;
    this._modal = modal;
    this.eventListeners = new Map();
  }

  querySelector(selector) {
    if (selector === ".composer[data-speech-state]") {
      return this._composer;
    }
    return null;
  }

  getElementById(id) {
    if (this._modal && this._modal.id === id) {
      return this._modal;
    }
    return null;
  }

  addEventListener(type, handler) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type).push(handler);
  }
}

function setupEnvironment(options = {}) {
  const composer = new FakeElement({ selectors: [".composer[data-speech-state]"], tagName: "form" });
  composer.dataset.speechState = "idle";

  const textarea = new FakeElement({ selectors: ["[data-role='speech-target']"], tagName: "textarea" });
  const statusEl = new FakeElement({ selectors: ["[data-role='speech-status']"], tagName: "div" });
  const toggleButton = new FakeElement({ selectors: ["[data-role='speech-toggle']"], tagName: "button" });
  const cancelButton = new FakeElement({ selectors: ["[data-role='speech-cancel']"], tagName: "button" });
  const labelEl = new FakeElement({ selectors: ["[data-role='speech-label']"], tagName: "span" });
  labelEl.textContent = "Dictate";

  composer.addQuery("[data-role='speech-target']", textarea);
  composer.addQuery("[data-role='speech-status']", statusEl);
  composer.addQuery("[data-role='speech-toggle']", toggleButton);
  composer.addQuery("[data-role='speech-cancel']", cancelButton);
  composer.addQuery("[data-role='speech-label']", labelEl);

  const modal = new FakeElement({ id: "speech-permission-modal", tagName: "div" });
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");

  const modalBackdrop = new FakeElement({ selectors: ["[data-role='modal-dismiss']"], tagName: "div" });
  const modalDismissButton = new FakeElement({ selectors: ["[data-role='modal-dismiss']", "button"], tagName: "button" });
  const settingsButton = new FakeElement({ selectors: ["[data-role='open-settings']", "button"], tagName: "button" });

  modal.addQuery("[data-role='modal-dismiss']", modalBackdrop);
  modal.addQuery("[data-role='modal-dismiss']", modalDismissButton);
  modal.addQuery("[data-role='open-settings']", settingsButton);
  modal.addQuery("button", modalDismissButton);
  modal.addQuery("button", settingsButton);

  const bridgeOverrides = options.bridge || {};
  const bridge = createBridge(bridgeOverrides);
  const document = new FakeDocument({ composer, modal });

  const context = {
    window: { FitVisionSpeechBridge: bridge },
    document,
    console,
    setTimeout,
    clearTimeout,
  };

  vm.runInNewContext(scriptSource, context);

  return {
    composer,
    textarea,
    statusEl,
    toggleButton,
    cancelButton,
    labelEl,
    modal,
    modalBackdrop,
    modalDismissButton,
    openSettingsButton: settingsButton,
    bridge,
  };
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function startListening(env) {
  env.toggleButton.click();
  await flushPromises();
}

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test("UI state transitions respond to microphone toggles", async () => {
  const env = setupEnvironment();

  assert.strictEqual(env.composer.dataset.speechState, "idle");
  assert.strictEqual(env.toggleButton.getAttribute("aria-pressed"), "false");
  assert.strictEqual(env.labelEl.textContent, "Dictate");
  assert.strictEqual(env.cancelButton.hidden, true);

  await startListening(env);

  assert.strictEqual(env.composer.dataset.speechState, "listening");
  assert.strictEqual(env.toggleButton.getAttribute("aria-pressed"), "true");
  assert.strictEqual(env.labelEl.textContent, "Stop");
  assert.strictEqual(env.cancelButton.hidden, false);
  assert.ok(env.statusEl.textContent.includes("Listening"));

  env.toggleButton.click();
  await flushPromises();
  assert.strictEqual(env.composer.dataset.speechState, "processing");

  env.bridge.emit("state", { status: "idle" });
  await flushPromises();

  assert.strictEqual(env.composer.dataset.speechState, "idle");
  assert.strictEqual(env.toggleButton.getAttribute("aria-pressed"), "false");
  assert.strictEqual(env.labelEl.textContent, "Dictate");
  assert.strictEqual(env.cancelButton.hidden, true);
});

test("Transcription updates replace text without duplication", async () => {
  const env = setupEnvironment();

  await startListening(env);

  env.bridge.emit("transcript", { text: "Hello", isFinal: false });
  assert.strictEqual(env.textarea.value, "Hello");

  env.bridge.emit("transcript", { text: "Hello world", isFinal: false });
  assert.strictEqual(env.textarea.value, "Hello world");

  env.bridge.emit("transcript", { text: "Hello world", isFinal: true });
  assert.strictEqual(env.textarea.value, "Hello world");

  env.bridge.emit("state", { status: "idle" });
  await flushPromises();

  assert.strictEqual(env.composer.dataset.speechState, "idle");
  assert.strictEqual(env.textarea.value, "Hello world");
});

test("Multiple dictation sessions append correctly", async () => {
  const env = setupEnvironment();

  await startListening(env);
  env.bridge.emit("transcript", { text: "First message.", isFinal: true });
  env.bridge.emit("state", { status: "idle" });
  await flushPromises();

  assert.strictEqual(env.textarea.value, "First message.");

  await startListening(env);
  env.bridge.emit("transcript", { text: "Second message.", isFinal: true });
  env.bridge.emit("state", { status: "idle" });
  await flushPromises();

  assert.strictEqual(env.textarea.value, "First message. Second message.");
});

test("Canceling dictation clears live transcript and resets state", async () => {
  const env = setupEnvironment();

  await startListening(env);
  env.bridge.emit("transcript", { text: "This will be deleted", isFinal: false });
  assert.strictEqual(env.textarea.value, "This will be deleted");

  env.cancelButton.click();
  await flushPromises();

  assert.strictEqual(env.textarea.value, "");
  assert.strictEqual(env.composer.dataset.speechState, "idle");
});

test("Permission denied opens the permission modal", async () => {
  const env = setupEnvironment();
  env.bridge.requestPermission = () => Promise.resolve({ status: "denied" });

  await startListening(env);
  await flushPromises();

  assert.strictEqual(env.modal.hidden, false);
  assert.strictEqual(env.modal.getAttribute("aria-hidden"), "false");
  assert.ok(env.openSettingsButton, "Settings button should exist");
  assert.ok(env.openSettingsButton.matches("[data-role='open-settings']"));
});

async function run() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(error);
      process.exitCode = 1;
      break;
    }
  }
}

if (require.main === module) {
  run();
}

module.exports = { test, setupEnvironment };
