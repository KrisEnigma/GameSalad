import { Capacitor } from '@capacitor/core';
import { N as NativeServices } from './platform.js';

class TitleFitter {
    constructor(titleElement) {
        this.titleElement = titleElement;
        this.observer = new MutationObserver(() => this.fit());

        this.observe();
        this.bindEvents();
    }

    observe() {
        this.observer.observe(this.titleElement, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            requestAnimationFrame(() => this.fit());
        });
    }

    async fit(attempt = 1) {
        const MAX_ATTEMPTS = 3;
        const RETRY_DELAY = 50;

        if (this._fitInProgress) return;
        this._fitInProgress = true;

        try {
            const title = this.titleElement;
            const container = title.parentElement;
            const isPlatformAndroid = Capacitor.getPlatform() === 'android';

            // Cálculos iniciales con margen extra
            const computedStyle = getComputedStyle(container);
            const containerWidth = container.clientWidth;
            const containerPadding = parseFloat(computedStyle.paddingLeft) +
                parseFloat(computedStyle.paddingRight);
            const safetyMargin = isPlatformAndroid ?
                containerWidth * 0.05 : // 5% en Android
                Math.min(16, containerWidth * 0.03); // 3% en Web
            const availableWidth = containerWidth - containerPadding - safetyMargin;

            // Resetear y medir título
            title.style = '';
            // Forzar recálculo
            await document.fonts.ready;
            title.style.display = 'inline-block';
            void title.offsetWidth;

            const baseStyle = getComputedStyle(title);
            const currentFontSize = parseFloat(baseStyle.fontSize);

            // Crear elemento de medición temporal
            const measureEl = document.createElement('span');
            measureEl.style.cssText = `
                position: absolute;
                visibility: hidden;
                white-space: nowrap;
                font-family: ${baseStyle.fontFamily};
                font-size: ${currentFontSize}px;
            `;
            measureEl.textContent = title.textContent;
            document.body.appendChild(measureEl);
            const titleWidth = measureEl.offsetWidth;
            document.body.removeChild(measureEl);

            // Solo loggear en el primer intento
            if (attempt === 1) {
                await NativeServices.logToNative(`📏 [${isPlatformAndroid ? 'Android' : 'Web'}] Ajuste inicial`, {
                    texto: title.textContent,
                    contenedor: Math.round(containerWidth),
                    disponible: Math.round(availableWidth),
                    anchoActual: Math.round(titleWidth)
                });
            }

            if (titleWidth > availableWidth) {
                // Hacer el ajuste más agresivo en cada intento
                const baseScaleFactor = isPlatformAndroid ? 0.5 : 0.85;
                const attemptReduction = 0.15 * (attempt - 1);
                const scaleFactor = Math.max(0.3, baseScaleFactor - attemptReduction);

                // Aplicar escala con factor adicional de seguridad
                const scale = (availableWidth / titleWidth) * scaleFactor * 0.9; // 10% extra de reducción

                // Límites más estrictos
                const minFontSize = isPlatformAndroid ? 14 : 18;
                const maxSize = isPlatformAndroid ?
                    containerWidth * 0.05 :
                    containerWidth * 0.08;

                // Aplicar nuevo tamaño con redondeo a la baja
                let newSize = Math.floor(Math.max(
                    minFontSize,
                    Math.min(currentFontSize * scale, maxSize)
                ));

                // Log de cálculos
                await NativeServices.logToNative('📊 Cálculos', {
                    factorEscala: scaleFactor,
                    escalaFinal: scale.toFixed(2),
                    fuenteMinima: Math.round(minFontSize),
                    fuenteNueva: newSize,
                    maximoPermitido: Math.round(maxSize)
                });

                // Aplicar y medir hasta encontrar un tamaño que funcione
                while (newSize >= minFontSize) {
                    title.style.fontSize = `${newSize}px`;
                    // Forzar recálculo
                    void title.offsetWidth;
                    await new Promise(resolve => requestAnimationFrame(resolve));

                    // Medir con elemento temporal
                    measureEl.style.fontSize = `${newSize}px`;
                    document.body.appendChild(measureEl);
                    const finalWidth = measureEl.offsetWidth;
                    document.body.removeChild(measureEl);

                    const resultado = {
                        anchoFinal: Math.round(finalWidth),
                        anchoDisponible: Math.round(availableWidth),
                        ajustado: finalWidth <= availableWidth,
                        porcentajeReduccion: Math.round((1 - (newSize / currentFontSize)) * 100)
                    };
                    await NativeServices.logToNative('📐 Resultado', resultado);

                    // Solo loggear resultado final si fue exitoso
                    if (finalWidth <= availableWidth) {
                        await NativeServices.logToNative('✅ Ajuste completado');
                        return;
                    }

                    newSize = Math.floor(newSize * 0.9); // Reducir 10% en cada intento
                    if (newSize < minFontSize) break;
                }

                if (attempt < MAX_ATTEMPTS) {
                    await NativeServices.logToNative('⚠️ Reintentando ajuste...');
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    return this.fit(attempt + 1);
                }
            } else {
                await NativeServices.logToNative('✅ No necesita ajuste');
            }

        } catch (error) {
            console.error('Error ajustando título:', error);
        } finally {
            this._fitInProgress = false;
            // Restaurar display original
            this.titleElement.style.display = '';
        }
    }

    destroy() {
        this.observer.disconnect();
    }
}

export { TitleFitter as T };
