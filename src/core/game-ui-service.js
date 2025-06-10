import { EventService } from "./event-service.js";
import { AnimationService } from "./animation-service.js";
import { StorageManager } from "./storage.js";
import { NativeServices, VibrationPatterns } from "./platform.js";

// Constants for repeated strings
const MODAL_IDS = {
  VICTORY: "victory-modal",
  MAIN: "modal",
  THEME: "theme-modal",
};

const UI_STATES = {
  ACTIVE: "active",
  HIDDEN: "hidden",
  FADING_OUT: "fading-out",
};

const LOG_PREFIX = {
  UI: "[UI]",
  CONFETTI_VIB: "[CONFETTI_VIB]",
};

const CSS_CLASSES = {
  MARK_SELECTED: "mark.selected",
  CELL: ".cell",
  HITBOX: ".hitbox",
  WORD_LIST: ".word-list",
  WILL_BE_UNUSED: "will-be-unused",
  FOUND_TEMP: "found-temp",
  UNUSED: "unused",
  VICTORY_ANIMATION: "victory-animation",
  FADING_OUT: "fading-out",
  MENU: ".menu",
  BACK_BUTTON: ".back-button",
  SELECTION_SVG: ".selection-svg",
};

const BUTTON_IDS = {
  VICTORY: {
    RESTART: "restart-level",
    NEXT: "next-level",
  },
  THEME: "theme-button",
  RESET: "reset-game",
  VIBRATION: "vibration-toggle",
  NOTIFICATION: "test-notification",
  FINAL_TIME: "final-time",
};

export class GameUIService {
  constructor(elements) {
    this.elements = elements;
    this.events = new EventService();
    this.animation = new AnimationService();
    this.modals = new Map();
    this._activeModals = new Set();
    this._modalStack = [];

    // Configurar delegación de eventos del modal de victoria
    const victoryModal = document.getElementById(MODAL_IDS.VICTORY);
    if (victoryModal) {
      victoryModal.addEventListener("click", async (e) => {
        const target = e.target;
        if (
          target.id === BUTTON_IDS.VICTORY.RESTART ||
          target.id === BUTTON_IDS.VICTORY.NEXT
        ) {
          // Primero emitir el evento correspondiente
          const event =
            target.id === BUTTON_IDS.VICTORY.RESTART
              ? EventService.EVENTS.GAME_RESET
              : EventService.EVENTS.LEVEL_ADVANCE;
          this.events.emit(event);

          // Después limpiar la UI y ocultar el modal
          this.animation.cleanup();
          this.resetUI();
          await this.hideModal(MODAL_IDS.VICTORY);
        }
      });
    }

    this.setupModals();
    this.setupEventListeners();
    this.updateVibrationButtonState();

    this._detectGPUCapabilities();

    console.log(`${LOG_PREFIX.UI} GameUIService inicializado`);
  }

  _detectGPUCapabilities() {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

    if (!gl) {
      console.log("[GPU] WebGL no soportado, usando fallbacks");
      document.documentElement.classList.add("no-gpu");
      return;
    }

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : "";

    console.log("[GPU] Renderer:", renderer);

    // Ajustar efectos según capacidades
    if (renderer.includes("Intel")) {
      document.documentElement.classList.add("reduced-effects");
    }
  }

  setupModals() {
    // Modal de victoria
    this.registerModal(MODAL_IDS.VICTORY, {
      allowClose: false,
      onShow: () => {
        console.log("Mostrando modal de victoria");
        // Emitimos evento para pausar el timer
        this.events.emit(EventService.EVENTS.TIMER_PAUSE);
      },
      onHide: () => {
        console.log("Ocultando modal de victoria");
        // No necesitamos reanudar aquí ya que depende del estado del juego
      },
    });

    this.registerModal(MODAL_IDS.MAIN, {
      allowClose: true,
      onShow: () => {
        console.log("Mostrando modal principal");
        // Emitimos evento para pausar el timer
        this.events.emit(EventService.EVENTS.TIMER_PAUSE);
      },
      onHide: () => {
        console.log("Ocultando modal principal");
        // Verificamos si no hay más modales para reanudar el timer
        if (this._modalStack.length === 0) {
          this.events.emit(EventService.EVENTS.TIMER_RESUME);
        }
      },
    });

    this.registerModal(MODAL_IDS.THEME, {
      allowClose: true,
      onShow: () => {
        console.log("Mostrando modal de temas");
        // Emitimos evento para pausar el timer
        this.events.emit(EventService.EVENTS.TIMER_PAUSE);
      },
      onHide: () => {
        console.log("Ocultando modal de temas");
        // Verificamos si no hay más modales para reanudar el timer
        if (this._modalStack.length === 0) {
          this.events.emit(EventService.EVENTS.TIMER_RESUME);
        }
      },
    });
  }

  registerModal(id, options = {}) {
    const modal = document.getElementById(id);
    if (!modal) {
      console.error(`Modal ${id} no encontrado`);
      return;
    }

    this.modals.set(id, {
      element: modal,
      allowClose: options.allowClose !== false,
      onShow: options.onShow,
      onHide: options.onHide,
    });

    if (options.allowClose !== false) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.hideModal(id);
      });
    }
  }

  showModal(id, data = {}) {
    const modal = this.modals.get(id);
    if (!modal) return false;

    if (this._modalStack.length) {
      const currentId = this._modalStack[this._modalStack.length - 1];
      const current = this.modals.get(currentId);
      current.element.classList.remove(UI_STATES.ACTIVE);
    }

    modal.element.removeAttribute(UI_STATES.HIDDEN);
    requestAnimationFrame(() => {
      modal.element.classList.add(UI_STATES.ACTIVE);
      modal.onShow?.(data);
    });

    this._modalStack.push(id);
    this._activeModals.add(id);
    this.events.emit(EventService.EVENTS.MODAL_OPEN, { id, data });

    // Asegurarse de que el timer se pausa cuando se muestra un modal
    if (this._modalStack.length === 1) {
      this.events.emit(EventService.EVENTS.TIMER_PAUSE);
    }

    console.log(
      `${LOG_PREFIX.UI} Modal mostrado: ${id}, stack actual: ${JSON.stringify(
        this._modalStack
      )}`
    );

    return true;
  }

  hideModal(id) {
    const modal = this.modals.get(id);
    if (!modal || !this._activeModals.has(id)) return false;

    console.log(`${LOG_PREFIX.UI} Cerrando modal: ${id}`);

    return new Promise((resolve) => {
      const handleTransitionEnd = () => {
        modal.element.removeEventListener("transitionend", handleTransitionEnd);
        modal.element.setAttribute(UI_STATES.HIDDEN, "");

        // Limpiar estado específico del modal
        if (id === MODAL_IDS.VICTORY) {
          this.animation.cleanup();
          document.querySelectorAll(CSS_CLASSES.CELL).forEach((cell) => {
            const mark = cell.querySelector(".mark");
            if (mark) mark.classList.remove("selected");
          });
        }

        modal.onHide?.();
        this._modalStack = this._modalStack.filter((m) => m !== id);
        this._activeModals.delete(id);
        this.events.emit(EventService.EVENTS.MODAL_CLOSE, { id });

        // Reanudar el timer solo si cerramos todos los modales y no es modal de victoria
        if (this._modalStack.length === 0 && id !== MODAL_IDS.VICTORY) {
          // Verificamos que no sea una navegación entre modales
          setTimeout(() => {
            if (this._modalStack.length === 0) {
              console.log(
                `${LOG_PREFIX.UI} Todos los modales cerrados, reanudando timer`
              );
              this.events.emit(EventService.EVENTS.TIMER_RESUME);
            }
          }, 0);
        }

        console.log(
          `${
            LOG_PREFIX.UI
          } Modal cerrado: ${id}, stack resultante: ${JSON.stringify(
            this._modalStack
          )}`
        );

        if (this._modalStack.length) {
          const previousId = this._modalStack[this._modalStack.length - 1];
          const previous = this.modals.get(previousId);
          if (previous) {
            previous.element.classList.add(UI_STATES.ACTIVE);
            console.log(
              `${LOG_PREFIX.UI} Restaurando modal anterior: ${previousId}`
            );
          }
        }
        resolve(true);
      };

      modal.element.addEventListener("transitionend", handleTransitionEnd, {
        once: true,
      });
      modal.element.classList.remove(UI_STATES.ACTIVE);
    });
  }

  hideModalInstantly(id) {
    const modal = this.modals.get(id);
    if (!modal || !this._activeModals.has(id)) return false;

    // Remover transiciones temporalmente para cierre instantáneo
    modal.element.style.transition = "none";
    modal.element.classList.remove(UI_STATES.ACTIVE);
    modal.element.setAttribute(UI_STATES.HIDDEN, "");

    // Forzar reflow para aplicar cambios inmediatamente
    modal.element.offsetHeight;

    // Restaurar transiciones
    requestAnimationFrame(() => {
      modal.element.style.transition = "";
    });

    if (id === MODAL_IDS.VICTORY) {
      this.animation.cleanup();
      // Limpiar selecciones en un solo batch
      const marks = document.querySelectorAll(CSS_CLASSES.MARK_SELECTED);
      marks.forEach((mark) => mark.classList.remove("selected"));
    }

    modal.onHide?.();
    this._modalStack = this._modalStack.filter((m) => m !== id);
    this._activeModals.delete(id);
    this.events.emit(EventService.EVENTS.MODAL_CLOSE, { id });

    // Reanudar el timer si cerramos todos los modales
    if (this._modalStack.length === 0 && id !== MODAL_IDS.VICTORY) {
      console.log(
        `${LOG_PREFIX.UI} Todos los modales cerrados instantáneamente, reanudando timer`
      );
      this.events.emit(EventService.EVENTS.TIMER_RESUME);
    }

    if (this._modalStack.length) {
      const previousId = this._modalStack[this._modalStack.length - 1];
      const previous = this.modals.get(previousId);
      if (previous) {
        previous.element.classList.add(UI_STATES.ACTIVE);
      }
    }

    return true;
  }

  // Nuevo método para navegar al modal anterior
  navigateToPreviousModal() {
    console.log(`${LOG_PREFIX.UI} Navegando al modal anterior...`);

    if (this._modalStack.length <= 1) {
      console.log(`${LOG_PREFIX.UI} No hay modales anteriores para navegar`);
      return false;
    }

    // Obtener el modal actual y el anterior
    const currentModalId = this._modalStack[this._modalStack.length - 1];
    const previousModalId = this._modalStack[this._modalStack.length - 2];

    console.log(
      `${LOG_PREFIX.UI} Navegando de ${currentModalId} a ${previousModalId}`
    );

    // Para el caso específico del modal de temas
    if (
      currentModalId === MODAL_IDS.THEME &&
      previousModalId === MODAL_IDS.MAIN
    ) {
      this.hideModal(MODAL_IDS.THEME);
      this.showModal(MODAL_IDS.MAIN);
      return true;
    }

    // Caso general
    return this.hideModal(currentModalId).then(() => {
      if (!this._modalStack.includes(previousModalId)) {
        this.showModal(previousModalId);
      }
      return true;
    });
  }

  hideAllModals() {
    [...this._activeModals].forEach((id) => this.hideModal(id));
  }

  isModalActive(id) {
    return this._activeModals.has(id);
  }

  updateSelection(selection) {
    document
      .querySelectorAll(CSS_CLASSES.MARK_SELECTED)
      .forEach((mark) => mark.classList.remove("selected"));

    selection.forEach((pos) => {
      document.getElementById(`mark-${pos}`)?.classList.add("selected");
    });
  }

  async animateWordFound(selection, wordElement, word) {
    if (!selection.length || !wordElement) return;
    return this.animation.animateWordFound(selection, wordElement, word);
  }

  async showVictory(timeString) {
    console.group(`${LOG_PREFIX.CONFETTI_VIB} showVictory iniciado`);
    // Primero actualizar el tiempo en el modal
    const finalTimeElement = document.getElementById(BUTTON_IDS.FINAL_TIME);
    if (finalTimeElement) {
      finalTimeElement.textContent = timeString;
    }

    // Animar las palabras encontradas
    const wordList = document.querySelector(CSS_CLASSES.WORD_LIST);
    wordList.classList.add(CSS_CLASSES.VICTORY_ANIMATION);

    console.log(
      `${LOG_PREFIX.CONFETTI_VIB} Esperando animación de palabras (1000ms)`
    );
    // Esperar a que termine la animación
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(
      `${LOG_PREFIX.CONFETTI_VIB} Mostrando modal y lanzando confeti`
    );
    // Mostrar el modal y lanzar el confeti en paralelo
    await Promise.all([
      this.showModal(MODAL_IDS.VICTORY),
      this.animation.animateVictory(),
    ]);

    // Limpiar la clase de animación
    wordList.classList.remove(CSS_CLASSES.VICTORY_ANIMATION);
    console.groupEnd();
  }

  resetUI() {
    // Dar tiempo a que los eventos se procesen antes de limpiar la UI
    setTimeout(() => {
      requestAnimationFrame(() => {
        document
          .querySelectorAll(CSS_CLASSES.MARK_SELECTED)
          .forEach((mark) => mark.classList.remove("selected"));
        document
          .querySelectorAll(CSS_CLASSES.FOUND_TEMP)
          .forEach((cell) => cell.classList.remove(CSS_CLASSES.FOUND_TEMP));

        // Remover también la clase de animación de victoria
        document
          .querySelector(CSS_CLASSES.WORD_LIST)
          ?.classList.remove(CSS_CLASSES.VICTORY_ANIMATION);

        // Manejar celdas unused con transición temporal desactivada
        document.querySelectorAll(CSS_CLASSES.UNUSED).forEach((cell) => {
          cell.style.transition = "none";
          cell.classList.remove(CSS_CLASSES.UNUSED);
          // Forzar reflow
          cell.offsetHeight;
          // Restaurar transición
          cell.style.transition = "";
        });

        const svgContainer = document.querySelector(CSS_CLASSES.SELECTION_SVG);
        if (svgContainer) svgContainer.innerHTML = "";

        this.hideAllModals();
      });
    }, 0);
  }

  destroy() {
    this.events.destroy();
    this.animation.destroy();
    this.modals.clear();
    this._activeModals.clear();
    this._modalStack = [];

    console.log(`${LOG_PREFIX.UI} GameUIService destruido`);
  }

  setupEventListeners() {
    console.log("Configurando event listeners de UI...");

    // Ya no vibramos al seleccionar letras, solo al encontrar palabras
    // Eliminamos el handler de SELECTION_UPDATE para vibración

    // Mantener vibración HEAVY al encontrar palabras
    this.events.on(EventService.EVENTS.WORD_FOUND, async () => {
      await NativeServices.vibrate(VibrationPatterns.HEAVY);
    });

    // ...resto de la configuración de eventos...
    const menuButton = document.querySelector(CSS_CLASSES.MENU);
    if (menuButton) {
      console.log("Botón de menú encontrado, agregando listener");
      menuButton.addEventListener("click", async () => {
        await NativeServices.vibrate(VibrationPatterns.LIGHT);
        this.showModal(MODAL_IDS.MAIN);
      });
    } else {
      console.error("No se encontró el botón de menú");
    }

    // Manejar botón de tema
    const themeButton = document.getElementById(BUTTON_IDS.THEME);
    if (themeButton) {
      themeButton.addEventListener("click", async () => {
        await NativeServices.vibrate(VibrationPatterns.LIGHT);
        this.hideModal(MODAL_IDS.MAIN);
        this.showModal(MODAL_IDS.THEME);
      });
    }

    // Manejar botón de volver en el modal de temas
    const backButton = document.querySelector(CSS_CLASSES.BACK_BUTTON);
    if (backButton) {
      backButton.addEventListener("click", async () => {
        await NativeServices.vibrate(VibrationPatterns.LIGHT);
        this.hideModal(MODAL_IDS.THEME);
        this.showModal(MODAL_IDS.MAIN);
      });
    }

    // Botón de reiniciar juego - ahora también con vibración ligera
    const resetButton = document.getElementById(BUTTON_IDS.RESET);
    if (resetButton) {
      resetButton.addEventListener("click", async () => {
        await NativeServices.vibrate(VibrationPatterns.LIGHT);
        this.hideModal(MODAL_IDS.MAIN);
        this.events.emit(EventService.EVENTS.GAME_RESET);
      });
    }

    // Botón de vibración
    const vibrationButton = document.getElementById(BUTTON_IDS.VIBRATION);
    if (vibrationButton) {
      vibrationButton.addEventListener("click", async () => {
        const newState = !StorageManager.isVibrationEnabled;
        if (await StorageManager.setVibrationEnabled(newState)) {
          this.updateVibrationButtonState();
          if (newState) {
            // Solo intentamos vibrar si se activó la vibración
            NativeServices.vibrate(VibrationPatterns.LIGHT);
          }
        }
      });
    }

    // Botón de prueba de notificación
    const notificationButton = document.getElementById(BUTTON_IDS.NOTIFICATION);
    if (notificationButton) {
      notificationButton.addEventListener("click", async () => {
        await NativeServices.vibrate(VibrationPatterns.LIGHT);
        await NativeServices.sendNotification(
          "¡Prueba de notificación!",
          "Las notificaciones están funcionando correctamente"
        );
      });
    }
  }

  updateVibrationButtonState() {
    const vibrationButton = document.getElementById(BUTTON_IDS.VIBRATION);
    if (vibrationButton) {
      vibrationButton.textContent = StorageManager.isVibrationEnabled
        ? "Disable Vibration"
        : "Enable Vibration";
    }
  }
}
