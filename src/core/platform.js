import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";
import { StatusBar } from "@capacitor/status-bar";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { BackHandler } from "./back-handler.js";
import { StorageManager } from "./storage.js";

// Patrones de vibración predefinidos con prioridad (mayor número = mayor prioridad)
export const VibrationPatterns = {
  LIGHT: "LIGHT", // Vibración ligera para toques de botones y selecciones de celdas (prioridad 1)
  MEDIUM: "MEDIUM", // Vibración media para notificaciones intermedias (prioridad 2)
  HEAVY: "HEAVY", // Vibración fuerte para eventos importantes como encontrar palabras (prioridad 3)
};

// Prioridades de vibración (mayor número = mayor prioridad)
const VIBRATION_PRIORITIES = {
  [VibrationPatterns.LIGHT]: 1,
  [VibrationPatterns.MEDIUM]: 2,
  [VibrationPatterns.HEAVY]: 3,
};

export class NativeServices {
  static #isInitialized = false;
  static #swRegistration = null;
  static #isRegistering = false;
  static #platformLogged = false;
  static #swReadyEmitted = false;
  static backButtonHandler = null;

  // Control de vibración para evitar solapamiento
  static #isVibrating = false;
  static #vibrationQueue = [];
  static #vibrationTimeout = null;
  static #lastVibrationType = null;
  static #vibrationDebounceTime = 300; // Tiempo en ms para evitar vibraciones repetidas

  // Método reutilizable para manejo de errores
  static #handleError(context, error, defaultReturn = false) {
    console.error(`[GS_NOTIF] Error en ${context}:`, error);
    return defaultReturn;
  }

  static async initialize() {
    if (this.#isInitialized) return true;

    try {
      // Log platform info once at startup for web platform
      if (!Capacitor.isNativePlatform() && !this.#platformLogged) {
        console.log("[GS_NOTIF] Platform:", Capacitor.getPlatform());
        console.log(
          "[GS_NOTIF] isNativePlatform:",
          Capacitor.isNativePlatform()
        );
        console.log(
          "[GS_NOTIF] Available plugins:",
          Capacitor.availablePlugins
        );
        this.#platformLogged = true;
      }

      if (Capacitor.isNativePlatform()) {
        await this.#initializeNativePlatform();
      } else {
        // Only initialize SW if needed and not already in progress
        if (!this.#swRegistration && !this.#isRegistering) {
          await this.initializeServiceWorker();
        }
      }

      this.#isInitialized = true;
      return true;
    } catch (error) {
      console.error("Error during initialization:", error);
      return false;
    }
  }

  static async #initializeNativePlatform() {
    // Set up notification listeners first
    if (Capacitor.isPluginAvailable("LocalNotifications")) {
      this.#setupNotificationListeners();
    }

    await Promise.all([this.#setupStatusBar(), this.#setupNotifications()]);

    this.#setupAppListeners();
  }

  static #setupNotificationListeners() {
    LocalNotifications.addListener(
      "localNotificationReceived",
      (notification) => {
        console.log("[GS_NOTIF] Notification received:", notification);
      }
    );

    LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (notification) => {
        console.log("[GS_NOTIF] Notification action performed:", notification);
      }
    );
  }

  static async initializeServiceWorker() {
    if (
      this.#swRegistration ||
      this.#isRegistering ||
      !("serviceWorker" in navigator)
    ) {
      return this.#swRegistration;
    }

    try {
      this.#isRegistering = true;
      console.log("[GS_NOTIF] Registering Service Worker...");

      this.#swRegistration = await navigator.serviceWorker.register("./sw.js", {
        scope: "./",
      });

      // Escuchar mensajes del Service Worker
      navigator.serviceWorker.addEventListener("message", async (event) => {
        if (event.data?.type === "CACHE_CLEARED") {
          console.log("[STORAGE] Cache cleared, cleaning preferences...");
          await this.clear();
          // Solo recargar si el Service Worker lo indica
          if (event.data?.reload) {
            window.location.reload();
          }
        }
      });

      if (this.#swRegistration.installing) {
        await new Promise((resolve) => {
          this.#swRegistration.installing.addEventListener(
            "statechange",
            (e) => e.target.state === "activated" && resolve()
          );
        });
      }

      await navigator.serviceWorker.ready;
      console.log("[GS_NOTIF] Service Worker registered and active");

      if (!this.#swReadyEmitted) {
        document.dispatchEvent(new Event("sw-ready"));
        this.#swReadyEmitted = true;
      }

      return this.#swRegistration;
    } catch (error) {
      console.error("[GS_NOTIF] Error registering Service Worker:", error);
      throw error;
    } finally {
      this.#isRegistering = false;
    }
  }

  static async #setupStatusBar() {
    if (!Capacitor.isPluginAvailable("StatusBar")) return;
    try {
      await StatusBar.setBackgroundColor({ color: "#000000" });
    } catch (error) {
      console.warn("Error setting up StatusBar:", error);
    }
  }

  static #setupAppListeners() {
    console.log("[BACK] Configurando manejo del botón Back");

    // Remover el handler anterior si existe
    if (NativeServices.backButtonHandler) {
      NativeServices.backButtonHandler.remove();
      NativeServices.backButtonHandler = null;
    }

    try {
      // Registrar un nuevo listener para el botón Back usando BackHandler
      NativeServices.backButtonHandler = App.addListener(
        "backButton",
        async () => {
          console.log("[BACK] Botón Back presionado");
          const handled = await BackHandler.handleBackPress();

          if (!handled) {
            console.log("[BACK] No hay modales que cerrar, minimizando app");
            App.minimizeApp();
          }
        }
      );

      console.log("[BACK] Manejo del botón Back configurado correctamente");
    } catch (error) {
      console.error(
        "[BACK] Error al configurar el manejo del botón Back:",
        error
      );
    }

    // Manejar cambios de estado de la app
    App.addListener("appStateChange", ({ isActive }) => {
      console.log(
        `[APP] Estado de la app cambiado: ${isActive ? "activo" : "inactivo"}`
      );
      document.dispatchEvent(new Event(isActive ? "appResume" : "appPause"));
    });
  }

  static async #setupNotifications() {
    console.log("[GS_NOTIF] Starting notification setup");

    try {
      if (Capacitor.isNativePlatform()) {
        if (!Capacitor.isPluginAvailable("LocalNotifications")) {
          console.warn("[GS_NOTIF] LocalNotifications plugin not available");
          return false;
        }

        // Configurar canal para Android
        if (Capacitor.getPlatform() === "android") {
          console.log("[GS_NOTIF] Setting up Android channel");

          await LocalNotifications.createChannel({
            id: "default",
            name: "Game Notifications",
            description: "Game progress and achievements",
            importance: 5,
            visibility: 1,
            vibration: true, // Usar vibración predeterminada del sistema
            lights: true,
            sound: null,
            lightColor: "#488AFF",
          }).catch((err) =>
            console.warn("[GS_NOTIF] Error creating channel:", err)
          );
        }

        // Verificar y solicitar permisos
        const perms = await LocalNotifications.checkPermissions();
        console.log("[GS_NOTIF] Current permissions:", perms);

        if (perms.display !== "granted") {
          const newPerms = await LocalNotifications.requestPermissions();
          console.log("[GS_NOTIF] New permissions:", newPerms);
          return newPerms.display === "granted";
        }

        return true;
      } else {
        // Web Notifications
        if (!("Notification" in window)) {
          console.warn("[GS_NOTIF] Este navegador no soporta notificaciones");
          return false;
        }

        if (Notification.permission === "granted") {
          return true;
        }

        if (Notification.permission !== "denied") {
          const permission = await Notification.requestPermission();
          return permission === "granted";
        }

        return false;
      }
    } catch (error) {
      console.error("[GS_NOTIF] Error setting up notifications:", error);
      return false;
    }
  }

  static async vibrate(pattern = VibrationPatterns.LIGHT) {
    try {
      // Primero verificar si la vibración está habilitada globalmente
      if (!StorageManager.isVibrationEnabled) {
        console.log("[HAPTICS] Vibration is disabled");
        return false;
      }

      // Si se está ejecutando otra vibración o hay una pendiente de mayor prioridad, manejar según prioridad
      if (this.#isVibrating) {
        const currentPriority =
          VIBRATION_PRIORITIES[this.#lastVibrationType] || 0;
        const newPriority = VIBRATION_PRIORITIES[pattern] || 0;

        // Si la nueva vibración tiene mayor prioridad, cancelar la actual y ejecutar la nueva
        if (newPriority > currentPriority) {
          console.log(
            `[HAPTICS] Priorizando vibración ${pattern} sobre ${
              this.#lastVibrationType
            }`
          );
          // Limpiar la cola y timeout actuales
          this.#vibrationQueue = [];
          if (this.#vibrationTimeout) {
            clearTimeout(this.#vibrationTimeout);
            this.#vibrationTimeout = null;
          }
          // La vibración de mayor prioridad se ejecutará a continuación
        } else {
          // Si tiene igual o menor prioridad, encolarla sólo si es diferente a la última
          if (pattern !== this.#lastVibrationType) {
            console.log(
              `[HAPTICS] Encolando vibración ${pattern} ya que hay una activa de mayor prioridad`
            );
            this.#vibrationQueue.push(pattern);
          }
          return true; // Retornar true porque la vibración se manejará (o encolará)
        }
      }

      // Marcar como vibrando y guardar el tipo
      this.#isVibrating = true;
      this.#lastVibrationType = pattern;

      // Ejecutar la vibración
      await this.#executeVibration(pattern);

      // Configurar un timeout para permitir la siguiente vibración
      this.#vibrationTimeout = setTimeout(() => {
        this.#isVibrating = false;
        this.#vibrationTimeout = null;

        // Si hay vibraciones en cola, ejecutar la de mayor prioridad
        if (this.#vibrationQueue.length > 0) {
          // Encontrar la vibración de mayor prioridad
          let highestPriorityPattern = this.#vibrationQueue[0];
          let highestPriority =
            VIBRATION_PRIORITIES[highestPriorityPattern] || 0;

          for (const queuedPattern of this.#vibrationQueue) {
            const priority = VIBRATION_PRIORITIES[queuedPattern] || 0;
            if (priority > highestPriority) {
              highestPriority = priority;
              highestPriorityPattern = queuedPattern;
            }
          }

          // Limpiar la cola y ejecutar la de mayor prioridad
          this.#vibrationQueue = [];
          this.vibrate(highestPriorityPattern);
        }
      }, this.#vibrationDebounceTime);

      return true;
    } catch (error) {
      this.#isVibrating = false;
      return this.#handleError("vibrate", error);
    }
  }

  // Método privado para ejecutar la vibración según la plataforma
  static async #executeVibration(pattern) {
    if (Capacitor.isNativePlatform()) {
      // Usar Haptics API en plataformas nativas
      if (!Capacitor.isPluginAvailable("Haptics")) {
        console.warn("[HAPTICS] Haptics plugin not available");
        return false;
      }

      const isAndroid = Capacitor.getPlatform() === "android";

      if (isAndroid) {
        // En Android usar patrones de vibración personalizados con duración explícita
        // en lugar de confiar solo en los estilos de impacto predefinidos
        const durations = {
          [VibrationPatterns.LIGHT]: 40, // Vibración corta y suave
          [VibrationPatterns.MEDIUM]: 100, // Vibración media
          [VibrationPatterns.HEAVY]: 300, // Vibración larga e intensa
        };

        const duration =
          durations[pattern] || durations[VibrationPatterns.LIGHT];
        console.log(`[HAPTICS] Android vibrate with duration: ${duration}ms`);

        return await Haptics.vibrate({ duration });
      } else {
        // Para iOS seguir usando los estilos de impacto
        const impacts = {
          [VibrationPatterns.LIGHT]: ImpactStyle.Light,
          [VibrationPatterns.MEDIUM]: ImpactStyle.Medium,
          [VibrationPatterns.HEAVY]: ImpactStyle.Heavy,
        };
        return await Haptics.impact({
          style: impacts[pattern] || impacts[VibrationPatterns.LIGHT],
        });
      }
    } else {
      // Usar navigator.vibrate en web
      if (!navigator.vibrate) {
        console.warn("[HAPTICS] Web Vibration API not supported");
        return false;
      }
      const durations = {
        [VibrationPatterns.LIGHT]: [20],
        [VibrationPatterns.MEDIUM]: [100],
        [VibrationPatterns.HEAVY]: [300],
      };
      return navigator.vibrate(
        durations[pattern] || durations[VibrationPatterns.LIGHT]
      );
    }
  }

  static async sendNotification(title, body, options = {}) {
    try {
      await this.initialize();

      if (Capacitor.isNativePlatform()) {
        // Usar solo LocalNotifications para plataformas nativas
        if (!Capacitor.isPluginAvailable("LocalNotifications")) {
          throw new Error("LocalNotifications no está disponible");
        }

        const notificationId = Math.floor(Math.random() * 2147483647);
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: notificationId,
              channelId: "default",
              ...options,
              sound: options.sound || null,
              iconColor: options.iconColor || "#488AFF",
              smallIcon: options.smallIcon || "ic_stat_notification",
            },
          ],
        });
      } else {
        // Usar solo Web Notifications para web
        if (!("Notification" in window)) {
          throw new Error("Web Notifications no está disponible");
        }

        const registration = await navigator.serviceWorker?.ready;
        if (!registration) {
          throw new Error("Service Worker no está registrado");
        }

        await registration.showNotification(title, {
          body,
          icon: "/assets/icon_tr.png",
          badge: "/assets/icon.png",
          // No especificar un patrón de vibración, usar el predeterminado del sistema
          ...options,
        });
      }

      return true;
    } catch (error) {
      return this.#handleError("sendNotification", error);
    }
  }

  static isNativePlatform() {
    return Capacitor.isNativePlatform();
  }

  static getAssetPath(path) {
    // Limpia la ruta eliminando ./ o / iniciales y referencias a assets/
    const cleanPath = path.replace(/^\.?\/?/, "").replace(/^assets\//, "");

    if (Capacitor.isNativePlatform()) {
      return `file:///android_asset/public/${cleanPath}`;
    }

    // Determinar si estamos en GitHub Pages y obtener la ruta base
    const isGitHubPages = window.location.hostname.includes("github.io");
    let basePath = "";

    if (isGitHubPages) {
      // En GitHub Pages, extraer el nombre del repositorio de la URL
      const pathSegments = window.location.pathname.split("/");
      // Asumimos que el primer segmento después del / inicial es el nombre del repositorio
      if (pathSegments.length > 1) {
        basePath = `/${pathSegments[1]}/`;
      }
    } else {
      // En desarrollo local o otros entornos
      basePath = "./";
    }

    return `${basePath}${cleanPath}`;
  }
}
