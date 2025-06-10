
import { Preferences } from "@capacitor/preferences";

class StorageManager {
  static STORAGE_KEYS = {
    CURRENT_LEVEL: "currentLevel",
    CURRENT_THEME: "currentTheme",
    VIBRATION_ENABLED: "vibrationEnabled",
    GAME_CONFIG: "gameConfig",
  };

  static isInitialized = false;
  static isInitializing = false;
  static isVibrationEnabled = true;
  static cache = new Map();
  static pendingOperations = new Map();

  // Método de debug que NO inicializa el storage
  static async _getRawValue(key) {
    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch (error) {
      console.error(`❌ Error getting raw value for key ${key}:`, error);
      return null;
    }
  }

  static async inspectStorage() {
    console.group('🔍 Inspecting all storage locations');
    
    // Verificar localStorage directo
    console.log('📦 localStorage keys:', Object.keys(localStorage));
    console.log('🎮 currentLevel en localStorage:', localStorage.getItem('currentLevel'));
    console.log('🎮 CapacitorStorage.currentLevel en localStorage:', localStorage.getItem('CapacitorStorage.currentLevel'));
    
    // Verificar Capacitor Preferences sin inicializar
    try {
      const { keys } = await Preferences.keys();
      console.log('🔐 Capacitor Preferences keys:', keys);
      
      // Obtener valores crudos sin pasar por el sistema de inicialización
      const rawCurrentLevel = await this._getRawValue(this.STORAGE_KEYS.CURRENT_LEVEL);
      console.log('🎯 Raw current level value:', rawCurrentLevel);
      
      const rawTheme = await this._getRawValue(this.STORAGE_KEYS.CURRENT_THEME);
      console.log('🎨 Raw theme value:', rawTheme);
      
      const rawVibration = await this._getRawValue(this.STORAGE_KEYS.VIBRATION_ENABLED);
      console.log('📳 Raw vibration value:', rawVibration);
    } catch (error) {
      console.error('❌ Error inspecting Capacitor Preferences:', error);
    }
    
    console.groupEnd();
  }

  static async _loadInitialValues() {
    // Verificar estado inicial de Preferences
    const { keys } = await Preferences.keys();
    console.log('🔑 Keys disponibles al inicializar:', keys);

    // Intentar cargar valores directamente sin procesar
    const values = await Promise.all([
      this._getRawValue(this.STORAGE_KEYS.CURRENT_THEME),
      this._getRawValue(this.STORAGE_KEYS.VIBRATION_ENABLED),
      this._getRawValue(this.STORAGE_KEYS.CURRENT_LEVEL)
    ]);
    
    console.log('📥 Valores cargados de Preferences:', {
      currentTheme: values[0],
      vibrationEnabled: values[1],
      currentLevel: values[2],
      keys
    });
    
    return values;
  }

  static async _migrateFromLocalStorage(currentLevel, currentTheme, vibrationEnabled) {
    if (currentLevel && currentTheme && vibrationEnabled !== null) {
      return [currentLevel, currentTheme, vibrationEnabled];
    }
    
    const localStorageKeys = Object.keys(localStorage);
    for (const key of localStorageKeys) {
      if (!key.startsWith('CapacitorStorage.')) continue;
      
      const actualKey = key.replace('CapacitorStorage.', '');
      const value = localStorage.getItem(key);
      
      if (!value) continue;
      
      console.log(`🔄 Migrando ${key} desde localStorage...`);
      await Preferences.set({ key: actualKey, value });
      
      if (actualKey === this.STORAGE_KEYS.CURRENT_LEVEL) currentLevel = value;
      if (actualKey === this.STORAGE_KEYS.CURRENT_THEME) currentTheme = value;
      if (actualKey === this.STORAGE_KEYS.VIBRATION_ENABLED) vibrationEnabled = value;
      
      localStorage.removeItem(key);
    }
    
    return [currentLevel, currentTheme, vibrationEnabled];
  }

  static async _setupCacheValues(currentLevel, currentTheme, vibrationEnabled) {
    if (currentTheme) {
      this.cache.set(this.STORAGE_KEYS.CURRENT_THEME, JSON.parse(currentTheme));
    } else {
      console.log('🎨 Guardando tema por defecto: dark');
      await this.setCurrentTheme('dark');
    }

    if (vibrationEnabled !== null) {
      const parsedVibration = JSON.parse(vibrationEnabled);
      this.isVibrationEnabled = parsedVibration;
      this.cache.set(this.STORAGE_KEYS.VIBRATION_ENABLED, parsedVibration);
    } else {
      console.log('📳 Guardando vibración por defecto: enabled');
      await this.setVibrationEnabled(true);
    }

    if (currentLevel) {
      this.cache.set(this.STORAGE_KEYS.CURRENT_LEVEL, JSON.parse(currentLevel));
    }
  }

  static async _verifyFinalState() {
    const finalState = await Promise.all([
      Preferences.get({ key: this.STORAGE_KEYS.CURRENT_THEME }),
      Preferences.get({ key: this.STORAGE_KEYS.VIBRATION_ENABLED }),
      Preferences.get({ key: this.STORAGE_KEYS.CURRENT_LEVEL })
    ]);
    
    console.log('🔒 Estado final verificado:', finalState.map(item => item.value));
  }

  static async initialize() {
    if (this.isInitialized || this.isInitializing) return;
    this.isInitializing = true;

    try {
      console.group('🔄 Inicializando StorageManager...');
      this.isInitialized = true;

      // Cargar valores iniciales
      let [currentTheme, vibrationEnabled, currentLevel] = await this._loadInitialValues();
      
      // Migrar desde localStorage si es necesario
      [currentLevel, currentTheme, vibrationEnabled] = await this._migrateFromLocalStorage(
        currentLevel, currentTheme, vibrationEnabled
      );
      
      // Configurar la caché con los valores obtenidos
      await this._setupCacheValues(currentLevel, currentTheme, vibrationEnabled);
      
      // Verificar estado final
      await this._verifyFinalState();
      
      console.log("✅ StorageManager inicializado correctamente");
      console.groupEnd();
    } catch (error) {
      console.error("❌ Error inicializando StorageManager:", error);
      this.isInitialized = false;
      console.groupEnd();
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  static async get(key, defaultValue = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check cache first
    if (this.cache.has(key)) {
      console.log(`📖 Getting cached value for key: ${key}`);
      return this.cache.get(key);
    }

    try {
      console.log(`🔍 Getting value for key: ${key}`);
      const { value } = await Preferences.get({ key });
      if (!value && defaultValue !== null) {
        // Si no hay valor guardado y hay un default, guardarlo
        await this.set(key, defaultValue);
        return defaultValue;
      }
      const parsedValue = value ? JSON.parse(value) : defaultValue;
      this.cache.set(key, parsedValue);
      return parsedValue;
    } catch (error) {
      console.error(`❌ Error getting value for key ${key}:`, error);
      if (defaultValue !== null) {
        // Si hay error pero tenemos un default, intentar guardarlo
        await this.set(key, defaultValue);
        return defaultValue;
      }
      return null;
    }
  }

  static async set(key, value) {
    if (!this.isInitialized) {
      console.warn("⚠️ StorageManager no está inicializado");
      await this.initialize();
    }

    try {
      console.log(`💾 Setting value for key: ${key}`, value);
      
      // Update cache immediately
      this.cache.set(key, value);
      
      // Guardar en Preferences
      await Preferences.set({ key, value: JSON.stringify(value) });
      
      // Verificar que se guardó correctamente
      const { value: storedValue } = await Preferences.get({ key });
      if (storedValue !== JSON.stringify(value)) {
        throw new Error(`Error de verificación: el valor guardado no coincide`);
      }
      
      // Verificar que la key existe en Preferences
      const { keys } = await Preferences.keys();
      if (!keys.includes(key)) {
        throw new Error(`Error de verificación: la key no existe en Preferences`);
      }
      
      console.log(`✅ Valor guardado y verificado para ${key}:`, storedValue);
      return true;
    } catch (error) {
      console.error(`❌ Error setting value for key ${key}:`, error);
      // Si falla el guardado, intentar restaurar desde cache
      if (this.cache.has(key)) {
        try {
          await Preferences.set({ 
            key, 
            value: JSON.stringify(this.cache.get(key))
          });
        } catch (e) {
          console.error('❌ Error en restauración desde cache:', e);
        }
      }
      return false;
    }
  }

  static async clear() {
    try {
      console.group('🧹 Clearing all storage...');
      
      // Clear internal state
      this.cache.clear();
      for (const timeoutId of this.pendingOperations.values()) {
        clearTimeout(timeoutId);
      }
      this.pendingOperations.clear();
      
      // Clear actual storage
      await Preferences.clear();
      localStorage.clear();
      
      await this.inspectStorage();
      
      console.groupEnd();
      return true;
    } catch (error) {
      console.error("❌ Error clearing storage:", error);
      console.groupEnd();
      return false;
    }
  }

  static async getAllKeys() {
    try {
      console.log('📑 Getting all storage keys...');
      const { keys } = await Preferences.keys();
      console.log('📋 All storage keys:', keys);
      return keys;
    } catch (error) {
      console.error("❌ Error getting keys:", error);
      return [];
    }
  }

  // Métodos de conveniencia actualizados para ser más directos
  static async getCurrentLevel() {
    return this.get(this.STORAGE_KEYS.CURRENT_LEVEL);
  }

  static async setCurrentLevel(levelId) {
    if (!this.isInitialized) {
      console.warn("⚠️ StorageManager no está inicializado");
      await this.initialize();
    }

    // Verificar el cache primero
    if (this.cache.get(this.STORAGE_KEYS.CURRENT_LEVEL) === levelId) {
      console.log(`⏭️ Nivel actual ya establecido a: ${levelId}`);
      return true;
    }

    // Solo guardar si el nivel ha cambiado realmente
    console.log(`🎮 Setting current level to: ${levelId}`);
    const result = await this.set(this.STORAGE_KEYS.CURRENT_LEVEL, levelId);
    return result;
  }

  static async getCurrentTheme() {
    return this.get(this.STORAGE_KEYS.CURRENT_THEME, 'dark');
  }

  static async setCurrentTheme(theme) {
    return this.set(this.STORAGE_KEYS.CURRENT_THEME, theme);
  }

  static async getVibrationEnabled() {
    return this.get(this.STORAGE_KEYS.VIBRATION_ENABLED, true);
  }

  static async setVibrationEnabled(enabled) {
    this.isVibrationEnabled = enabled;
    return this.set(this.STORAGE_KEYS.VIBRATION_ENABLED, enabled);
  }
}

export { StorageManager };
