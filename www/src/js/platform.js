import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';

// Eliminar import del splash screen

class NativeServices {
    static #isInitialized = false;

    static get isInitialized() {
        return this.#isInitialized;
    }

    static #isNativePlatform = false;
    static #serviceWorkerRegistration = null;

    static async initialize() {
        if (this.#isInitialized) {
            console.log('[Capacitor] Ya inicializado');
            return true;
        }

        console.group('[Capacitor] Inicializando servicios');
        try {
            console.log('[Capacitor] Detectando plataforma...');
            console.log('[Capacitor] Estado:', {
                platform: Capacitor.platform,
                isNative: Capacitor.isNative,
                getPlatform: Capacitor.getPlatform()
            });

            // Usar isNative en lugar de isNativePlatform
            if (!Capacitor.isNative) {
                console.log('[Capacitor] Usando web fallbacks');
                await this.setupWebServices();
                this.#isInitialized = true;
                console.groupEnd();
                return true;
            }

            console.log('[Capacitor] Configurando servicios nativos');
            await this.setupNativeServices();
            this.#isInitialized = true;
            console.log('[Capacitor] ✅ Servicios nativos listos');
            console.groupEnd();
            return true;
        } catch (error) {
            console.error('[Capacitor] ❌ Error:', error);
            console.groupEnd();
            this.#isInitialized = true;
            return false;
        }
    }

    static async setupWebServices() {
        console.group('[Capacitor] Configurando servicios web');
        try {
            // Registrar Service Worker primero
            if ('serviceWorker' in navigator) {
                this.#serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    type: 'classic',
                    updateViaCache: 'none',
                    // Agregar configuración para HTTPS
                    credentials: 'same-origin'
                });
                console.log('✅ Service Worker registrado');
                await navigator.serviceWorker.ready;
            }

            // Notificaciones web
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                console.log('- Permisos de notificación:', permission);
            }

            // Service Worker
            if ('serviceWorker' in navigator) {
                console.log('- Service Worker disponible');
            }

            // Vibración
            if ('vibrate' in navigator) {
                console.log('- Vibración disponible');
            }

            console.log('✅ Servicios web configurados');
        } catch (error) {
            console.error('❌ Error configurando servicios web:', error);
        }
        console.groupEnd();
    }

    static async setupNativeServices() {
        console.group('[Capacitor] Configurando servicios nativos');

        // Verificar cada plugin
        const plugins = [
            { name: 'App', instance: App },
            { name: 'Haptics', instance: Haptics },
            { name: 'LocalNotifications', instance: LocalNotifications },
            { name: 'Preferences', instance: Preferences }
        ];

        for (const { name, instance } of plugins) {
            try {
                const available = Capacitor.isPluginAvailable(name);
                console.log(`- ${name}: ${available ? '✓' : '✗'}`);
                if (available && instance) {
                    // Intentar un método simple para verificar funcionamiento
                    if (name === 'LocalNotifications') {
                        const perms = await instance.checkPermissions();
                        console.log(`  Permisos: ${perms.display}`);
                    }
                }
            } catch (err) {
                console.warn(`❌ Error verificando ${name}:`, err);
            }
        }

        // Configurar listeners
        this.setupAppListeners();

        console.log('✅ Configuración nativa completada');
        console.groupEnd();
    }

    static async setupWebNotifications() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            console.log('Permisos de notificación web:', permission);
        }
    }

    static async setupServiceWorker() {
        if (this.#isInitialized) return;

        try {
            this.setupAppListeners();

            // Usar isNative aquí también
            this.#isNativePlatform = Capacitor.isNative;
            console.log('Plataforma nativa:', this.#isNativePlatform);

            // Registrar Service Worker
            if ('serviceWorker' in navigator) {
                try {
                    const isLocalDevelopment =
                        window.location.hostname === 'localhost' ||
                        window.location.hostname.includes('192.168.') ||
                        window.location.hostname.includes('127.0.0.1');

                    // En desarrollo local, solo registrar si estamos en HTTP
                    if (!isLocalDevelopment || window.location.protocol === 'http:') {
                        this.#serviceWorkerRegistration = await navigator.serviceWorker.register(
                            '/sw.js',
                            {
                                scope: '/',
                                type: 'classic',
                                updateViaCache: 'none'
                            }
                        );
                        console.log('✅ Service Worker registrado:', this.#serviceWorkerRegistration);
                    } else {
                        console.log('Service Worker no registrado en desarrollo local');
                    }
                } catch (error) {
                    console.warn('Service Worker no disponible:', error);
                }
            }

            this.#isInitialized = true;
            console.log('✅ Servicios nativos inicializados');
        } catch (error) {
            console.error('❌ Error inicializando servicios nativos:', error);
        }
    }

    static setupAppListeners() {
        App.addListener('backButton', ({ canGoBack }) => {
            if (!canGoBack) {
                App.exitApp();
            }
        });

        App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) {
                document.dispatchEvent(new Event('appPause'));
            } else {
                document.dispatchEvent(new Event('appResume'));
            }
        });
    }

    static async initializeNotifications() {
        console.group('🔔 Inicializando sistema de notificaciones');

        // 1. En plataformas nativas, usar Capacitor
        if (this.#isNativePlatform) {
            try {
                console.log('📱 Intentando usar notificaciones nativas...');
                const { display } = await LocalNotifications.checkPermissions();
                console.log('Estado de permisos nativos:', display);

                if (display === 'granted' || display === 'prompt') {
                    const perms = await LocalNotifications.requestPermissions();
                    console.log('Nuevos permisos nativos:', perms.display);

                    if (perms.display === 'granted') {
                        console.log('✅ Notificaciones nativas activadas');
                        console.groupEnd();
                        return;
                    }
                }
            } catch (error) {
                console.warn('❌ Notificaciones nativas no disponibles:', error);
            }
        }

        // 2. Verificar y solicitar permisos explícitamente
        if ('Notification' in window) {
            try {
                let permission = Notification.permission;

                if (permission === 'default') {
                    console.log('📱 Solicitando permisos de notificación...');
                    permission = await Notification.requestPermission();
                }

                if (permission === 'granted') {
                    // Priorizar Service Worker si está disponible
                    if (this.#serviceWorkerRegistration?.active) {
                        console.log('✅ Service Worker notifications activadas');
                    } else {
                        console.log('✅ Web Notifications activadas');
                    }
                    console.groupEnd();
                    return;
                } else {
                    console.warn('❌ Permisos de notificación denegados:', permission);
                }
            } catch (error) {
                console.warn('❌ Error solicitando permisos:', error);
            }
        }

        console.warn('❌ No hay sistema de notificaciones disponible');
        console.groupEnd();
    }

    static async vibrate(style = 'MEDIUM') {
        try {
            switch (style.toUpperCase()) {
                case 'LIGHT':
                    await Haptics.impact({ style: ImpactStyle.Light });
                    break;
                case 'HEAVY':
                    await Haptics.notification({ type: NotificationType.Success });
                    break;
                case 'MEDIUM':
                default:
                    await Haptics.impact({ style: ImpactStyle.Medium });
            }
            return true;
        } catch {
            console.warn('Haptics no disponible');
            return false;
        }
    }

    static getIconPath() {
        console.group('🖼️ Obteniendo rutas de iconos');
        const isPlatformAndroid = Capacitor.getPlatform() === 'android';
        const isNative = Capacitor.isNative;

        // Para Android nativo usamos los recursos del sistema
        const iconPath = isNative && isPlatformAndroid 
            ? 'ic_notification' 
            : '/assets/images/icon.png';

        console.log('Icono seleccionado:', iconPath);
        console.groupEnd();
        return iconPath;
    }

    static async sendNotification(title, body) {
        console.group('📱 Enviando notificación');
        try {
            const iconPath = this.getIconPath();
            const isPlatformAndroid = Capacitor.getPlatform() === 'android';

            if (Capacitor.isNative && isPlatformAndroid) {
                console.log('Usando notificaciones Android nativas');
                const permResult = await LocalNotifications.requestPermissions();
                console.log('Permisos:', permResult);

                if (permResult.display !== 'granted') {
                    throw new Error('Permiso denegado en Android');
                }

                // Configuración mejorada para Android
                await LocalNotifications.schedule({
                    notifications: [{
                        title,
                        body,
                        id: Date.now(),
                        schedule: { at: new Date() },
                        autoCancel: true,
                        smallIcon: iconPath,
                        android: {
                            channelId: 'default',
                            importance: 4,
                            priority: 3,
                            visibility: 1,
                            smallIcon: iconPath
                        }
                    }]
                });

                console.log('✅ Notificación Android enviada');
            } else {
                console.log('Usando notificaciones web');
                if (!('serviceWorker' in navigator)) {
                    throw new Error('Service Worker no soportado');
                }

                const registration = await navigator.serviceWorker.ready;
                console.log('Service Worker listo');

                if (Notification.permission !== 'granted') {
                    const permission = await Notification.requestPermission();
                    console.log('Permiso de notificación:', permission);
                    if (permission !== 'granted') {
                        throw new Error('Permiso denegado');
                    }
                }

                // Configuración simplificada para web - sin imagen grande
                await registration.showNotification(title, {
                    body,
                    icon: iconPath,
                    vibrate: [200, 100, 200],
                    requireInteraction: true,
                    actions: [{
                        action: 'open',
                        title: 'Abrir'
                    }],
                    data: {
                        url: window.location.origin,
                        timestamp: Date.now()
                    }
                });

                console.log('✅ Notificación web enviada');
            }
        } catch (error) {
            console.error('❌ Error en notificación:', error);
            throw error;
        } finally {
            console.groupEnd();
        }
    }

    // Eliminar método scheduleReminder ya que no se usa

    static async scheduleNativeNotification(title, body, hours) {
        console.group('📱 Programando notificación nativa');
        try {
            console.log('Cancelando notificaciones anteriores...');
            await LocalNotifications.cancel({ notifications: [{ id: 1 }] });

            const scheduledTime = new Date(Date.now() + hours * 60 * 60 * 1000);
            console.log('Tiempo programado:', scheduledTime);

            await LocalNotifications.schedule({
                notifications: [{
                    title,
                    body,
                    id: 1,
                    schedule: {
                        at: scheduledTime,
                        allowWhileIdle: true
                    },
                    actionTypeId: 'OPEN_APP'
                }]
            });

            console.log('✅ Notificación nativa programada');
            console.groupEnd();
            return true;
        } catch (error) {
            console.error('❌ Error en notificación nativa:', error);
            console.groupEnd();
            return false;
        }
    }

    // Agregar método helper para detectar móviles
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0);
    }

    static async scheduleMobileNotification(title, body) {
        console.group('📱 Programando Service Worker notification');
        try {
            const registration = await navigator.serviceWorker.ready;
            console.log('Service Worker listo');

            await registration.showNotification(title, {
                body,
                icon: '/assets/images/icon.png',  // ✅ Ruta absoluta desde la raíz
                vibrate: [200, 100, 200]
            });

            console.log('✅ Service Worker notification mostrada');
            console.groupEnd();
            return true;
        } catch (error) {
            console.error('❌ Error en Service Worker notification:', error);
            console.groupEnd();
            return false;
        }
    }

    static async saveData(key, value) {
        try {
            await Preferences.set({
                key,
                value: JSON.stringify(value)
            });
            return true;
        } catch {
            console.warn('Error guardando en Preferences, usando localStorage');
            localStorage.setItem(key, JSON.stringify(value));
            return false;
        }
    }

    static async getData(key, defaultValue = null) {
        try {
            const { value } = await Preferences.get({ key });
            return value ? JSON.parse(value) : defaultValue;
        } catch {
            console.warn('Error leyendo de Preferences, usando localStorage');
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        }
    }

    static async removeData(key) {
        try {
            await Preferences.remove({ key });
            return true;
        } catch {
            localStorage.removeItem(key);
            return false;
        }
    }

    static async clearData() {
        try {
            await Preferences.clear();
            return true;
        } catch {
            localStorage.clear();
            return false;
        }
    }

    static async logToNative(message, data = {}) {
        // Evitar logs redundantes usando un Set o Map para trackear mensajes recientes
        if (!this._recentLogs) this._recentLogs = new Set();

        const key = `${message}-${JSON.stringify(data)}`;
        if (this._recentLogs.has(key)) return;

        this._recentLogs.add(key);
        setTimeout(() => this._recentLogs.delete(key), 1000); // Limpiar después de 1 segundo

        if (Capacitor.getPlatform() === 'android') {
            console.debug(`[GameSalad] ${message}`, JSON.stringify(data, null, 2));
        } else {
            console.log(message, data);
        }
    }
}

export { NativeServices as N };
