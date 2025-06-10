// Constants for repeated error messages and states
const ERROR_MESSAGES = {
  INVALID_TARGET: "Invalid event target:",
  INVALID_HANDLER: "Invalid event handler:",
  ERROR_ADDING: "Error adding event listener for",
  ERROR_REMOVING: "Error removing event listener for",
};

export class EventService {
  static EVENTS = {
    // Game events
    WORD_FOUND: "word-found",
    VICTORY_EFFECT: "victory-effect",
    GAME_INITIALIZED: "game-initialized",
    LEVEL_LOADED: "level-loaded",
    LEVEL_COMPLETED: "level-completed",
    LEVEL_ADVANCE: "level-advance",

    // UI events
    TITLE_ADJUSTED: "title-adjusted",
    THEME_CHANGE: "theme-change",
    MODAL_OPEN: "modal-open",
    MODAL_CLOSE: "modal-close",

    // Selection events
    SELECTION_CHANGE: "selection-change",
    SELECTION_COMPLETE: "selection-complete",
    SELECTION_RESET: "selection-reset",

    // Animation events
    ANIMATION_START: "animation-start",
    ANIMATION_END: "animation-end",
    VICTORY_ANIMATION: "victory-animation",

    // Timer events
    TIMER_START: "timer-start",
    TIMER_PAUSE: "timer-pause",
    TIMER_RESUME: "timer-resume",
    TIMER_RESET: "timer-reset",
    TIMER_TICK: "timer-tick",

    // Platform events
    APP_PAUSE: "app-pause",
    APP_RESUME: "app-resume",
  };

  constructor() {
    this._handlers = new Map();
    this._boundHandlers = new Map();
    this._priorities = new Map();

    // Initialize default maps for window target
    this._initializeTargetMaps(window);
  }

  _initializeTargetMaps(target) {
    if (!this._handlers.has(target)) {
      this._handlers.set(target, new Map());
      this._priorities.set(target, new Map());
    }
  }

  on(event, handler, options = {}) {
    const { target = window, once = false, priority = 0 } = options;

    // Validar target y handler
    if (!target || typeof target.addEventListener !== "function") {
      console.error(ERROR_MESSAGES.INVALID_TARGET, target);
      return () => {}; // Retornar un noop cleanup function
    }

    if (typeof handler !== "function") {
      console.error(ERROR_MESSAGES.INVALID_HANDLER, handler);
      return () => {};
    }

    // Asegurar que el target tenga sus mapas inicializados
    this._initializeTargetMaps(target);

    const targetHandlers = this._handlers.get(target);
    const boundHandler = (e) => {
      handler(e?.detail || e);
      if (once) this.off(event, handler, { target });
    };

    if (!targetHandlers.has(event)) {
      targetHandlers.set(event, new Set());
    }

    targetHandlers.get(event).add(handler);
    this._boundHandlers.set(handler, boundHandler);
    this._priorities.get(target).set(handler, priority);

    // Envolver addEventListener en try-catch por si el evento no es válido
    try {
      target.addEventListener(event, boundHandler);
    } catch (error) {
      console.error(`${ERROR_MESSAGES.ERROR_ADDING} ${event}:`, error);
      this.off(event, handler, { target });
      return () => {};
    }

    return () => this.off(event, handler, { target });
  }

  once(event, handler, options = {}) {
    return this.on(event, handler, { ...options, once: true });
  }

  off(event, handler, options = {}) {
    const { target = window } = options;

    // Validación básica
    if (!target || typeof target.removeEventListener !== "function") {
      console.error(ERROR_MESSAGES.INVALID_TARGET, target);
      return;
    }

    // Si no hay handlers para este target, no hay nada que limpiar
    if (!this._handlers.has(target)) {
      return;
    }

    const targetHandlers = this._handlers.get(target);
    if (!targetHandlers?.has(event)) {
      return;
    }

    const boundHandler = this._boundHandlers.get(handler);
    if (!boundHandler) {
      return;
    }

    try {
      targetHandlers.get(event).delete(handler);
      target.removeEventListener(event, boundHandler);
      this._boundHandlers.delete(handler);
      this._priorities.get(target)?.delete(handler);

      // Limpiar el Set si está vacío
      if (targetHandlers.get(event).size === 0) {
        targetHandlers.delete(event);
      }

      // Limpiar el Map si está vacío
      if (targetHandlers.size === 0) {
        this._handlers.delete(target);
        this._priorities.delete(target);
      }
    } catch (error) {
      console.error(`${ERROR_MESSAGES.ERROR_REMOVING} ${event}:`, error);
    }
  }

  emit(event, detail = {}, options = {}) {
    const { target = window } = options;

    // Validar que el target existe y tiene los métodos necesarios
    if (!target || typeof target.dispatchEvent !== "function") {
      console.error(ERROR_MESSAGES.INVALID_TARGET, target);
      return;
    }

    // Asegurar que el target tenga sus mapas inicializados
    this._initializeTargetMaps(target);

    // Serializar los eventos para mantener el orden correcto
    const emitEvent = () => {
      const customEvent = new CustomEvent(event, { detail });
      target.dispatchEvent(customEvent);
    };

    if (event === EventService.EVENTS.ANIMATION_END) {
      // Asegurar que ANIMATION_END se emite después de que el DOM se ha actualizado
      requestAnimationFrame(() => requestAnimationFrame(emitEvent));
    } else if (event === EventService.EVENTS.WORD_FOUND) {
      // WORD_FOUND debe esperar a que ANIMATION_START se haya procesado
      requestAnimationFrame(emitEvent);
    } else {
      emitEvent();
    }
  }

  getHandlers(event, target = window) {
    const handlers = this._handlers.get(target)?.get(event) || new Set();
    const priorities = this._priorities.get(target);

    return [...handlers].sort((a, b) => {
      const priorityA = priorities?.get(a) || 0;
      const priorityB = priorities?.get(b) || 0;
      return priorityB - priorityA;
    });
  }

  destroy() {
    for (const [target, handlers] of this._handlers) {
      for (const [event, eventHandlers] of handlers) {
        for (const handler of eventHandlers) {
          this.off(event, handler, { target });
        }
      }
    }

    this._handlers.clear();
    this._boundHandlers.clear();
    this._priorities.clear();
  }
}
