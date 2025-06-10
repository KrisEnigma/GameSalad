import { ElementService } from "./element-service.js";
import { ThemeService } from "./theme-service.js";
import { BoardService } from "./board-service.js";
import { WordListService } from "./word-list-service.js";
import { LevelService } from "./level-service.js";
import { GameUIService } from "./game-ui-service.js";
import { SelectionService } from "./selection-service.js";
import { TimerService } from "./timer-service.js";
import { EventService } from "./event-service.js";
import { TitleService } from "./title-service.js";
import { LEVEL_ORDER } from "./levels.js";
import { ConfigurationService } from "./configuration-service.js";
import { StorageManager } from "./storage.js";
import { BackHandler } from "./back-handler.js";

class Game {
  static GAME_STATES = {
    INITIALIZING: "initializing",
    READY: "ready",
    PLAYING: "playing",
    PAUSED: "paused",
    LEVEL_COMPLETE: "levelComplete",
    ERROR: "error",
  };

  constructor() {
    this.events = new EventService();
    this.gameState = Game.GAME_STATES.INITIALIZING;
    this.isInitialized = false;
    this.isPaused = false;
    this._wasTimerRunning = false;
  }

  get state() {
    return this.gameState;
  }

  set state(newState) {
    const oldState = this.gameState;
    this.gameState = newState;
    if (this.events) {
      this.events.emit("stateChange", { oldState, newState });
      console.log(`Estado del juego cambiado: ${oldState} -> ${newState}`);
    }
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.group("🎮 Iniciando juego...");
      this.state = Game.GAME_STATES.INITIALIZING;

      // Asignar BackHandler globalmente
      this.BackHandler = BackHandler;

      console.log("⌛ Esperando fuentes...");
      await document.fonts.ready;

      console.log("🔧 Inicializando servicios...");
      await this.initializeServices();

      console.log("🎲 Inicializando tablero...");
      this.boardService.initialize();

      console.log("📝 Cargando nivel...");
      await this.levelService.initialize();

      this.isInitialized = true;
      this.state = Game.GAME_STATES.PLAYING;
      this.events.emit(EventService.EVENTS.GAME_INITIALIZED);
      console.log("✅ Juego inicializado completamente");
    } catch (error) {
      console.error("❌ Error de inicialización:", error);
      this.state = Game.GAME_STATES.ERROR;
      throw error;
    } finally {
      console.groupEnd();
    }
  }

  async initializeServices() {
    console.group("🎮 Iniciando servicios del juego...");
    try {
      // 1. Inicializar StorageManager primero
      await StorageManager.initialize();

      // 2. Inicializar configuración
      this.config = ConfigurationService.getInstance();
      await this.config.initialize();
      console.log("✅ Configuración inicializada");

      // 3. Core services
      this.elements = new ElementService();
      this.elements.registerElements(this.config.getConfig("elements"));
      console.log("✅ ElementService inicializado");

      // 4. Theme service (depende de storage)
      this.themeService = new ThemeService();
      await this.themeService.initialize();
      console.log("✅ ThemeService inicializado");

      // 5. Resto de servicios
      this.boardService = new BoardService(this.elements);
      this.wordListService = new WordListService(this.elements);
      this.levelService = new LevelService(this.elements);
      this.uiService = new GameUIService(this.elements);

      // Escuchar el evento interno de palabra encontrada
      this.wordListService.events.on("internal:word-found", (event) => {
        // Emitir el evento público una sola vez
        this.events.emit(EventService.EVENTS.WORD_FOUND, event);
      });

      // Listen for board reset events
      this.boardService.events.on("boardReset", () => {
        // Update word list when board is reset
        if (this.levelService.getCurrentLevel()?.data) {
          this.wordListService.updateWordList(
            this.levelService.getCurrentLevel().data,
            this.boardService.foundWords
          );
        }
      });

      this.selection = new SelectionService({
        onSelectionChange: this.handleSelectionChange.bind(this),
        onSelectionComplete: this.handleSelectionComplete.bind(this),
      });

      // Title service
      const titleElement = this.elements.getElement("titleElement");
      const titleContainer = this.elements.getElement("titleContainer");
      this.titleService = new TitleService(titleElement, titleContainer);

      // Timer setup
      this.setupTimer();

      // Configurar event listeners después de la inicialización
      this.setupEventListeners();

      console.log("✅ Servicios inicializados correctamente");
    } catch (error) {
      console.error("❌ Error inicializando servicios:", error);
      this.state = Game.GAME_STATES.ERROR;
      throw error;
    }
    console.groupEnd();
  }

  setupTimer() {
    const timerElement = this.elements.getElement("timerElement");
    if (timerElement) {
      this.timer = new TimerService(timerElement);
      this.timer.events.on(TimerService.EVENTS.TIMER_PAUSE, () =>
        this.onTimerPause()
      );
      this.timer.events.on(TimerService.EVENTS.TIMER_RESUME, () =>
        this.onTimerResume()
      );
    }
  }

  setupEventListeners() {
    console.group("🎮 Configurando event listeners...");
    try {
      // App lifecycle events con manejo de errores
      this._setupAppLifecycleEvents();

      // Theme y level events
      this._setupGameEvents();

      // Game reset y advance events
      this._setupStateEvents();

      console.log("✅ Event listeners configurados correctamente");
    } catch (error) {
      console.error("❌ Error configurando event listeners:", error);
      this.state = Game.GAME_STATES.ERROR;
      throw error;
    }
    console.groupEnd();
  }

  _setupAppLifecycleEvents() {
    document.addEventListener("appPause", () => {
      console.log("📱 App pausada");
      this.onAppPause();
    });

    document.addEventListener("appResume", () => {
      console.log("📱 App resumida");
      this.onAppResume();
    });

    // Añadir manejo de visibilidad del documento para navegadores web y cuando la app pasa a segundo plano
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        console.log("📱 App en segundo plano (visibilitychange hidden)");
        this.onAppPause();
      } else {
        console.log("📱 App en primer plano (visibilitychange visible)");
        this.onAppResume();
      }
    });
  }

  _setupGameEvents() {
    if (!this.themeService?.events || !this.levelService?.events) {
      console.error("Los servicios no están inicializados correctamente");
      return;
    }

    this.themeService.events.on(EventService.EVENTS.THEME_CHANGE, () => {
      console.log("🎨 Tema cambiado, actualizando UI...");
      this.handleThemeChange();
    });

    this.levelService.events.on(EventService.EVENTS.LEVEL_LOADED, (event) => {
      console.log("🎮 Nivel cargado:", event);
      this.handleLevelLoaded();
    });
  }

  _setupStateEvents() {
    this.events.on(EventService.EVENTS.GAME_RESET, () => {
      console.log("🔄 Reiniciando nivel...");
      this.resetGame();
    });

    this.events.on(EventService.EVENTS.LEVEL_ADVANCE, () => {
      console.log("⏭️ Avanzando al siguiente nivel...");
      this.handleLevelAdvance();
    });

    this.events.on("stateChange", ({ oldState, newState }) => {
      this._handleStateChange(oldState, newState);
    });
  }

  _handleStateChange(oldState, newState) {
    switch (newState) {
      case Game.GAME_STATES.PLAYING:
        if (this.timer && !this.timer.isRunning) {
          console.log("[GAME] Cambio a estado PLAYING, iniciando timer");
          this.timer.start();
        }
        break;
      case Game.GAME_STATES.PAUSED:
        if (this.timer && this.timer.isRunning) {
          console.log("[GAME] Cambio a estado PAUSED, pausando timer");
          this.timer.pause();
        }
        break;
      case Game.GAME_STATES.LEVEL_COMPLETE:
        if (this.timer && this.timer.isRunning) {
          console.log("[GAME] Cambio a estado LEVEL_COMPLETE, pausando timer");
          this.timer.pause();
        }
        break;
      case Game.GAME_STATES.ERROR:
        if (this.timer && this.timer.isRunning) {
          console.log(
            `[GAME] Error en el juego. Estado anterior: ${oldState}, pausando timer`
          );
          this.timer.pause();
        }
        break;
    }
  }

  handleSelectionChange(selection) {
    if (this.state !== Game.GAME_STATES.PLAYING || !selection?.length) return;

    // Actualizar la UI de selección
    this.uiService.updateSelection(selection);

    // Verificar la palabra durante la selección
    const path = selection.join("");
    const currentLevel = this.levelService.getCurrentLevel();
    const levelData = currentLevel?.data || {};

    // Buscar si el path coincide exactamente con alguna palabra no encontrada
    const wordMatch = Object.entries(levelData).find(
      ([word, wordPath]) =>
        wordPath === path && !this.boardService.foundWords.has(word)
    );

    if (wordMatch) {
      const [word] = wordMatch;
      this.handleWordFound(selection, word);
      // Limpiar la selección después de encontrar la palabra
      this.selection.clearSelection();
    }
  }

  handleSelectionComplete(selection) {
    // Ya no necesitamos verificar la palabra aquí, se hace en handleSelectionChange
    if (this.state !== Game.GAME_STATES.PLAYING || !selection?.length) return;
    this.selection.clearSelection();
  }

  async handleWordFound(selection, word) {
    console.group(`🎮 Game.handleWordFound("${word}")`);
    if (this.state !== Game.GAME_STATES.PLAYING) {
      console.warn("❌ Estado del juego no es PLAYING");
      console.groupEnd();
      return;
    }

    const currentLevel = this.levelService.getCurrentLevel();
    const levelContainsWord =
      currentLevel?.data && Object.keys(currentLevel.data).includes(word);

    if (!levelContainsWord) {
      console.warn(`❌ Palabra '${word}' no pertenece al nivel actual`);
      console.groupEnd();
      return;
    }

    try {
      // 1. Obtener elemento de palabra
      const wordElement = this.wordListService.getWordElement(
        word,
        currentLevel.data
      );

      // 2. Activar modo animación
      this.selection.setAnimating(true);

      // 3. Marcar palabra como encontrada antes de la animación
      this.boardService.markWordAsFound(word);
      this.wordListService.markWordAsFound(wordElement, word);

      // 4. Limpiar selección actual
      this.selection.clearSelection();

      // 5. Animar la palabra encontrada
      await this.uiService.animateWordFound(selection, wordElement, word);

      // 6. Actualizar letras no usadas
      this.boardService.updateUnusedLetters(currentLevel.data);

      // 7. Verificar si el nivel está completo
      const isLevelComplete = this.levelService.isLevelComplete(
        this.boardService.foundWords
      );

      // 8. Manejar completado del nivel
      if (isLevelComplete) {
        this.state = Game.GAME_STATES.LEVEL_COMPLETE;
        await this.handleLevelComplete();
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      this.state = Game.GAME_STATES.ERROR;
    } finally {
      this.selection.setAnimating(false);
      console.groupEnd();
    }
  }

  async handleLevelComplete() {
    if (this.state !== Game.GAME_STATES.LEVEL_COMPLETE) return;
    await this.uiService.showVictory(this.timer?.getTimeString());
  }

  handleThemeChange() {
    this.wordListService.updateWordList(
      this.levelService.getLevelData(),
      this.boardService.foundWords
    );
    this.titleService.fit(); // Ahora usamos el titleService directamente
  }

  handleLevelLoaded() {
    const currentLevel = this.levelService.getCurrentLevel();
    if (!currentLevel) {
      console.error("❌ [Game] No hay nivel actual");
      return;
    }

    console.log(
      `📋 [Game] Nivel cargado: ${currentLevel.id} (${
        Object.keys(currentLevel.data).length
      } palabras)`
    );

    // Reseteo forzado del estado antes de actualizar
    this.boardService.foundWords = new Set();

    // Actualizamos el tablero con el nuevo nivel
    this.boardService.updateBoard(currentLevel.data);

    // Actualizamos la lista de palabras con estado limpio
    this.wordListService.updateWordList(currentLevel.data, new Set());

    // Actualizamos el título
    this.titleService.updateTitle(currentLevel.name);
  }

  async handleLevelAdvance() {
    const currentLevelId = this.levelService.getCurrentLevel()?.id;
    if (!currentLevelId) return;

    try {
      // Reseteamos todo el estado del juego de manera forzada
      console.log(`🔄 [Game] Avanzando nivel: ${currentLevelId} -> siguiente`);

      // 1. Congelar UI y detener interacciones
      await this._freezeGameInteractions();

      // 2. Resetear estados internos
      this._resetGameState();

      // 3. Cargar el siguiente nivel
      const nextLevelId = this._getNextLevelId(currentLevelId);
      const newLevel = await this._loadNextLevel(nextLevelId);

      // 4. Actualizar UI y estado visual
      this._updateGameVisuals(newLevel);

      // 5. Reiniciar el timer
      this.startTimer();

      // 6. Verificación final y cambio de estado
      console.log(
        `✅ [Game] Nivel cambiado: ${nextLevelId} con ${
          Object.keys(newLevel.data).length
        } palabras`
      );
      this.state = Game.GAME_STATES.PLAYING;
    } catch (error) {
      console.error("❌ [Game] Error durante el cambio de nivel:", error);
      this.state = Game.GAME_STATES.ERROR;
    }
  }

  async _freezeGameInteractions() {
    this.selection.setAnimating(false);
    this.selection.clearSelection();
    this.timer?.reset();
    return Promise.resolve();
  }

  _resetGameState() {
    this.boardService.foundWords = new Set();
    this.boardService.usedLetters = new Set();
    this.wordListService.resetState();
  }

  _getNextLevelId(currentLevelId) {
    const levelIndex = LEVEL_ORDER.indexOf(currentLevelId);
    return levelIndex === -1 || levelIndex >= LEVEL_ORDER.length - 1
      ? LEVEL_ORDER[0]
      : LEVEL_ORDER[levelIndex + 1];
  }

  async _loadNextLevel(nextLevelId) {
    console.log(`🌟 [Game] Cargando nivel: ${nextLevelId}`);
    const newLevel = await this.levelService.loadLevel(nextLevelId);

    if (!newLevel || !newLevel.data) {
      console.error("❌ [Game] Error al cargar el nivel:", nextLevelId);
      throw new Error(`No se pudo cargar el nivel: ${nextLevelId}`);
    }

    return newLevel;
  }

  _updateGameVisuals(newLevel) {
    // 1. Actualizar el tablero con la nueva información
    this.boardService.updateBoard(newLevel.data);

    // 2. Resetear el estado visual del tablero
    this.boardService.resetState();

    // 3. Actualizar la lista de palabras
    this.wordListService.updateWordList(newLevel.data, new Set());
  }

  // Timer controls con mejor manejo de estados
  startTimer() {
    if (
      this.state === Game.GAME_STATES.PLAYING &&
      this.timer &&
      !this.timer.isRunning
    ) {
      console.log("[GAME] Iniciando timer desde startTimer()");
      this.timer.start();
    }
  }

  onTimerPause() {
    console.log("[GAME] Evento TIMER_PAUSE recibido");
    this.saveGameState();
    if (this.state === Game.GAME_STATES.PLAYING) {
      this.state = Game.GAME_STATES.PAUSED;
    }
  }

  onTimerResume() {
    console.log("[GAME] Evento TIMER_RESUME recibido");
    this.checkGameState();
    if (this.state === Game.GAME_STATES.PAUSED) {
      this.state = Game.GAME_STATES.PLAYING;
    }
  }

  // App lifecycle con mejor manejo de estados
  onAppPause() {
    console.log("[GAME] App pausada");
    this._wasTimerRunning = this.timer?.isRunning ?? false;
    this.isPaused = true;
    this.state = Game.GAME_STATES.PAUSED;
    this.saveGameState();
  }

  onAppResume() {
    console.log("[GAME] App resumida");
    this.isPaused = false;
    if (this._wasTimerRunning) {
      console.log("[GAME] Timer estaba corriendo, restaurando a PLAYING");
      this.state = Game.GAME_STATES.PLAYING;
      this._wasTimerRunning = false;
    }
    this.checkGameState();
  }

  async saveGameState() {
    await this.levelService.saveState();
  }

  async checkGameState() {
    await this.levelService.checkState();
  }

  async resetGame() {
    try {
      console.group("🔄 Reseteando juego...");
      this.selection.setAnimating(false);
      this.selection.clearSelection();
      this.boardService.resetState();
      this.timer?.reset();

      const currentLevel = this.levelService.getCurrentLevel();
      if (currentLevel) {
        await this.levelService.loadLevel(currentLevel.id);
        this.state = Game.GAME_STATES.PLAYING;
      }
    } catch (error) {
      console.error("❌ Error reseteando juego:", error);
      this.state = Game.GAME_STATES.ERROR;
    } finally {
      console.groupEnd();
    }
  }

  destroy() {
    console.log("🗑️ Destruyendo instancia del juego...");
    this.state = Game.GAME_STATES.INITIALIZING;
    this.events.destroy();
    this.elements.destroy();
    this.themeService.destroy();
    this.boardService.destroy();
    this.wordListService.destroy();
    this.levelService.destroy();
    this.uiService.destroy();
    this.selection.destroy();
    this.titleService.destroy();
    this.timer?.destroy();
  }
}

// Exportar la instancia del juego
const gameInstance = new Game();
console.log("Instancia del juego creada");

// Iniciar el juego cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM cargado, iniciando juego...");
    gameInstance.initialize();
  });
} else {
  console.log("DOM ya cargado, iniciando juego inmediatamente...");
  gameInstance.initialize();
}

export default gameInstance;
