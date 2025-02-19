import { S } from "../core/storage.js";
import { N as NativeServices } from "../core/platform.js";
import { A as AnimationManager } from "./animations.js";
import { L as LEVEL_ORDER } from "../game/levels.js";

class SelectionManager {
  constructor(board, onSelectionUpdate) {
    // Validar que el board sea un elemento válido
    if (!(board instanceof Element)) {
      throw new Error("Board no inicializado al crear SelectionManager");
    }
    this.board = board;
    this.svgContainer = board.querySelector("#lines"); // Usar el SVG existente
    if (!this.svgContainer) {
      // Solo crear nuevo SVG si no existe
      this.svgContainer = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      this.svgContainer.id = "lines";
      this.board.insertBefore(this.svgContainer, this.board.firstChild);
    }
    this.onSelectionUpdate = onSelectionUpdate;
    this.selected = [];
    // Inicializar las propiedades privadas
    this._isPointerDown = false;
    this._isDragging = false;
    this.potentialUndo = null;
    this.startedInsideBoard = false;
    this._lastTouchMove = null;
    this._lastTouchEvent = null;
    this._wasSelecting = false;
    this._lastClickTime = null;
    this._lastEventTime = 0; // Agregar control de tiempo para eventos
    this._currentHitbox = null; // Agregar tracking del hitbox actual
    this._lastProcessedEvent = null; // Agregar tracking del último evento procesado
    this._lastPointerType = null; // Agregar tracking del tipo de evento
    this._pointerDownTime = 0; // Agregar timestamp del pointerdown
    this._pointerStartPos = null; // Posición inicial del pointer
    this._activePointerId = null; // Cambiar _currentSequenceId por _activePointerId
    this._eventLog = []; // Solo mantener para desarrollo
  }
  reset() {
    this.selected.forEach((pos) =>
      document.getElementById(`mark-${pos}`).classList.remove("selected")
    );
    this.svgContainer.innerHTML = "";
    this.selected = [];
    this.potentialUndo = null;
  }
  resetControls() {
    [
      this._isPointerDown,
      this._isDragging,
      this.potentialUndo,
      this.startedInsideBoard,
    ] = [false, false, null, false];
  }
  getCurrentSelection() {
    return [...this.selected];
  }
  drawLine() {
    this.svgContainer.innerHTML = "";
    this.selected.forEach((pos, i) => {
      if (i === 0) return;
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      const [cA, cB] = [this.selected[i - 1], pos].map((p) =>
        document.getElementById(`mark-${p}`).getBoundingClientRect()
      );
      const boardRect = this.board.getBoundingClientRect();
      ["x1", "y1", "x2", "y2"].forEach((attr, i) => {
        const rect = i < 2 ? cA : cB;
        line.setAttribute(
          attr,
          rect[attr.startsWith("x") ? "x" : "y"] +
            rect.width / 2 -
            boardRect[attr.startsWith("x") ? "x" : "y"]
        );
      });
      this.svgContainer.appendChild(line);
    });
  }
  handleLetterSelection(num) {
    const len = this.selected.length;
    if (this.selected.includes(num)) {
      if (num === this.selected[len - 1]) {
        // Solo establecer potentialUndo si no estamos arrastrando
        if (!this._isDragging) {
          this.potentialUndo = num;
        }
        this.onSelectionUpdate(this.selected);
        return true;
      }
      if (num === this.selected[len - 2]) {
        document
          .getElementById(`mark-${this.selected[len - 1]}`)
          .classList.remove("selected");
        this.selected.pop();
        this.drawLine();
        this.onSelectionUpdate(this.selected);
        return true;
      }
      return false;
    }

    if (!len || this.areAdjacent(this.selected[len - 1], num)) {
      this.potentialUndo = null; // Resetear como en el código antiguo
      const mark = document.getElementById(`mark-${num}`);
      this.selected.push(num);
      mark.classList.add("selected");
      this.drawLine();
      this.onSelectionUpdate(this.selected);
      return true;
    }

    if (!this.isDragging) {
      this.reset();
      this.potentialUndo = null; // Asegurar que potentialUndo es null
      document.getElementById(`mark-${num}`).classList.add("selected");
      this.selected.push(num);
      this.onSelectionUpdate(this.selected);
      return true;
    }
    return false;
  }
  areAdjacent(posA, posB) {
    if (posA === posB) return false;
    const [rowA, colA] = [posA.charCodeAt(0) - 97, parseInt(posA[1]) - 1];
    const [rowB, colB] = [posB.charCodeAt(0) - 97, parseInt(posB[1]) - 1];
    return Math.abs(rowA - rowB) <= 1 && Math.abs(colA - colB) <= 1;
  }
  handlePointerDown(e) {
    if (!e.isPrimary) return;

    this._logEvent(e, { active: this._activePointerId });

    const isInsideBoard = !!e?.target?.closest(".board");
    const hitbox = this.getHitboxFromEvent(e);

    // Si hay una selección activa y clickeamos fuera de un hitbox, resetear
    if (this.selected.length > 0 && (!hitbox || !isInsideBoard)) {
      this.reset();
      return;
    }

    // Si no hay hitbox o estamos fuera del tablero, ignorar
    if (!hitbox || !isInsideBoard) return;

    // Si ya tenemos un pointer activo, ignorar
    if (this._activePointerId !== null) return;

    e.preventDefault();
    this._activePointerId = e.pointerId;
    this._isPointerDown = true;
    this._isDragging = false;
    this._currentHitbox = hitbox;
    this._pointerDownTime = Date.now();

    const success = this.handleLetterSelection(hitbox.dataset.position);
    this._logEvent(e, {
      success,
      selected: this.selected.length,
      position: hitbox.dataset.position,
    });
  }
  handlePointerMove(e) {
    if (!e.isPrimary || e.pointerId !== this._activePointerId) return;
    if (!this._isPointerDown || !this._currentHitbox) return;

    const currentHitbox = this.getHitboxFromEvent(e);
    if (!currentHitbox) return;

    // Marcar como arrastre si cambiamos de hitbox
    if (currentHitbox !== this._currentHitbox) {
      this._isDragging = true;
    }

    const currentPos = currentHitbox.dataset.position;
    if (this.selected[this.selected.length - 1] === currentPos) return;

    // Solo procesar selección si estamos arrastrando
    if (this._isDragging) {
      this.handleLetterSelection(currentPos);
    }
  }
  handlePointerUp(e) {
    if (!e.isPrimary || e.pointerId !== this._activePointerId) return;

    this._logEvent(e, {
      active: this._activePointerId,
      timeSinceDown: Date.now() - this._pointerDownTime,
    });

    // Solo procesar clicks si fue rápido y no hubo arrastre
    const isQuickClick = Date.now() - this._pointerDownTime < 300;
    if (isQuickClick && !this._isDragging) {
      const hitbox = this.getHitboxFromEvent(e);
      if (hitbox?.dataset.position === this.potentialUndo) {
        document
          .getElementById(`mark-${this.potentialUndo}`)
          .classList.remove("selected");
        this.selected.pop();
        this.drawLine();
      }
    }

    // Resetear estados
    this._isPointerDown = false;
    this._isDragging = false;
    this._currentHitbox = null;
    this._activePointerId = null;
    this.startedInsideBoard = false;
  }
  handlePointerOut() {
    this._isPointerDown = false;
    return this._isDragging || this.selected.length > 0;
  }
  handlePointerEnter(e) {
    if (
      e.buttons > 0 &&
      (this.startedInsideBoard || this.selected.length > 0)
    ) {
      this._isPointerDown = true;
    }
  }
  getHitboxFromEvent(e) {
    if (!e) return null;
    return e.target?.closest(".hitbox");
  }
  isPlayableArea(e) {
    if (!e?.target) return false;
    return e.target.closest(".hitbox") || e.target.closest(".board");
  }
  get isDragging() {
    return this._isDragging;
  }
  get isPointerDown() {
    return this._isPointerDown;
  }
  handleTouchMove(e) {
    this.handlePointerMove(e);
  }
  getWasSelecting() {
    return this._wasSelecting;
  }
  setWasSelecting(value) {
    this._wasSelecting = value;
  }
  // Agregar método para loggear eventos
  _logEvent(event, data = {}) {
    // Solo loggear eventos importantes o en modo desarrollo
    if (!import.meta.env.DEV || event.type === "pointermove") return;

    const eventInfo = {
      type: event.type,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      timestamp: Date.now(),
      ...data,
    };
    this._eventLog.push(eventInfo);

    // Solo mantener últimos 10 eventos
    if (this._eventLog.length > 10) this._eventLog.shift();
  }
  // Método para manejar clicks globales
  handleGlobalClick(e) {
    if (
      e.target.closest(".hitbox") ||
      e.target.closest(".board") ||
      e.target.closest(".modal-overlay") ||
      e.target.closest(".menu")
    ) {
      return;
    }

    // Si llegamos aquí, el click fue fuera de todas las áreas interactivas
    this.reset();
  }
}

export class InteractionManager {
  constructor(gameState) {
    // Verificar que tengamos una instancia válida de gameState y su board
    if (!gameState?.board) {
      throw new Error("GameState o board no válidos");
    }

    this.game = gameState;
    this.selectionManager = new SelectionManager(gameState.board, (selection) =>
      gameState.onSelectionUpdate?.(selection)
    );
    this.handleGlobalClick = this.handleGlobalClick.bind(this);
  }

  bindPointerEvents() {
    if (!this.game.board) return;

    if (this.game.board._boundEvents) return;

    const events = {
      pointerdown: "handlePointerDown",
      pointermove: "handlePointerMove",
      pointerup: "handlePointerUp",
      pointercancel: "handlePointerUp",
    };

    const board = this.game.board;
    board.style.touchAction = "none";
    board.style.userSelect = "none";
    board.style.webkitTouchCallout = "none";
    board.style.webkitUserSelect = "none";

    Object.entries(events).forEach(([event, handler]) => {
      board.addEventListener(
        event,
        (e) => {
          e.preventDefault();
          this.selectionManager[handler].call(this.selectionManager, e);
        },
        { passive: false }
      );
    });

    this.game.board._boundEvents = true;
  }

  bindAll() {
    this.bindPointerEvents();
    this.bindThemeEvents();
    this.bindModalEvents();
    this.bindLifecycleEvents();
    this.bindResizeEvents();
    this.bindButtonEvents();
    this.bindVibrationEvents();
    document.addEventListener("click", this.handleGlobalClick);
  }

  bindThemeEvents() {
    window.addEventListener("themechange", (e) => {
      this.game.handleThemeChange(e.detail.theme);
    });
  }

  bindModalEvents() {
    const modalHandlers = {
      menu: document.querySelector(".menu"),
      modal: document.getElementById("modal"),
      themeModal: document.getElementById("theme-modal"),
      victoryModal: document.getElementById("victory-modal"),
    };

    const isAnyModalActive = () =>
      Object.values(modalHandlers).some((modal) =>
        modal?.classList.contains("active")
      );

    const closeModal = (modal) => {
      if (modal?.id === "victory-modal") return;
      modal?.classList.remove("active");
      if (!isAnyModalActive()) {
        this.game.resumeTimer();
      }
    };

    const modalNavigation = {
      menu: () => {
        modalHandlers.modal.classList.add("active");
        this.game.pauseTimer();
      },
      "theme-button": () => {
        modalHandlers.modal.classList.remove("active");
        modalHandlers.themeModal.classList.add("active");
      },
      "back-button": () => {
        modalHandlers.themeModal.classList.remove("active");
        modalHandlers.modal.classList.add("active");
      },
    };

    Object.entries(modalNavigation).forEach(([id, handler]) => {
      document
        .querySelector(id === "menu" ? ".menu" : `#${id}`)
        ?.addEventListener("click", (event) => {
          event.stopPropagation();
          handler();
        });
    });

    modalHandlers.victoryModal?.addEventListener("click", (event) => {
      if (event.target === modalHandlers.victoryModal) {
        event.stopPropagation();
      }
    });

    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      if (modal.id === "victory-modal") return;
      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closeModal(modal);
          if (!isAnyModalActive()) {
            this.game.resumeTimer();
          }
        }
      });
    });

    // Prevenir propagación de clicks en modales/menú para evitar resetear selección
    Object.values(modalHandlers).forEach((modal) => {
      if (!modal) return;
      modal.addEventListener("click", (e) => e.stopPropagation());
    });
  }

  bindLifecycleEvents() {
    document.addEventListener("appPause", () => {
      this.game.onAppPause();
    });

    document.addEventListener("appResume", () => {
      this.game.onAppResume();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.game.onAppPause();
      } else {
        this.game.onAppResume();
      }
    });
  }

  bindResizeEvents() {
    const selectionManager = this.selectionManager;

    window.addEventListener("resize", () => {
      if (selectionManager?.selected?.length > 0) {
        selectionManager.drawLine();
      }
    });

    // Usar AnimationManager directamente en lugar de this.game.updateWordList
    new ResizeObserver(() => {
      requestAnimationFrame(() => {
        AnimationManager.cleanupAnimations();
      });
    }).observe(document.documentElement);
  }

  bindButtonEvents() {
    const nativeHandlers = {
      "vibration-toggle": async () => {
        try {
          const newState = !S.isVibrationEnabled;
          await S.setVibrationEnabled(newState);
          this.updateVibrationButtonText(newState);
          if (newState) {
            await NativeServices.vibrate("LIGHT");
          }
        } catch (error) {
          console.error("Error changing vibration state:", error);
        }
      },
      "test-notification": async () => {
        try {
          await NativeServices.initialize();
          const sent = await NativeServices.sendNotification(
            "Time to play!",
            "New challenges await in GameSalad"
          );

          if (!sent) {
            if (Notification.permission === "denied") {
              alert(
                "Por favor habilita los permisos de notificación en tu navegador para usar esta función."
              );
            } else if (!("Notification" in window)) {
              alert("Tu navegador no soporta notificaciones.");
            } else {
              console.warn("No se pudo enviar la notificación");
            }
          }
        } catch (error) {
          console.error("Error sending notification:", error);
        }
      },
    };

    // Inicializar el texto del botón según el estado guardado
    const vibrationButton = document.getElementById("vibration-toggle");
    if (vibrationButton) {
      this.updateVibrationButtonText(S.isVibrationEnabled);
    }

    Object.entries(nativeHandlers).forEach(([id, handler]) => {
      document.getElementById(id)?.addEventListener("click", handler);
    });

    const gameButtons = {
      "reset-game": () => {
        this.game.resetTimer();
        this.game.loadLevel(this.game.currentLevel.id);
        document.getElementById("modal").classList.remove("active");
      },
      "restart-level": () => {
        this.game.resetTimer();
        this.game.loadLevel(this.game.currentLevel.id);
        document.getElementById("victory-modal").classList.remove("active");
      },
      "next-level": async () => {
        // Obtener índice actual del nivel
        const currentLevelId = this.game.currentLevel.id;
        const currentIndex = LEVEL_ORDER.indexOf(currentLevelId);

        // Verificar que tengamos un índice válido
        if (currentIndex === -1) {
          console.error(
            "Nivel actual no encontrado en LEVEL_ORDER:",
            currentLevelId
          );
          return;
        }

        // Calcular siguiente nivel
        const nextIndex = (currentIndex + 1) % LEVEL_ORDER.length;
        const nextLevelId = LEVEL_ORDER[nextIndex];

        // Verificar que el siguiente nivel existe
        if (!nextLevelId) {
          console.error("No se pudo determinar el siguiente nivel");
          return;
        }

        try {
          // Cargar siguiente nivel
          await this.game.loadLevel(nextLevelId);

          // Cerrar modal de victoria
          document.getElementById("victory-modal").classList.remove("active");

          // Detener efectos de confeti
          AnimationManager.stopConfetti();
        } catch (error) {
          console.error("Error cargando siguiente nivel:", error);
        }
      },
    };

    Object.entries(gameButtons).forEach(([id, handler]) => {
      document.getElementById(id)?.addEventListener("click", handler);
    });
  }

  // Nuevo método auxiliar para actualizar el texto del botón
  updateVibrationButtonText(enabled) {
    const button = document.getElementById("vibration-toggle");
    if (button) {
      button.textContent = enabled ? "Disable Vibration" : "Enable Vibration";
    }
  }

  bindVibrationEvents() {
    const events = {
      "word-found": async (e) => {
        if (!S.isVibrationEnabled) return;
        await NativeServices.vibrate(
          e.detail.isLevelComplete ? "HEAVY" : "LIGHT"
        );
      },
      "victory-effect": async (e) => {
        if (!S.isVibrationEnabled) return;
        await NativeServices.vibrate(
          e.detail.stage === "second-wave" ? "HEAVY" : "MEDIUM"
        );
      },
    };

    Object.entries(events).forEach(([event, handler]) => {
      window.addEventListener(event, handler);
    });
  }

  handleGlobalClick(e) {
    // Delegar al SelectionManager
    this.selectionManager.handleGlobalClick(e);
  }

  // Si quieres limpiar el evento cuando se destruya el componente
  destroy() {
    document.removeEventListener("click", this.handleGlobalClick);
  }
}

// Exportar solo InteractionManager
export { InteractionManager as I };
