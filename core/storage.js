import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { L as LEVEL_ORDER, a as LEVELS } from "../game/levels.js";

class StorageManager {
  static keys = {
    THEME: "theme",
    CURRENT_LEVEL: "currentLevel",
    SETTINGS: "settings",
  };

  static #initialized = false;
  static #settings = {
    vibrationEnabled: true,
  };

  static async initialize() {
    if (this.#initialized) return;

    try {
      const [settings, theme, currentLevel] = await Promise.all([
        this.get(this.keys.SETTINGS),
        this.get(this.keys.THEME),
        this.get(this.keys.CURRENT_LEVEL),
      ]);

      if (!settings || !theme || !currentLevel) {
        await this.clearAll();
        return;
      }

      if (!LEVELS[currentLevel]) {
        await this.clearAll();
        return;
      }

      this.#settings = settings;

      const lsCurrentLevel = localStorage.getItem(
        this.#getWebKey(this.keys.CURRENT_LEVEL)
      );
      const prefsCurrentLevel = await Preferences.get({
        key: this.keys.CURRENT_LEVEL,
      });

      if (lsCurrentLevel !== prefsCurrentLevel.value) {
        await this.clearAll();
        return;
      }

      this.#initialized = true;
    } catch (error) {
      console.error("❌ Error:", error);
      await this.clearAll();
    }
  }

  static #getWebKey(key) {
    return Capacitor.isNative ? key : `CapacitorStorage.${key}`;
  }

  static async get(key, defaultValue = null) {
    try {
      // Primero intenta Capacitor Preferences
      const { value } = await Preferences.get({ key });
      if (value) {
        return JSON.parse(value);
      }

      // Si falla, intentar localStorage con el prefijo correcto
      const webKey = this.#getWebKey(key);
      const localValue = localStorage.getItem(webKey);
      if (localValue) {
        return JSON.parse(localValue);
      }

      return defaultValue;
    } catch {
      // Error silencioso, retornar valor por defecto
      console.debug("Error recuperando valor");
      return defaultValue;
    }
  }

  static async set(key, value) {
    try {
      const stringValue = JSON.stringify(value);
      await Preferences.set({ key, value: stringValue });

      if (!Capacitor.isNative) {
        const webKey = this.#getWebKey(key);
        localStorage.setItem(webKey, stringValue);
      }

      if (key === this.keys.SETTINGS) {
        this.#settings = value;
      }

      return true;
    } catch {
      return false;
    }
  }

  // Getters para configuraciones
  static get isVibrationEnabled() {
    return this.#settings.vibrationEnabled;
  }

  // Setters para configuraciones
  static async setVibrationEnabled(enabled) {
    this.#settings.vibrationEnabled = enabled;
    return this.set(this.keys.SETTINGS, this.#settings);
  }

  // Métodos para manejar nivel y tema
  static async getCurrentLevel() {
    return this.get(this.keys.CURRENT_LEVEL);
  }

  static async setCurrentLevel(levelId) {
    return this.set(this.keys.CURRENT_LEVEL, levelId);
  }

  static async getCurrentTheme() {
    return this.get(this.keys.THEME);
  }

  static async setCurrentTheme(theme) {
    return this.set(this.keys.THEME, theme);
  }

  // Método para resetear todo
  static async resetToDefaults() {
    console.group("🔄 Reseteando Storage");
    try {
      // 1. Establecer valores por defecto
      await Promise.all([
        this.set(this.keys.SETTINGS, {
          vibrationEnabled: true,
        }),
        this.set(this.keys.THEME, "dark"),
        this.set(this.keys.CURRENT_LEVEL, LEVEL_ORDER[0]),
      ]);

      // 2. Actualizar settings en memoria
      this.#settings = {
        vibrationEnabled: true,
      };

      console.log("✅ Storage reseteado");
    } catch (error) {
      console.error("❌ Error reseteando storage:", error);
    } finally {
      console.groupEnd();
    }
  }

  static async clearAll() {
    console.group("🧹 Limpiando Storage");
    try {
      // 1. Limpiar Preferences
      await Preferences.clear();
      console.log("✅ Preferences limpiado");

      // 2. Limpiar localStorage en web
      if (!Capacitor.isNative) {
        Object.keys(localStorage)
          .filter((key) => key.startsWith("CapacitorStorage."))
          .forEach((key) => localStorage.removeItem(key));
        console.log("✅ localStorage limpiado");
      }

      // 3. Establecer valores por defecto
      await this.resetToDefaults();

      console.log("✅ Storage reinicializado correctamente");

      // 4. Recargar la página para asegurar un estado limpio
      window.location.reload();

      return true;
    } catch (error) {
      console.error("❌ Error limpiando storage:", error);
      return false;
    } finally {
      console.groupEnd();
    }
  }
}

export { StorageManager, StorageManager as S };
