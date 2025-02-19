import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Preferences } from "@capacitor/preferences";
import { StatusBar } from "@capacitor/status-bar";

class NativeServices {
  static #isInitialized = false;
  static #swRegistration = null;
  static #isRegistering = false;
  static #platformLogged = false;
  static #swReadyEmitted = false;

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

      this.#swRegistration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
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
    App.addListener("backButton", ({ canGoBack }) => {
      if (!canGoBack) App.exitApp();
    });

    App.addListener("appStateChange", ({ isActive }) => {
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
            vibration: true,
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

  static async vibrate(pattern = "LIGHT") {
    if (!navigator.vibrate) return false;

    const patterns = {
      LIGHT: [100],
      MEDIUM: [200, 100, 200],
      HEAVY: [300, 100, 300],
    };

    try {
      return navigator.vibrate(patterns[pattern] || patterns.LIGHT);
    } catch (error) {
      console.warn("Error al intentar vibrar:", error);
      return false;
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
          vibrate: [200, 100, 200],
          ...options,
        });
      }

      return true;
    } catch (error) {
      console.error("Error al enviar notificación:", error);
      return false;
    }
  }

  static async get(key, defaultValue = null) {
    try {
      const { value } = await Preferences.get({ key });
      return value ? JSON.parse(value) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static async setData(key, value) {
    try {
      await Preferences.set({ key, value: JSON.stringify(value) });
      return true;
    } catch {
      return false;
    }
  }

  static getAssetPath(path) {
    const cleanPath = path.replace(/^\.?\/?/, "").replace(/^assets\//, "");
    return Capacitor.isNativePlatform()
      ? `file:///android_asset/public/${cleanPath}`
      : `./${cleanPath}`;
  }
}

export { NativeServices as N };
