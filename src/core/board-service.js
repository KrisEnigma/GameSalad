import { ValidationService } from "./validation-service.js";
import { EventService } from "./event-service.js";
import { AnimationService } from "./animation-service.js";

export class BoardService {
  constructor(elements) {
    this.elements = elements;
    this.events = new EventService();
    this.board = this.elements.getElement("board");
    this.foundWords = new Set();
    this.usedLetters = new Set();
    this.currentLevelData = null; // Añadir referencia a los datos del nivel actual
  }

  initialize() {
    this.board.innerHTML = "";
    this.board.appendChild(this.#createBoardFragment());
  }

  updateBoard(levelData) {
    if (!levelData) {
      console.warn("No hay datos de nivel para mostrar");
      return;
    }

    // Almacenar los datos del nivel actual para referencia y asegurarse que es una copia fresca
    this.currentLevelData = JSON.parse(JSON.stringify(levelData));
    console.log(
      `🔄 [Board] updateBoard: Actualizando datos de nivel (${
        Object.keys(this.currentLevelData).length
      } palabras)`
    );

    const grid = ValidationService.createGridFromLevel(levelData);

    this.#updateLetters(grid);
    this.#clearPreviousState();

    // Verificar que las letras se hayan actualizado correctamente
    this.#validateBoardUpdate(grid);
  }

  // Eliminamos el método checkWord ya que ahora hacemos la validación directamente en Game.handleSelectionComplete

  markWordAsFound(word) {
    this.foundWords.add(word);

    // Inmediatamente identificar y marcar las celdas que se convertirán en "unused"
    if (this.currentLevelData) {
      const futureUnusedPositions = this.#calculateFutureUnusedPositions();

      // Marcar las celdas que se convertirán en "unused" con una clase especial
      futureUnusedPositions.forEach((pos) => {
        const cell = document.getElementById(`tile-${pos}`);
        if (cell) {
          cell.classList.add("will-be-unused");
        }
      });
    }
  }

  updateUnusedLetters() {
    // Usar siempre los datos del nivel actual
    if (
      !this.currentLevelData ||
      Object.keys(this.currentLevelData).length === 0
    ) {
      console.log(
        "❌ [Board] updateUnusedLetters: Sin datos de nivel para actualizar letras no usadas"
      );
      return;
    }

    this.usedLetters = ValidationService.getUsedLetters(
      this.currentLevelData,
      this.foundWords
    );
    this.#updateUnusedCells();

    // Eliminar la clase will-be-unused ya que ya no es necesaria después de la actualización
    document.querySelectorAll(".will-be-unused").forEach((cell) => {
      cell.classList.remove("will-be-unused");
    });
  }

  // Método privado para calcular posiciones que se convertirán en "unused"
  #calculateFutureUnusedPositions() {
    const allPositions = ValidationService.getAllGridPositions();
    const futureUsedLetters = ValidationService.getUsedLetters(
      this.currentLevelData,
      this.foundWords
    );

    return allPositions.filter((pos) => !futureUsedLetters.has(pos));
  }

  // Private methods
  #createBoardFragment() {
    const fragment = document.createDocumentFragment();
    for (let i = 1; i <= 16; i++) {
      const row = String.fromCharCode(96 + Math.ceil(i / 4));
      const col = ((i - 1) % 4) + 1;
      const position = `${row}${col}`;
      fragment.appendChild(this.#createBoardCell(position));
    }
    return fragment;
  }

  #createBoardCell(position) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.id = `tile-${position}`;

    // Creamos el hitbox y la marca con sus IDs específicos
    const hitbox = document.createElement("div");
    hitbox.className = "hitbox";
    hitbox.dataset.position = position;

    const mark = document.createElement("div");
    mark.className = "mark";
    mark.id = `mark-${position}`;

    const text = document.createElement("div");
    text.className = "text";
    text.id = `letter-${position}`;

    // Aseguramos el orden correcto de los elementos
    cell.appendChild(hitbox);
    cell.appendChild(mark);
    cell.appendChild(text);

    return cell;
  }

  #updateLetters(grid) {
    for (let i = 0; i < 16; i++) {
      const row = Math.floor(i / 4);
      const col = i % 4;
      const pos = `${String.fromCharCode(97 + row)}${col + 1}`;
      const letterElement = document.getElementById(`letter-${pos}`);
      if (letterElement) {
        const letter = grid[row][col];
        letterElement.textContent = letter;
      } else {
        console.error(`No se encontró el elemento para la posición ${pos}`);
      }
    }
  }

  #validateBoardUpdate(grid) {
    let isValid = true;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const pos = `${String.fromCharCode(97 + row)}${col + 1}`;
        const letterElement = document.getElementById(`letter-${pos}`);
        if (letterElement?.textContent !== grid[row][col]) {
          console.error(`Desajuste en posición ${pos}:`, {
            esperado: grid[row][col],
            actual: letterElement?.textContent,
          });
          isValid = false;
        }
      }
    }
    console.log("Validación del tablero:", isValid ? "OK" : "Fallida");
  }

  #clearPreviousState() {
    const positions = ValidationService.getAllGridPositions();
    positions.forEach((pos) => {
      const tile = document.getElementById(`tile-${pos}`);
      tile?.classList.remove("found-temp", "unused");
    });
  }

  #updateUnusedCells() {
    console.log("🔄 Actualizando celdas unused");

    const allPositions = ValidationService.getAllGridPositions();
    const unusedPositions = [];

    // Primero identificamos todas las posiciones unused
    allPositions.forEach((pos) => {
      if (!this.usedLetters.has(pos)) {
        unusedPositions.push(pos);
      }
    });

    if (unusedPositions.length === 0) {
      console.log("✅ No hay celdas unused para actualizar");
      return;
    }

    console.log(`🎯 Encontradas ${unusedPositions.length} posiciones unused`);

    // Ahora creamos un servicio de animación para manejar la transición
    const animationService = new AnimationService();

    // La animación se encarga de aplicar correctamente la clase con la transición
    animationService.animateUnusedCells(unusedPositions).then(() => {
      // Una vez completada la animación, removemos los hitboxes
      // Esto se hace después para no interferir con la transición
      unusedPositions.forEach((pos) => {
        const cell = document.getElementById(`tile-${pos}`);
        if (!cell) return;

        const mark = cell.querySelector(".mark");
        mark?.classList.remove("selected");

        // Remover hitbox para prevenir interacción solo después de la animación
        const hitbox = cell.querySelector(".hitbox");
        if (hitbox) {
          hitbox.remove();
        }
      });

      console.log("✅ Actualización de celdas unused completada");
    });
  }

  resetState() {
    // Reset explícito del estado interno
    this.foundWords = new Set();
    this.usedLetters = new Set();
    // No eliminar los datos del nivel actual para mantener la referencia

    console.log("🔄 [Board] Estado reseteado");

    // Verificar que tenemos datos del nivel actual
    console.log(
      `📊 [Board] Datos de nivel actual: ${
        this.currentLevelData ? "disponibles" : "NO disponibles"
      }`
    );
    if (this.currentLevelData) {
      console.log(
        `📊 [Board] Palabras en nivel actual: ${Object.keys(
          this.currentLevelData
        ).join(", ")}`
      );
    }

    // Reset visual del tablero
    requestAnimationFrame(() => {
      const cells = document.querySelectorAll(".cell");
      cells.forEach((cell) => {
        cell.style.transition = "none";
        cell.classList.remove("unused", "found", "found-temp");
        cell.offsetHeight; // Force reflow
        cell.style.transition = "";

        // Restaurar hitbox
        if (!cell.querySelector(".hitbox")) {
          const position = cell.id.replace("tile-", "");
          const hitbox = document.createElement("div");
          hitbox.className = "hitbox";
          hitbox.dataset.position = position;
          cell.insertBefore(hitbox, cell.firstChild);
        }

        // Limpiar marca
        const mark = cell.querySelector(".mark");
        if (mark) mark.className = "mark";
      });
    });

    // Emitir evento para indicar que el tablero ha sido reseteado
    this.events.emit("boardReset");
  }

  destroy() {
    this.events.destroy();
    this.board = null;
    this.currentLevelData = null;
  }
}
