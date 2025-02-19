import confetti from "canvas-confetti";

class AnimationManager {
  static DURATIONS = {
    LETTER_DELAY: 50,
    LETTER_ANIMATION: 300,
    VICTORY_DELAY: 300,
    SELECTION_RESET: 100,
  };

  static {
    // Agregar listener para loggear posiciones cuando el DOM esté listo
    window.addEventListener("DOMContentLoaded", () => {
      // Dar tiempo a que el tablero se renderice completamente
      setTimeout(() => this.logBoardPositions(), 500);
    });

    this.bindDebugEvents();
  }

  static async measureText(text, style) {
    const temp = document.createElement("div");
    temp.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: pre;
        ${Object.entries(style)
          .map(([k, v]) => `${k}:${v}`)
          .join(";")}
    `;
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

  static animateWordFound(selection, wordElement, word) {
    return new Promise((resolve) => {
      const lastCell = document.getElementById(
        `tile-${selection[selection.length - 1]}`
      );
      const lastLetter = lastCell.querySelector(".text");
      const targetSpan = wordElement.querySelector("span");

      targetSpan.style.opacity = "0";

      const targetFontStyle = window.getComputedStyle(targetSpan);

      const computedThemeStyles = {
        source: window.getComputedStyle(lastLetter),
        target: window.getComputedStyle(wordElement),
      };

      // Mover toda la lógica async dentro de una función async IIFE
      (async () => {
        const letterMetrics = await Promise.all(
          [...word].map(async (char) => {
            return this.measureText(char, {
              "font-size": targetFontStyle.fontSize,
              "font-family": "var(--font-family-content)",
              "font-weight": computedThemeStyles.target.fontWeight,
              "letter-spacing": computedThemeStyles.target.letterSpacing,
              "text-transform": computedThemeStyles.target.textTransform,
              "font-feature-settings":
                computedThemeStyles.target.fontFeatureSettings,
            });
          })
        );

        const totalWidth = letterMetrics.reduce(
          (sum, metric) => sum + metric.width,
          0
        );
        const targetRect = targetSpan.getBoundingClientRect();
        const sourceRect = lastCell.getBoundingClientRect();

        const startOffset = (targetRect.width - totalWidth) / 2;

        const letters = [...word].map((char, index) => {
          const letterSpan = document.createElement("span");
          letterSpan.textContent = char === " " ? "\u00A0" : char;
          letterSpan.className = "animated-letter";

          const sourceX = sourceRect.left + sourceRect.width / 2;
          const sourceY = sourceRect.top + sourceRect.height / 2;

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
            startX: sourceX,
            startY: sourceY,
            sourceStyles: computedThemeStyles.source,
            targetStyles: computedThemeStyles.target,
          };
        });

        letters.forEach(({ element, endX, endY, startX, startY }, index) => {
          setTimeout(() => {
            element.classList.add("animating");

            requestAnimationFrame(() => {
              element.classList.add("in-transit");
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
                if (e.propertyName === "transform") {
                  element.removeEventListener(
                    "transitionend",
                    handleTransitionEnd
                  );
                  element.classList.remove("animating", "in-transit");

                  if (index === letters.length - 1) {
                    targetSpan.textContent = word;
                    targetSpan.style.opacity = "1";

                    requestAnimationFrame(() => {
                      document
                        .querySelectorAll(".animated-letter")
                        .forEach((el) => el.remove());
                    });
                  }
                }
              };

              element.addEventListener("transitionend", handleTransitionEnd);
            });
          }, index * this.DURATIONS.LETTER_DELAY);
        });

        selection.forEach((position) => {
          const cell = document.getElementById(`tile-${position}`);
          cell.classList.add("found-temp");
        });

        const totalDuration =
          letters.length * this.DURATIONS.LETTER_DELAY +
          this.DURATIONS.LETTER_ANIMATION;
        setTimeout(() => {
          selection.forEach((position) => {
            const cell = document.getElementById(`tile-${position}`);
            cell.classList.remove("found-temp");
          });
          resolve(totalDuration);
        }, totalDuration);
      })();
    });
  }

  static confetti = {
    config: {
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
          origin: [{ x: 0.5, y: 0.3 }],
        },
      ],
    },

    async start() {
      if (!this.instance) await this.initialize();
      if (!this.instance) return;

      const colors = this.getColors();

      for (let i = 0; i < this.config.waves.length; i++) {
        const wave = this.config.waves[i];
        wave.origin.forEach((origin) => {
          this.instance({ ...wave, colors, origin });
        });

        window.dispatchEvent(
          new CustomEvent("victory-effect", {
            detail: { stage: `${i + 1}-wave` },
          })
        );

        if (i === 0) await new Promise((r) => setTimeout(r, 250));
      }
    },

    getColors() {
      return (
        getComputedStyle(document.documentElement)
          .getPropertyValue("--confetti-colors")
          .split(",")
          .map((c) => c.trim()) || [
          "#ffd700",
          "#ff3939",
          "#00ff7f",
          "#4169e1",
          "#ff69b4",
        ]
      );
    },

    async initialize() {
      const canvas = document.getElementById("confetti-canvas");
      if (canvas) this.instance = confetti.create(canvas, { resize: true });
    },

    stop() {
      this.instance?.reset();
      this.instance = null;
    },
  };

  static async animateVictory(callback) {
    document.getElementById("victory-modal")?.classList.add("active");
    await this.confetti.start();
    callback?.();
  }

  static updateCellStates(cells, { add = [], remove = [] }) {
    cells.forEach((cell) => {
      requestAnimationFrame(() => add.length && cell.classList.add(...add));
      remove.length && cell.classList.remove(...remove);
    });
  }

  static resetSelectionWithDelay(selectionManager) {
    setTimeout(
      () => selectionManager.reset(),
      this.DURATIONS.SELECTION_RESET || 100
    );
  }

  static animateUnusedCells(positions) {
    positions.forEach((pos) => {
      const cell = document.getElementById(`tile-${pos}`);
      cell?.classList.remove("found-temp");
      requestAnimationFrame(() => cell?.classList.add("unused"));
    });
  }

  static stopConfetti = () => this.confetti.stop();
  static cleanupAnimations = () =>
    document.querySelectorAll(".animated-letter").forEach((el) => el.remove());

  static bindDebugEvents() {
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "t") {
        this.confetti.test();
      }
      if (!isNaN(parseInt(e.key)) && e.key !== "0") {
        const x = parseInt(e.key) / 10;
        this.confetti.test(x);
      }
    });

    // Log board positions when DOM is ready
    window.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => this.logBoardPositions(), 500);
    });
  }

  static logBoardPositions() {
    console.group("📊 Board Layout Debug");
    const board = document.querySelector(".board");
    if (!board) {
      console.warn("Board not found");
      console.groupEnd();
      return;
    }

    const cells = Array.from(board.querySelectorAll(".cell"));
    const boardRect = board.getBoundingClientRect();

    console.log("📋 Board position:", {
      left: Math.round(boardRect.left),
      top: Math.round(boardRect.top),
      width: Math.round(boardRect.width),
      height: Math.round(boardRect.height),
    });

    cells.forEach((cell, index) => {
      const textElement = cell.querySelector(".text");
      if (textElement) {
        const rect = textElement.getBoundingClientRect();
        console.log(`Cell ${index} (${textElement.textContent}):`, {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    });
    console.groupEnd();
  }
}

export { AnimationManager as A };
