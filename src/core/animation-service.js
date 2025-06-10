import { EventService } from "./event-service.js";
import { ConfigurationService } from "./configuration-service.js";
import { NativeServices, VibrationPatterns } from "./platform.js";

// Constants for repeated values
const ANIMATION_CSS_CLASSES = {
  FOUND_TEMP: "found-temp",
  ANIMATED_LETTER: "animated-letter",
  IN_TRANSIT: "in-transit",
  MARK_SELECTED: "mark.selected",
  ANIMATING: "animating",
  UNUSED: "unused", // Añadido para mayor claridad
  DISABLE_TRANSITIONS: "disable-transitions", // Nueva clase para deshabilitar transiciones
};

// Timing configuration for confetti
const CONFETTI_TIMING = {
  WAVE_DELAY: 500, // Delay between first and second wave in ms
  FIRST_WAVE: {
    particles: 100,
    spread: 70,
  },
  SECOND_WAVE: {
    particles: 150,
    spread: 100,
    gravity: 1.2,
    scalar: 1.2,
  },
};

const CONFIG_KEYS = {
  ANIMATION_DURATIONS: "animation.durations",
};

export class AnimationService {
  constructor() {
    this.config = ConfigurationService.getInstance();
    this._activeAnimations = new Set();
    this._events = new EventService();
    this._confettiModule = null;
    this._confettiConfig = {
      waves: [
        {
          particleCount: 100,
          spread: 70,
          origin: [
            { x: 0, y: 0.35 },
            { x: 1, y: 0.35 },
          ],
        },
        {
          particleCount: 150,
          spread: 100,
          gravity: 1.2,
          scalar: 1.2,
          origin: { x: 0.5, y: 0.3 },
        },
      ],
    };
    this._initialize();

    // Añadir manejador de redimensionamiento para evitar transiciones durante resize
    this._resizeTimeout = null;
    this._handleWindowResize = this._handleWindowResize.bind(this);

    // Registrar el listener para el resize
    window.addEventListener("resize", this._handleWindowResize);
  }

  async _initialize() {
    try {
      if (!ConfigurationService.isInitialized) {
        await this.config.initialize();
      }
      await this._initializeConfetti();
    } catch (error) {
      console.error("Error initializing AnimationService:", error);
    }
  }

  async _initializeConfetti() {
    try {
      const module = await import("canvas-confetti");
      const canvas = document.getElementById("confetti-canvas");
      if (!canvas) {
        console.error("Canvas del confeti no encontrado");
        return;
      }
      this._confettiModule = module.default.create(canvas, { resize: true });
    } catch (error) {
      console.error("Error inicializando confetti:", error);
    }
  }

  async _loadConfetti() {
    if (this._confettiModule) return this._confettiModule;
    await this._initializeConfetti();
    return this._confettiModule;
  }

  async measureText(text, style) {
    const temp = document.createElement("div");
    temp.className = "measure-text";

    // Aplicar estilos específicos que varían por medición
    Object.entries(style).forEach(([property, value]) => {
      temp.style[property] = value;
    });

    temp.textContent = text;
    document.body.appendChild(temp);
    const metrics = {
      width: temp.offsetWidth,
      height: temp.offsetHeight,
      left: temp.offsetLeft,
      top: temp.offsetTop,
    };
    document.body.removeChild(temp);
    return metrics;
  }

  async animateElements({
    elements,
    animation,
    duration,
    delay = 0,
    cleanup = true,
  }) {
    if (!ConfigurationService.isInitialized) {
      console.warn(
        "AnimationService: ConfigurationService no inicializado, usando valores por defecto"
      );
    }
    const durations = this.config.getConfig(CONFIG_KEYS.ANIMATION_DURATIONS);
    this._events.emit(EventService.EVENTS.ANIMATION_START);

    const promises = [];
    const cleanupHandlers = [];

    elements.forEach((el, index) => {
      const promise = new Promise((resolve) => {
        setTimeout(() => {
          const cleanupHandler = this._applyAnimation(
            el,
            animation,
            duration || durations.LETTER_ANIMATION,
            resolve
          );
          if (cleanup) {
            cleanupHandlers.push(cleanupHandler);
          }
        }, (delay || durations.LETTER_DELAY) * index);
      });
      promises.push(promise);
    });

    await Promise.all(promises);
    this._events.emit(EventService.EVENTS.ANIMATION_END);
    return () => cleanupHandlers.forEach((handler) => handler());
  }

  _applyAnimation(element, animation, duration, onComplete) {
    const animationId = Math.random().toString(36).substr(2, 9);
    this._activeAnimations.add(animationId);

    element.style.animation = `${animation} ${duration}ms`;

    const cleanup = () => {
      element.style.animation = "";
      this._activeAnimations.delete(animationId);
      onComplete?.();
    };

    element.addEventListener("animationend", cleanup, { once: true });
    return () => {
      element.removeEventListener("animationend", cleanup);
      cleanup();
    };
  }

  async animateWordFound(selection, wordElement, word) {
    console.group(`🎭 Animando palabra "${word}"`);
    const durations = this.config.getConfig(CONFIG_KEYS.ANIMATION_DURATIONS);
    const foundAnimationDuration = durations?.FOUND_ANIMATION || 600;

    try {
      this._events.emit(EventService.EVENTS.ANIMATION_START);

      // 1. Preparar celdas
      const cellsToAnimate = selection.map((position) => {
        const cell = document.getElementById(`tile-${position}`);
        cell.classList.add(ANIMATION_CSS_CLASSES.FOUND_TEMP);
        return cell;
      });

      // 2. Animar celdas
      const animations = cellsToAnimate.map((cell) => {
        const themeRoot = document.querySelector("[data-theme]");
        const style = themeRoot
          ? getComputedStyle(themeRoot)
          : getComputedStyle(document.documentElement);

        const scaleFromTheme = style.getPropertyValue("--found-scale").trim();
        const targetScale = parseFloat(scaleFromTheme) || 1.1;
        const targetBrightness =
          parseFloat(style.getPropertyValue("--found-brightness")) || 1.5;

        return cell.animate(
          [
            { transform: "scale(1)", filter: "brightness(1)" },
            {
              transform: `scale(${targetScale})`,
              filter: `brightness(${targetBrightness})`,
              offset: 0.5,
            },
            { transform: "scale(1)", filter: "brightness(1)" },
          ],
          {
            duration: foundAnimationDuration,
            easing: "cubic-bezier(0.2, 0, 0.2, 1)",
            fill: "forwards",
          }
        );
      });

      // Iniciar animaciones y esperar al punto medio
      animations.forEach((anim) => anim.play());
      await new Promise((resolve) =>
        setTimeout(resolve, foundAnimationDuration / 2)
      );

      // 3. Preparar elementos y colores
      const cells = cellsToAnimate;
      const letters = cells.map((cell) => cell.querySelector(".text"));
      const sourceColors = letters.map((letter) => {
        const color = window.getComputedStyle(letter).color;
        return color;
      });
      const targetSpan = wordElement.querySelector("span");

      console.group("🎨 Debug Colores:");
      console.log("Variables CSS esperadas:", {
        colorLetters: getComputedStyle(
          document.documentElement
        ).getPropertyValue("--color-letters"),
        colorWords: getComputedStyle(document.documentElement).getPropertyValue(
          "--color-words"
        ),
      });
      console.log("Color origen (--color-letters):", sourceColors[0]);
      console.log(
        "Color destino (--color-words):",
        window.getComputedStyle(targetSpan).color
      );
      console.groupEnd();

      if (!targetSpan) {
        console.error("No se encontró el span dentro del wordElement");
        return;
      }

      // Configurar transición del span
      const lengthSpan = targetSpan.querySelector(".word-length");
      if (lengthSpan) {
        lengthSpan.classList.add("fading-out");
        setTimeout(() => {
          if (targetSpan.contains(lengthSpan)) {
            targetSpan.removeChild(lengthSpan);
          }
        }, 300);
      }

      // 4. Obtener estilos y métricas
      const targetFontStyle = window.getComputedStyle(targetSpan);
      const computedThemeStyles = {
        source: window.getComputedStyle(letters[0]),
        target: window.getComputedStyle(wordElement),
      };

      // 5. Medir letras
      const letterMetrics = await Promise.all(
        [...word].map((char) =>
          this.measureText(char === " " ? "\u00A0" : char, {
            "font-size": targetFontStyle.fontSize,
            "font-family": "var(--font-family-content)",
            "font-weight": computedThemeStyles.target.fontWeight,
            "letter-spacing": computedThemeStyles.target.letterSpacing,
            "text-transform": computedThemeStyles.target.textTransform,
            "font-feature-settings":
              computedThemeStyles.target.fontFeatureSettings,
          })
        )
      );

      const totalWidth = letterMetrics.reduce(
        (sum, metric) => sum + metric.width,
        0
      );
      const targetRect = targetSpan.getBoundingClientRect();
      const startOffset = (targetRect.width - totalWidth) / 2;

      // 6. Crear y animar letras
      let sourceIndex = 0;
      const animatedLetters = [...word].map((char, index) => {
        const letterSpan = document.createElement("span");
        letterSpan.textContent = char === " " ? "\u00A0" : char;
        letterSpan.className = ANIMATION_CSS_CLASSES.ANIMATED_LETTER;

        // Calcular posiciones
        let sourceX, sourceY;

        if (char === " ") {
          // Para espacios, interpolar entre las posiciones de las letras adyacentes
          const prevSourceIndex = sourceIndex - 1;
          const nextSourceIndex = sourceIndex;
          let prevCell = cells[prevSourceIndex];
          let nextCell = cells[nextSourceIndex];

          // Si no hay celda previa o siguiente, usar la más cercana disponible
          if (!prevCell) prevCell = nextCell || cells[0];
          if (!nextCell) nextCell = prevCell || cells[cells.length - 1];

          const prevRect = prevCell.getBoundingClientRect();
          const nextRect = nextCell.getBoundingClientRect();

          sourceX = (prevRect.left + nextRect.right) / 2;
          sourceY = (prevRect.top + nextRect.bottom) / 2;
        } else {
          // Para letras normales, usar la posición de la celda fuente
          const sourceCell = cells[sourceIndex];
          const sourceLetter = sourceCell.querySelector(".text");
          const sourceRect =
            sourceLetter?.getBoundingClientRect() ||
            sourceCell.getBoundingClientRect();

          sourceX = sourceRect.left + sourceRect.width / 2;
          sourceY = sourceRect.top + sourceRect.height / 2;
          sourceIndex++;
        }

        letterSpan.style.left = `${sourceX}px`;
        letterSpan.style.top = `${sourceY}px`;

        document.body.appendChild(letterSpan);

        // Forzar un reflow para asegurar que los estilos iniciales se apliquen
        letterSpan.offsetHeight;

        const previousLettersWidth = letterMetrics
          .slice(0, index)
          .reduce((sum, metric) => sum + metric.width, 0);

        const targetX =
          targetRect.left +
          startOffset +
          previousLettersWidth +
          letterMetrics[index].width / 2;
        const targetY = targetRect.top + targetRect.height / 2;

        return {
          element: letterSpan,
          endX: targetX,
          endY: targetY,
        };
      });

      // 7. Animar las letras
      const letterAnimationPromises = animatedLetters.map(
        ({ element, endX, endY }, i) => {
          return new Promise((resolve) => {
            const startDelay = i * durations.LETTER_DELAY;
            setTimeout(() => {
              console.group(`🔤 Letra ${i + 1}:`);
              console.log("Estado inicial:", {
                color: window.getComputedStyle(element).color,
                classList: [...element.classList],
              });

              // Agregar clase in-transit inmediatamente para el motion blur inicial
              element.classList.add(ANIMATION_CSS_CLASSES.IN_TRANSIT);

              // Aplicamos las variables CSS para la posición final
              element.style.setProperty(
                "--letter-x",
                `${endX - element.offsetLeft}px`
              );
              element.style.setProperty(
                "--letter-y",
                `${endY - element.offsetTop}px`
              );

              // Verificar color después de la transición
              setTimeout(() => {
                const finalColor = window.getComputedStyle(element).color;
                console.log("Estado final:", {
                  color: finalColor,
                  classList: [...element.classList],
                  computedColor: window.getComputedStyle(element).color,
                });
                console.groupEnd();
              }, durations.LETTER_ANIMATION);

              resolve();
            }, startDelay);
          });
        }
      );

      await Promise.all(letterAnimationPromises);
      // Esperar a que terminen todas las transiciones incluyendo el color
      await new Promise((r) => setTimeout(r, durations.LETTER_ANIMATION * 1.2));

      // Actualizar la palabra y remover las letras animadas en el mismo frame
      requestAnimationFrame(() => {
        targetSpan.textContent = word;
        animatedLetters.forEach(({ element }) => element.remove());
      });

      // 9. Limpiar el resto
      selection.forEach((position) => {
        const cell = document.getElementById(`tile-${position}`);
        cell.classList.remove(ANIMATION_CSS_CLASSES.FOUND_TEMP);
      });

      await Promise.all(animations.map((anim) => anim.finished));
      animations.forEach((anim) => anim.cancel());

      requestAnimationFrame(() => {
        this._events.emit(EventService.EVENTS.ANIMATION_END);
      });

      console.groupEnd();
    } catch (error) {
      console.error("Error en la animación:", error);
      this._events.emit(EventService.EVENTS.ANIMATION_END);
      console.groupEnd();
    }
  }

  async startConfetti() {
    console.group("[CONFETTI] Iniciando animación de confeti");
    const confetti = await this._loadConfetti();
    if (!confetti) {
      console.groupEnd();
      return;
    }

    try {
      const colors = this._getConfettiColors();
      const { FIRST_WAVE, SECOND_WAVE, WAVE_DELAY } = CONFETTI_TIMING;

      // Primera ola desde los lados - sincrónicamente para timing preciso
      console.log("[CONFETTI] Lanzando primera ola con vibración MEDIUM");
      await NativeServices.vibrate(VibrationPatterns.MEDIUM);

      confetti({
        particleCount: FIRST_WAVE.particles,
        spread: FIRST_WAVE.spread,
        origin: { x: 0, y: 0.35 },
        colors,
      });

      confetti({
        particleCount: FIRST_WAVE.particles,
        spread: FIRST_WAVE.spread,
        origin: { x: 1, y: 0.35 },
        colors,
      });

      // Espera precisa usando el tiempo configurado
      await new Promise((r) => setTimeout(r, WAVE_DELAY));

      console.log("[CONFETTI] Lanzando segunda ola con vibración HEAVY");
      await NativeServices.vibrate(VibrationPatterns.HEAVY);

      confetti({
        particleCount: SECOND_WAVE.particles,
        spread: SECOND_WAVE.spread,
        origin: { x: 0.5, y: 0.3 },
        gravity: SECOND_WAVE.gravity,
        scalar: SECOND_WAVE.scalar,
        colors,
      });
    } catch (error) {
      console.error("[CONFETTI] Error lanzando confeti:", error);
    } finally {
      console.groupEnd();
    }
  }

  async animateVictory() {
    console.group("[CONFETTI_VIB] animateVictory iniciado");
    this._events.emit(EventService.EVENTS.ANIMATION_START);
    try {
      // Ahora las vibraciones están directamente integradas en startConfetti
      console.log("[CONFETTI_VIB] Llamando a startConfetti");
      await this.startConfetti();
      console.log("[CONFETTI_VIB] startConfetti completado");
    } finally {
      this._events.emit(EventService.EVENTS.ANIMATION_END);
      console.groupEnd();
    }
  }

  _getConfettiColors() {
    // Primero intentar obtener colores de CSS custom property
    const confettiColors = getComputedStyle(document.documentElement)
      .getPropertyValue("--confetti-colors")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    return confettiColors;
  }

  updateCellStates(cells, { add = [], remove = [] }) {
    cells.forEach((cell) => {
      remove.forEach((className) => cell.classList.remove(className));
      add.forEach((className) => cell.classList.add(className));
    });
  }

  async animateUnusedCells(positions) {
    this._events.emit(EventService.EVENTS.ANIMATION_START);
    try {
      const elements = positions
        .map((pos) => document.getElementById(`tile-${pos}`))
        .filter(Boolean);

      if (elements.length === 0) {
        this._events.emit(EventService.EVENTS.ANIMATION_END);
        return;
      }

      console.log(
        "🔄 Preparando animación de celdas unused:",
        positions.length
      );

      // Solución mejorada: Crear una función que actualice el DOM por completo
      // usando RAF para asegurar que las transiciones funcionen correctamente
      return new Promise((resolve) => {
        // Primero, aseguramos que las celdas estén en su estado normal
        elements.forEach((cell) => {
          // Eliminar la clase unused si ya la tiene
          cell.classList.remove(ANIMATION_CSS_CLASSES.UNUSED);
        });

        // Forzar un reflow completo antes de aplicar la clase
        document.body.offsetHeight;

        // Usar doble requestAnimationFrame para garantizar que el navegador haya pintado
        // el estado inicial antes de aplicar la transformación
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Ahora aplicamos la clase unused para activar la transición
            elements.forEach((cell) => {
              cell.classList.add(ANIMATION_CSS_CLASSES.UNUSED);
            });

            // Esperar a que termine la transición
            setTimeout(() => {
              this._events.emit(EventService.EVENTS.ANIMATION_END);
              resolve();
            }, 300);
          });
        });
      });
    } catch (error) {
      console.error("Error animando celdas unused:", error);
      this._events.emit(EventService.EVENTS.ANIMATION_END);
    }
  }

  stopConfetti() {
    if (this._confettiModule) {
      this._confettiModule.reset();
    }
  }

  cleanup() {
    // Ejecutar todo en un solo batch para mejor rendimiento
    requestAnimationFrame(() => {
      // 1. Limpiar todas las letras animadas
      document
        .querySelectorAll(ANIMATION_CSS_CLASSES.ANIMATED_LETTER)
        .forEach((el) => el.remove());

      // 2. Limpiar estados de animación y selección
      document
        .querySelectorAll(
          `.${ANIMATION_CSS_CLASSES.FOUND_TEMP}, .${ANIMATION_CSS_CLASSES.ANIMATING}, .${ANIMATION_CSS_CLASSES.IN_TRANSIT}, .${ANIMATION_CSS_CLASSES.MARK_SELECTED}`
        )
        .forEach((el) => {
          el.classList.remove(
            ANIMATION_CSS_CLASSES.FOUND_TEMP,
            ANIMATION_CSS_CLASSES.ANIMATING,
            ANIMATION_CSS_CLASSES.IN_TRANSIT,
            ANIMATION_CSS_CLASSES.MARK_SELECTED
          );
        });

      // 3. Limpiar líneas SVG de selección
      document.querySelector(".selection-svg")?.remove();

      // 4. Detener el confeti
      this.stopConfetti();

      // 5. Limpiar animaciones activas
      this._activeAnimations.clear();

      // 6. Emitir evento de limpieza completada
      this._events.emit("animation-cleanup-complete");
    });
  }

  destroy() {
    this._events.destroy();
    this._activeAnimations.clear();
    this.cleanup();

    // Eliminar el event listener de resize
    window.removeEventListener("resize", this._handleWindowResize);

    // Limpiar cualquier timeout pendiente
    if (this._resizeTimeout) {
      clearTimeout(this._resizeTimeout);
      this._resizeTimeout = null;
    }
  }

  /**
   * Deshabilita temporalmente las transiciones durante el redimensionamiento de la ventana
   * @private
   */
  _handleWindowResize() {
    // Añadir clase para deshabilitar transiciones
    document.body.classList.add(ANIMATION_CSS_CLASSES.DISABLE_TRANSITIONS);

    // Limpiar timeout existente si hay uno
    if (this._resizeTimeout) {
      clearTimeout(this._resizeTimeout);
    }

    // Configurar un nuevo timeout para restaurar las transiciones
    this._resizeTimeout = setTimeout(() => {
      document.body.classList.remove(ANIMATION_CSS_CLASSES.DISABLE_TRANSITIONS);
    }, 200); // 200ms es tiempo suficiente para que se complete el resize
  }
}
