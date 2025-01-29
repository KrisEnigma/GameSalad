import { Preferences } from '@capacitor/preferences';
import { L as LEVEL_ORDER } from './levels.js';

class StorageManager {
    static KEYS = {
        THEME: 'theme',
        CURRENT_LEVEL: 'currentLevel',
        SETTINGS: 'settings'
    };

    static #initialized = false;
    static #settings = {
        vibrationEnabled: true,
        notificationEnabled: true
    };

    static async initialize() {
        if (this.#initialized) return;

        try {
            // Cargar configuraciones
            const settings = await this.get(this.KEYS.SETTINGS);
            if (settings) {
                this.#settings = settings;
            } else {
                // Si no hay configuraciones, guardar las predeterminadas
                await this.set(this.KEYS.SETTINGS, this.#settings);
            }
            
            this.#initialized = true;
            console.log('✅ Storage inicializado:', this.#settings);
        } catch (error) {
            console.error('❌ Error inicializando Storage:', error);
        }
    }

    static async get(key, defaultValue = null) {
        try {
            // Intentar usar Capacitor Preferences
            const { value } = await Preferences.get({ key });
            return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
            // Fallback a localStorage
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : defaultValue;
            } catch (error) {
                console.error(`Error leyendo ${key}:`, error);
                return defaultValue;
            }
        }
    }

    static async set(key, value) {
        try {
            // Intentar usar Capacitor Preferences
            await Preferences.set({
                key,
                value: JSON.stringify(value)
            });

            // Actualizar settings en memoria si corresponde
            if (key === this.KEYS.SETTINGS) {
                this.#settings = value;
            }

            return true;
        } catch (error) {
            // Fallback a localStorage
            try {
                localStorage.setItem(key, JSON.stringify(value));
                if (key === this.KEYS.SETTINGS) {
                    this.#settings = value;
                }
                return true;
            } catch (error) {
                console.error(`Error guardando ${key}:`, error);
                return false;
            }
        }
    }

    // Getters para configuraciones
    static get isVibrationEnabled() {
        return this.#settings.vibrationEnabled;
    }

    static get isNotificationEnabled() {
        return this.#settings.notificationEnabled;
    }

    // Setters para configuraciones
    static async setVibrationEnabled(enabled) {
        this.#settings.vibrationEnabled = enabled;
        return this.set(this.KEYS.SETTINGS, this.#settings);
    }

    static async setNotificationEnabled(enabled) {
        this.#settings.notificationEnabled = enabled;
        return this.set(this.KEYS.SETTINGS, this.#settings);
    }

    // Métodos para manejar nivel y tema
    static async getCurrentLevel() {
        return this.get(this.KEYS.CURRENT_LEVEL);
    }

    static async setCurrentLevel(levelId) {
        return this.set(this.KEYS.CURRENT_LEVEL, levelId);
    }

    static async getCurrentTheme() {
        return this.get(this.KEYS.THEME);
    }

    static async setCurrentTheme(theme) {
        return this.set(this.KEYS.THEME, theme);
    }

    // Método para resetear todo
    static async resetToDefaults() {
        this.#settings = {
            vibrationEnabled: true,
            notificationEnabled: true
        };

        await Promise.all([
            this.set(this.KEYS.SETTINGS, this.#settings),
            this.set(this.KEYS.THEME, 'dark'),
            this.set(this.KEYS.CURRENT_LEVEL, LEVEL_ORDER[0])  // Volver al primer nivel
        ]);
    }
}

export { StorageManager as S };
