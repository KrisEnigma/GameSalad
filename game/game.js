import { Capacitor } from "@capacitor/core";
import { L as LEVEL_ORDER, a as LEVELS } from "./levels.js";
import { A as AnimationManager } from "../ui/animations.js";
import { T as ThemeSelector } from "../core/theming.js";
import { S as Storage } from "../core/storage.js";
import { N as NativeServices } from "../core/platform.js";
import { TitleFitter } from "../ui/typography.js";
import { InteractionManager } from "../ui/interactions.js";
import { GameTimer } from "./timer.js";

class GameState {
  static instance = null;
  static instanceInitialized = false;

  constructor() {
    if (GameState.instance) {
      return GameState.instance;
    }

    GameState.instance = this;
    this.themeSelector = new ThemeSelector();
  }

  async loadFonts() {
    // Fuentes críticas necesarias para el inicio
    const criticalFonts = [
      {
        family: '"Rubik"',
        weight: "500",
        text: "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789",
      },
      {
        family: '"Rubik"',
        weight: "700",
        text: "AaBbCc0123",
      },
    ];

    // Fuentes secundarias que se pueden cargar después
    const secondaryFonts = [
      {
        family: '"JetBrains Mono"',
        weight: "700",
        text: "AaBbCc0123",
      },
    ];

    try {
      // Cargar primero las fuentes críticas
      const criticalLoading = criticalFonts.map((font) =>
        document.fonts.load(`${font.weight} 16px ${font.family}`, font.text)
      );

      await Promise.all(criticalLoading);

      // Cargar fuentes secundarias en segundo plano
      requestIdleCallback(() => {
        Promise.all(
          secondaryFonts.map((font) =>
            document.fonts.load(`${font.weight} 16px ${font.family}`, font.text)
          )
        ).catch((err) =>
          console.debug("Error cargando fuentes secundarias:", err)
        );
      });

      return true;
    } catch (error) {
      console.error("Error cargando fuentes críticas:", error);
      return false;
    }
  }

  async initialize() {
    if (GameState.instanceInitialized) return;

    try {
      // Empezar a cargar las fuentes inmediatamente
      const fontsPromise = this.loadFonts();

      // Inicializar servicios básicos en paralelo
      await Promise.all([
        Storage.initialize(),
        NativeServices.initialize(),
        fontsPromise,
      ]);

      // Continuar con la inicialización secuencial
      await this.initializeCore();
      await this.initializeUI();
      await this.initializeGameState();
      await this.finalizeInitialization();

      GameState.instanceInitialized = true;
      window.dispatchEvent(new CustomEvent("game-initialized"));
    } catch (error) {
      console.error("❌ Error:", error);
      this.handleInitializationError();
    }
  }

  async initializeUI() {
    if (this._uiInitialized) return;

    this.initializeElements();
    this.initializeState();
    this.initializeBoard();

    this.interactionManager = new InteractionManager(this);
    this.interactionManager.bindAll();
    this._uiInitialized = true;
  }

  async initializeCore() {
    if (this._coreInitialized) return true;

    try {
      // Initialize Storage first
      await Storage.initialize();

      // Wait for fonts
      await document.fonts.ready;

      // Initialize theme selector after Storage
      await this.themeSelector.initialize();

      if (!this._resourcesReadyEmitted) {
        document.dispatchEvent(new CustomEvent("resources-ready"));
        this._resourcesReadyEmitted = true;
      }

      this._coreInitialized = true;
      return true;
    } catch (error) {
      console.error("❌ Error en initializeCore:", error);
      document.documentElement.setAttribute("data-theme", "dark");
      return false;
    }
  }

  async initializeGameState() {
    const defaultLevel = LEVEL_ORDER[0];
    const savedLevel = await Storage.getCurrentLevel();
    const levelToLoad =
      savedLevel && LEVELS[savedLevel] ? savedLevel : defaultLevel;

    this.currentLevel = {
      ...LEVELS[levelToLoad],
      id: levelToLoad,
      name: LEVELS[levelToLoad].name,
    };

    await this.updateAllWithoutTitleFit(levelToLoad);
  }

  async finalizeInitialization() {
    // Asegurarnos de que initialization-complete solo se emite una vez
    if (!this._initializationCompleted) {
      document.dispatchEvent(new CustomEvent("initialization-complete"));
      this._initializationCompleted = true;
    }

    // Solo ajustar el título si es necesario
    if (this.titleFitter && !this._titleAdjusted) {
      await this.titleFitter.fit();
      document.dispatchEvent(
        new CustomEvent("title-adjusted", {
          detail: { final: true },
        })
      );
      this._titleAdjusted = true;
    }

    // Inicializar SW solo una vez y solo si es necesario
    if (!this._swInitialized && !Capacitor.isNative) {
      this._swInitialized = true;
      await NativeServices.initializeServiceWorker();
    }
  }

  handleInitializationError() {
    const defaultLevel = LEVEL_ORDER[0];
    console.log("Recuperando con nivel por defecto:", defaultLevel);
    this.currentLevel = {
      ...LEVELS[defaultLevel],
      id: defaultLevel,
      name: LEVELS[defaultLevel].name,
    };
    this.initializeElements();
    this.initializeState();
    this.initializeBoard();
    this.updateAll(defaultLevel);
    this.showContent();
  }

  async onAppPause() {
    if (this.timer && !this.timer.isPaused) {
      this.pauseTimer();
      this._wasTimerRunning = true;
    }
    await Storage.setCurrentLevel(this.currentLevel.id);
  }

  onAppResume() {
    this.checkAndHandleDataReset();
    if (this._wasTimerRunning && this.timer?.isPaused) {
      this.resumeTimer();
      this._wasTimerRunning = false;
    }
  }

  async saveGameState() {
    try {
      await Storage.setCurrentLevel(this.currentLevel.id);
    } catch (error) {
      console.error("Error guardando estado:", error);
    }
  }

  async checkAndHandleDataReset() {
    try {
      await Storage.initialize();
      const [theme, settings, currentLevel] = await Promise.all([
        Storage.get(Storage.keys.THEME),
        Storage.get(Storage.keys.SETTINGS),
        Storage.get(Storage.keys.CURRENT_LEVEL)
      ]);
      
      if (!theme || !settings || !currentLevel) {
        await this.handleDataReset();
      }
    } catch (error) {
      console.error("Error verificando datos:", error);
      await this.handleDataReset();
    }
  }

  async handleDataReset() {
    try {
      await Storage.resetToDefaults();
      await this.themeSelector.initialize();
      await this.loadLevel(LEVEL_ORDER[0]);
    } catch (error) {
      console.error("Error reinicializando datos:", error);
    }
  }

  setTheme(themeName) {
    return this.themeSelector.setTheme(themeName);
  }

  async handleThemeChange(themeName) {
    try {
      if (this._lastAppliedTheme === themeName) return;
      await this.themeSelector.setTheme(themeName);
      this._lastAppliedTheme = themeName;
      this.titleElement.style = "";
      await document.fonts.ready;
      const computedStyle = getComputedStyle(this.titleElement);
      await document.fonts.load(
        `${computedStyle.fontSize} ${computedStyle.fontFamily}`
      );
      if (this.titleFitter) {
        await this.titleFitter.fit();
      }
      this.updateWordList();
    } catch (error) {
      console.error("❌ Error al cambiar tema:", error);
    }
  }

  async showContent() {
    console.group("👁️ Mostrando Contenido");
    try {
      const overlay = document.querySelector(".js-loading-overlay");
      if (!overlay) return;

      // Asegurar que tenemos los estilos base y el tema inicializado
      await Promise.all([
        this.themeSelector.injectBaseStyles(),
        document.fonts.ready,
      ]);

      // Animar la salida del overlay
      const progressBar = overlay.querySelector(".progress-bar");
      if (progressBar) {
        // Forzar una transición suave al 100%
        progressBar.style.transition = "transform 0.3s ease-out";
        progressBar.style.transform = "scaleX(1)";

        await new Promise((resolve) => {
          progressBar.addEventListener("transitionend", resolve, {
            once: true,
          });
        });
      }

      // Aplicar fade out
      overlay.classList.add("fade-out");
      await new Promise((resolve) => {
        overlay.addEventListener("transitionend", resolve, { once: true });
      });

      // Limpiar
      overlay.remove();
      document.body.classList.remove("js-loading");
    } catch (error) {
      console.error("❌ Error:", error);
      document.querySelector(".js-loading-overlay")?.remove();
      document.body.classList.remove("js-loading");
    } finally {
      console.groupEnd();
    }
  }

  async updateAllWithoutTitleFit(levelId) {
    if (!this.currentLevel?.data) return;
    this.updateBoard();
    this.updateTitleContent();
    this.updateWordList();
    this.updateUnusedLetters();
    this.updateLevelNumber(levelId);
    this.resetTimer();
    this.startTimer();
  }

  updateTitleContent() {
    if (!this.titleElement || !this.currentLevel?.name) return;
    const userSelectStyles =
      "user-select: text; -webkit-user-select: text; -moz-user-select: text;";
    const isPlatformAndroid = Capacitor.getPlatform() === "android";
    const fontSize = isPlatformAndroid ? "16px" : "24px";
    this.titleElement.textContent = this.currentLevel.name;
    this.titleElement.style.cssText = `${userSelectStyles}; font-size: ${fontSize};`;
  }

  async fitTitle() {
    if (this._titleFitInProgress || !this.titleFitter) return;
    try {
      this._titleFitInProgress = true;
      await this.titleFitter.fit();
    } finally {
      this._titleFitInProgress = false;
    }
  }

  initializeElements() {
    const elements = {
      titleContainer: ".title-container",
      titleElement: ".title",
      board: ".board",
      wordList: ".word-list",
      levelNumber: ".level-number",
      timerElement: ".timer",
    };

    for (const [key, selector] of Object.entries(elements)) {
      this[key] = document.querySelector(selector);
      if (!this[key] && (key === "titleElement" || key === "board")) {
        throw new Error(`Elemento crítico ${key} no encontrado`);
      }
    }

    // Remover setupTimer() ya que ahora usamos GameTimer
    this.timer = new GameTimer(this.timerElement);
    this.setupTitleFitter();
  }

  setupTitleFitter() {
    if (!this.titleElement) return;
    this.titleFitter = new TitleFitter(this.titleElement);
    const isPlatformAndroid = Capacitor.getPlatform() === "android";
    const fontSize = isPlatformAndroid ? "16px" : "24px";
    const userSelectStyles =
      "user-select: text; -webkit-user-select: text; -moz-user-select: text;";
    this.titleElement.style.cssText = `${userSelectStyles}; font-size: ${fontSize};`;
  }

  initializeState() {
    this.currentLevel = null;
    this.foundWords = new Set();
    this.usedLetters = new Set();
    this.availableThemes = new Map();
    this.themeDisplayNames = new Map();
    this.categoryOrder = [];
    // Ya no necesitamos crear selectionManager aquí
  }

  onSelectionUpdate(selection) {
    if (this.checkWord(selection)) {
      AnimationManager.resetSelectionWithDelay(
        this.interactionManager.selectionManager
      );
    }
  }

  initializeBoard() {
    const fragment = document.createDocumentFragment();
    for (let i = 1; i <= 16; i++) {
      const row = String.fromCharCode(96 + Math.ceil(i / 4));
      const col = ((i - 1) % 4) + 1;
      const position = `${row}${col}`;
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.id = `tile-${position}`;
      cell.innerHTML = `
                <div class="hitbox" data-position="${position}"></div>
                <div class="mark" id="mark-${position}"></div>
                <div class="text" id="letter-${position}"></div>
            `;
      fragment.appendChild(cell);
    }
    this.board.appendChild(fragment);
  }

  updateBoard() {
    if (!this.currentLevel?.data) {
      console.warn("No hay nivel actual o datos para mostrar");
      return;
    }
    const grid = Array(4)
      .fill()
      .map(() => Array(4).fill(""));
    const positions = Array(16)
      .fill()
      .map((unused, i) => {
        const row = String.fromCharCode(96 + Math.ceil((i + 1) / 4));
        const col = (i % 4) + 1;
        return `${row}${col}`;
      });
    positions.forEach((pos) =>
      document
        .getElementById(`tile-${pos}`)
        .classList.remove("found-temp", "unused")
    );
    Object.entries(this.currentLevel.data).forEach(([word, path]) => {
      word
        .replace(/\s+/g, "")
        .split("")
        .forEach((letter, i) => {
          const pos = path.slice(i * 2, i * 2 + 2);
          if (pos.length === 2) {
            const row = pos.charCodeAt(0) - 97;
            const col = parseInt(pos[1]) - 1;
            if (row >= 0 && row < 4 && col >= 0 && col < 4 && !grid[row][col]) {
              grid[row][col] = letter;
            }
          }
        });
    });
    positions.forEach((pos, i) => {
      document.getElementById(`letter-${pos}`).textContent =
        grid[Math.floor(i / 4)][i % 4];
    });
  }

  resetSelection() {
    this.interactionManager.selectionManager.reset();
  }

  async loadLevel(levelId) {
    AnimationManager.stopConfetti();
    this.resetControls();
    document.querySelectorAll(".animated-letter").forEach((el) => el.remove());
    this.currentLevel = { ...LEVELS[levelId], id: levelId };
    [this.foundWords, this.usedLetters].forEach((set) => set.clear());
    this.resetSelection();
    this.updateAll(levelId);
    await Storage.setCurrentLevel(levelId);
  }

  updateAll(levelId) {
    if (!this.currentLevel?.data) {
      console.error("❌ No hay nivel actual para actualizar", {
        levelId,
        currentLevel: this.currentLevel,
      });
      return;
    }
    this.updateBoard();
    this.updateTitle();
    if (this.titleFitter) {
      requestAnimationFrame(() => this.titleFitter.fit());
    }
    this.updateWordList();
    this.updateUnusedLetters();
    this.updateLevelNumber(levelId);
    this.resetTimer();
    this.startTimer();
  }

  updateTitle() {
    if (!this.titleElement) {
      console.error("Título no encontrado, reinicializando elementos...");
      this.initializeElements();
      if (!this.titleElement) {
        console.error("No se pudo recuperar el elemento título");
        return;
      }
    }
    if (!this.currentLevel?.name) {
      console.error("Nivel actual sin nombre:", this.currentLevel);
      return;
    }
    try {
      const userSelectStyles =
        "user-select: text; -webkit-user-select: text; -moz-user-select: text;";
      this.titleElement.textContent = this.currentLevel.name;
      const isPlatformAndroid = Capacitor.getPlatform() === "android";
      const fontSize = isPlatformAndroid ? "16px" : "24px";
      this.titleElement.style.cssText = `${userSelectStyles}; font-size: ${fontSize};`;
      if (this.titleFitter) {
        requestAnimationFrame(() => this.titleFitter.fit());
      }
    } catch (error) {
      console.error("Error actualizando título:", error);
    }
  }

  updateWordList() {
    if (!this.wordList || !this.currentLevel?.data) {
      console.warn("No hay lista de palabras o nivel actual");
      return;
    }

    this.wordList.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const words = Object.keys(this.currentLevel.data).sort((a, b) =>
      a.localeCompare(b)
    );
    const measureElement = document.createElement("div");
    measureElement.className = "word word-measure";
    measureElement.style.cssText = `
            position: absolute;position
            visibility: hidden;
            height: auto;
            width: auto;
            white-space: nowrap;
        `;
    document.body.appendChild(measureElement);
    words.forEach((word, index) => {
      const el = document.createElement("div");
      el.className = "word";
      el.setAttribute("data-index", index);
      const isFound = this.foundWords.has(word);
      const span = document.createElement("span");
      measureElement.textContent = word + "M";
      el.style.setProperty(
        "--word-content-width",
        `${measureElement.offsetWidth}px`
      );
      if (isFound) {
        el.classList.add("found");
        span.textContent = word;
      } else {
        const lengths = word.split(" ").map((part) => part.length);
        span.innerHTML = `<span class="word-length">${lengths.join(
          " + "
        )}</span>`;
      }
      el.appendChild(span);
      fragment.appendChild(el);
    });
    document.body.removeChild(measureElement);
    this.wordList.appendChild(fragment);
  }

  checkWord(selection) {
    if (!selection?.length) return false;
    const currentPath = selection.join("");
    for (const [word, path] of Object.entries(this.currentLevel.data)) {
      if (path === currentPath && !this.foundWords.has(word)) {
        const wordIndex = Object.keys(this.currentLevel.data)
          .sort((a, b) => a.localeCompare(b))
          .indexOf(word);
        const wordElement = this.wordList.querySelector(
          `[data-index="${wordIndex}"]`
        );
        if (wordElement?.classList.contains("found")) {
          return false;
        }
        this.foundWords.add(word);
        if (wordElement) {
          wordElement.classList.add("found", "found-initial");
          wordElement.addEventListener(
            "animationend",
            () => {
              wordElement.classList.remove("found-initial");
            },
            { once: true }
          );
        }
        this.animateFound(selection);
        this.resetControls();
        return true;
      }
    }
    return false;
  }

  async animateFound(selection) {
    const currentPath = selection.join("");
    const foundWord = Object.entries(this.currentLevel.data).find(
      ([, path]) => path === currentPath
    )?.[0];

    if (foundWord) {
      const isLevelComplete =
        this.foundWords.size === Object.keys(this.currentLevel.data).length;

      if (isLevelComplete) {
        this.pauseTimer();
        document.getElementById("final-time").textContent =
          this.timer.element.textContent;
      }

      // Emitir evento de palabra encontrada para la vibración
      window.dispatchEvent(
        new CustomEvent("word-found", {
          detail: { isLevelComplete },
        })
      );

      const wordIndex = Object.keys(this.currentLevel.data)
        .sort((a, b) => a.localeCompare(b))
        .indexOf(foundWord);

      const wordElement = this.wordList.querySelector(
        `[data-index="${wordIndex}"]`
      );
      if (!wordElement) return;

      await AnimationManager.animateWordFound(
        selection,
        wordElement,
        foundWord
      );
      this.updateUnusedLetters();

      if (isLevelComplete) {
        this.onLevelComplete();
      }
    }
  }

  onLevelComplete() {
    // Ya no necesitamos manejar la vibración aquí porque se maneja con los eventos
    AnimationManager.animateVictory(() => {
      this.showVictoryModal();
    });
  }

  // Consolidar manejo de vibraciones
  bindVibrationEvents() {
    const events = {
      "word-found": async (e) => {
        if (!Storage.isVibrationEnabled) return;
        await NativeServices.vibrate(
          e.detail.isLevelComplete ? "HEAVY" : "LIGHT"
        );
      },
      "victory-effect": async (e) => {
        if (!Storage.isVibrationEnabled) return;
        await NativeServices.vibrate(
          e.detail.stage === "second-wave" ? "HEAVY" : "MEDIUM"
        );
      },
    };

    Object.entries(events).forEach(([event, handler]) => {
      window.addEventListener(event, handler);
    });
  }

  updateUnusedLetters() {
    this.usedLetters.clear();
    Object.entries(this.currentLevel.data).forEach(([word, path]) => {
      if (!this.foundWords.has(word)) {
        for (let i = 0; i < path.length; i += 2) {
          const pos = path.slice(i, i + 2);
          if (pos.length === 2) this.usedLetters.add(pos);
        }
      }
    });
    const unusedPositions = [];
    for (let i = 1; i <= 16; i++) {
      const row = String.fromCharCode(96 + Math.ceil(i / 4));
      const col = ((i - 1) % 4) + 1;
      const pos = `${row}${col}`;
      const cell = document.getElementById(`tile-${pos}`);
      if (!this.usedLetters.has(pos)) {
        unusedPositions.push(pos);
        cell.querySelector(".hitbox")?.remove();
      } else {
        AnimationManager.updateCellStates([cell], { remove: ["unused"] });
        if (!cell.querySelector(".hitbox")) {
          const newHitbox = document.createElement("div");
          newHitbox.className = "hitbox";
          newHitbox.dataset.position = pos;
          cell.insertBefore(newHitbox, cell.firstChild);
        }
      }
    }
    if (unusedPositions.length) {
      AnimationManager.animateUnusedCells(unusedPositions);
    }
  }

  startTimer() {
    this.timer.start();
  }

  pauseTimer() {
    this.timer.pause();
    this.saveGameState();
  }

  resumeTimer() {
    this.timer.resume();
  }

  resetTimer() {
    this.timer.reset();
  }

  handleModalClose() {
    const activeModal = document.querySelector(
      ".modal-overlay.active:not(#victory-modal)"
    );
    if (activeModal) {
      activeModal.classList.remove("active");
      if (!document.querySelector(".modal-overlay.active")) {
        this.resumeTimer();
      }
    }
  }

  showVictoryModal() {
    this.pauseTimer();
    document.getElementById("final-time").textContent =
      this.timer.element.textContent;
    document.getElementById("victory-modal").classList.add("active");
  }

  updateLevelNumber(levelId) {
    if (!this.levelNumberElement) {
      this.levelNumberElement = document.querySelector(".level-number");
      if (!this.levelNumberElement) {
        console.error("No se pudo encontrar/crear el número de nivel");
        return;
      }
    }
    const levelNumber = LEVEL_ORDER.indexOf(levelId) + 1;
    if (!levelNumber) {
      console.warn("ID de nivel inválido:", levelId);
      return;
    }
    requestAnimationFrame(() => {
      this.levelNumberElement.textContent = `#${levelNumber}`;
      this.levelNumberElement.style.cssText = `
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
            `;
    });
  }

  resetControls() {
    this.interactionManager.selectionManager.resetControls();
  }
}

// Garantizar una única instancia
const gameInstance = new GameState();
export const game = gameInstance;

const startGame = async () => {
  try {
    await gameInstance.initialize();
  } catch (error) {
    console.error("Error:", error);
    document.querySelector(".js-loading-overlay")?.remove();
    document.body.classList.remove("js-loading");
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startGame);
} else {
  startGame();
}
