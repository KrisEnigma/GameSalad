import confetti from 'canvas-confetti';
import { S as Storage } from './store.js';
import { N as NativeServices } from './platform.js';

class AnimationManager {
    static DURATIONS = {
        LETTER_DELAY: 50,
        LETTER_ANIMATION: 300,
        VICTORY_DELAY: 300
    };

    static async measureText(text, style) {
        const temp = document.createElement('div');
        temp.style.cssText = `
            position: absolute;
            visibility: hidden;
            white-space: pre;
            ${Object.entries(style).map(([k, v]) => `${k}:${v}`).join(';')}
        `;
        temp.textContent = text;
        document.body.appendChild(temp);
        const metrics = {
            width: temp.offsetWidth,
            height: temp.offsetHeight,
            left: temp.offsetLeft,
            top: temp.offsetTop
        };
        document.body.removeChild(temp);
        return metrics;
    }

    static animateWordFound(selection, wordElement, word) {
        return new Promise((resolve) => {
            const lastCell = document.getElementById(`tile-${selection[selection.length - 1]}`);
            const lastLetter = lastCell.querySelector('.text');
            const targetSpan = wordElement.querySelector('span');

            targetSpan.style.opacity = '0';

            const targetFontStyle = window.getComputedStyle(targetSpan);

            const computedThemeStyles = {
                source: window.getComputedStyle(lastLetter),
                target: window.getComputedStyle(wordElement)
            };

            // Mover toda la lógica async dentro de una función async IIFE
            (async () => {
                const letterMetrics = await Promise.all([...word].map(async char => {
                    return this.measureText(char, {
                        'font-size': targetFontStyle.fontSize,
                        'font-family': 'var(--font-family-content)',
                        'font-weight': computedThemeStyles.target.fontWeight,
                        'letter-spacing': computedThemeStyles.target.letterSpacing,
                        'text-transform': computedThemeStyles.target.textTransform,
                        'font-feature-settings': computedThemeStyles.target.fontFeatureSettings
                    });
                }));

                const totalWidth = letterMetrics.reduce((sum, metric) => sum + metric.width, 0);
                const targetRect = targetSpan.getBoundingClientRect();
                const sourceRect = lastCell.getBoundingClientRect();

                const startOffset = (targetRect.width - totalWidth) / 2;

                const letters = [...word].map((char, index) => {
                    const letterSpan = document.createElement('span');
                    letterSpan.textContent = char === ' ' ? '\u00A0' : char;
                    letterSpan.className = 'animated-letter';

                    const sourceX = sourceRect.left + (sourceRect.width / 2);
                    const sourceY = sourceRect.top + (sourceRect.height / 2);

                    letterSpan.style.cssText = `
                        position: fixed;
                        left: ${sourceX}px;
                        top: ${sourceY}px;
                        transform: translate(-50%, -50%);
                        opacity: 1;
                    `;
                    document.body.appendChild(letterSpan);

                    const previousLettersWidth = letterMetrics
                        .slice(0, index)
                        .reduce((sum, metric) => sum + metric.width, 0);

                    const targetX = targetRect.left + startOffset + previousLettersWidth + (letterMetrics[index].width / 2);
                    const targetY = targetRect.top + (targetRect.height / 2);

                    return {
                        element: letterSpan,
                        endX: targetX,
                        endY: targetY,
                        startX: sourceX,
                        startY: sourceY,
                        sourceStyles: computedThemeStyles.source,
                        targetStyles: computedThemeStyles.target
                    };
                });

                letters.forEach(({ element, endX, endY, startX, startY }, index) => {
                    setTimeout(() => {
                        element.classList.add('animating');

                        requestAnimationFrame(() => {
                            element.classList.add('in-transit');
                            const deltaX = endX - startX;
                            const deltaY = endY - startY;

                            element.style.cssText += `
                                font-size: ${targetFontStyle.fontSize};
                                color: white;
                                transform: translate(
                                    calc(-50% + ${deltaX}px),
                                    calc(-50% + ${deltaY}px)
                                );
                            `;

                            const handleTransitionEnd = (e) => {
                                if (e.propertyName === 'transform') {
                                    element.removeEventListener('transitionend', handleTransitionEnd);
                                    element.classList.remove('animating', 'in-transit');

                                    if (index === letters.length - 1) {
                                        targetSpan.textContent = word;
                                        targetSpan.style.opacity = '1';

                                        requestAnimationFrame(() => {
                                            document.querySelectorAll('.animated-letter').forEach(el => el.remove());
                                        });
                                    }
                                }
                            };

                            element.addEventListener('transitionend', handleTransitionEnd);
                        });
                    }, index * this.DURATIONS.LETTER_DELAY);
                });

                selection.forEach(position => {
                    const cell = document.getElementById(`tile-${position}`);
                    cell.classList.add('found-temp');
                });

                const totalDuration = letters.length * this.DURATIONS.LETTER_DELAY + this.DURATIONS.LETTER_ANIMATION;
                setTimeout(() => {
                    selection.forEach(position => {
                        const cell = document.getElementById(`tile-${position}`);
                        cell.classList.remove('found-temp');
                    });
                    resolve(totalDuration);
                }, totalDuration);
            })();
        });
    }

    static async animateUnusedCells(positions) {
        positions.forEach(position => {
            const cell = document.getElementById(`tile-${position}`);
            requestAnimationFrame(() => cell.classList.add('unused'));
        });
    }

    static confetti = {
        instance: null,
        async initialize() {
            const canvas = document.getElementById('confetti-canvas');
            if (!canvas) {
                console.warn('❌ No se encontró el canvas');
                return;
            }

            try {
                this.instance = confetti.create(canvas, { resize: true });
            } catch (error) {
                console.error('❌ Error creando instancia:', error);
            }
        },
        async fire(options) {
            if (!this.instance) await this.initialize();
            if (this.instance) {
                this.instance(options);
            }
        },
        getColors() {
            const colorsVar = getComputedStyle(document.documentElement)
                .getPropertyValue('--confetti-colors').trim();
            return colorsVar ? colorsVar.split(',').map(c => c.trim())
                : ['#ffd700', '#ff3939', '#00ff7f', '#4169e1', '#ff69b4'];
        },
        stop() {
            if (this.instance) {
                this.instance.reset();
                this.instance = null;
            }
        },
        start() {
            return new Promise((resolve) => {
                const executeSequence = async () => {
                    if (!this.instance) {
                        await this.initialize();
                    }
                    const colors = this.getColors();
                    await this.executeFirstWave(colors);
                    await new Promise(r => setTimeout(r, 250));
                    await this.executeSecondWave(colors);
                    resolve();
                };

                executeSequence();
            });
        },

        async executeConfettiSequence(resolve) {
            const colors = this.getColors();

            // Primera oleada: explosiones laterales simultáneas
            await this.executeFirstWave(colors);
            await new Promise(r => setTimeout(r, 250));
            await this.executeSecondWave(colors);
            resolve();
        },

        async executeFirstWave(colors) {
            this.fire({
                particleCount: 100,
                spread: 70,
                origin: { x: 0.1, y: 0.35 },
                colors
            });
            this.fire({
                particleCount: 100,
                spread: 70,
                origin: { x: 0.9, y: 0.35 },
                colors
            });

            // Vibración media para explosiones laterales
            if (Storage.isVibrationEnabled) {
                await NativeServices.vibrate('MEDIUM');
            }
        },

        async executeSecondWave(colors) {
            this.fire({
                particleCount: 150,
                spread: 100,
                origin: { x: 0.5, y: 0.3 },
                gravity: 1.2,
                scalar: 1.2,
                drift: 0,
                ticks: 300,
                colors
            });

            // Vibración fuerte para explosión central
            if (Storage.isVibrationEnabled) {
                await NativeServices.vibrate('HEAVY');
            }
        },

        // Método de prueba para depuración
        test(x = 0.5, y = 0.35) {
            this.fire({
                particleCount: 50,
                spread: 70,
                origin: { x, y },
                colors: this.getColors()
            });
        }
    };

    static async animateVictory(callback) {
        const victoryModal = document.getElementById('victory-modal');

        // Primero activar el modal
        victoryModal.classList.add('active');

        // Esperar un frame para asegurar que el canvas esté listo
        await new Promise(resolve => requestAnimationFrame(resolve));

        // Ahora iniciar la animación
        await this.confetti.start();

        // Finalmente ejecutar el callback si existe
        callback?.();
    }

    static resetSelectionWithDelay(selectionManager) {
        setTimeout(() => selectionManager.reset(), this.DURATIONS.SELECTION_RESET);
    }

    static updateCellStates(cells, { add = [], remove = [] }) {
        cells.forEach(cell => {
            if (add.length) requestAnimationFrame(() => cell.classList.add(...add));
            if (remove.length) cell.classList.remove(...remove);
        });
    }

    static stopConfetti() {
        this.confetti.stop();
    }

    static cleanupAnimations() {
        const animatedLetters = document.querySelectorAll('.animated-letter');
        if (animatedLetters.length > 0) {
            animatedLetters.forEach(el => el.remove());
        }
    }

    static bindDebugEvents() {
        document.addEventListener('keydown', e => {
            // Tecla T para test
            if (e.key.toLowerCase() === 't') {
                this.confetti.test();
            }
            // Teclas 1-9 para probar diferentes posiciones horizontales
            if (!isNaN(parseInt(e.key)) && e.key !== '0') {
                const x = parseInt(e.key) / 10;
                this.confetti.test(x);
            }
        });
    }
}

// Inicializar eventos de depuración

AnimationManager.bindDebugEvents();

export { AnimationManager as A };
