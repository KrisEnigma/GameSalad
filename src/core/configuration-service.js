import { StorageManager } from "./storage.js";

export class ConfigurationService {
  static instance = null;
  static isInitialized = false;

  static getInstance() {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  constructor() {
    if (ConfigurationService.instance) {
      throw new Error("Use ConfigurationService.getInstance()");
    }

    // Configuración por defecto
    this.config = {
      elements: {
        titleContainer: { selector: ".title-container", required: true },
        titleElement: { selector: ".title", required: true },
        board: { selector: ".board", required: true },
        wordList: { selector: ".word-list", required: true },
        levelNumber: { selector: ".level-number", required: true },
        timerElement: { selector: ".timer", required: true },
      },
      touch: {
        maxDelay: 300,
        minTouchMovement: 5,
        minMouseMovement: 2,
        preventDefaultGestures: true,
      },
      animation: {
        durations: {
          LETTER_DELAY: 25, // Un poco más de delay entre letras para que sea más fluido
          LETTER_ANIMATION: 350, // Animación más rápida
          FOUND_ANIMATION: 600, // Sincronizado con --animation-duration-found
          VICTORY_DELAY: 300,
          SELECTION_RESET: 100,
          FADE: 200, // Transición de opacidad más rápida
        },
        scales: {
          FOUND: 1.5, // Escala base forzada para encontrar palabras
        },
      },
      storage: {
        keys: StorageManager.STORAGE_KEYS,
      },
    };
  }

  getConfig(path) {
    return path.split(".").reduce((obj, key) => obj?.[key], this.config);
  }

  async initialize() {
    if (ConfigurationService.isInitialized) {
      return;
    }

    try {
      // Asegurarse de que StorageManager esté inicializado
      if (!StorageManager.isInitialized) {
        await StorageManager.initialize();
      }

      // Cargar configuraciones personalizadas desde el almacenamiento si existen
      const savedConfig = await StorageManager.get(
        StorageManager.STORAGE_KEYS.GAME_CONFIG
      );
      if (savedConfig) {
        try {
          const parsedConfig = JSON.parse(savedConfig);
          this.config = this.mergeConfigs(this.config, parsedConfig);
        } catch (parseError) {
          console.warn("Error parsing saved config:", parseError);
        }
      }

      ConfigurationService.isInitialized = true;
      console.log("✅ ConfigurationService inicializado correctamente");
    } catch (error) {
      console.warn("No se pudo cargar la configuración personalizada:", error);
      ConfigurationService.isInitialized = true;
    }
  }

  mergeConfigs(defaultConfig, savedConfig) {
    const result = { ...defaultConfig };
    for (const [key, value] of Object.entries(savedConfig)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        result[key] = this.mergeConfigs(defaultConfig[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  async updateConfig(path, value) {
    const keys = path.split(".");
    let current = this.config;

    // Navegar hasta el penúltimo nivel
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }

    // Actualizar el valor
    current[keys[keys.length - 1]] = value;

    // Guardar la configuración actualizada
    try {
      await StorageManager.setData("gameConfig", this.config);
    } catch (error) {
      console.error("Error saving configuration:", error);
    }
  }
}
