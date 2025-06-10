import { EventService } from "./event-service.js";
import { ConfigurationService } from "./configuration-service.js";

const CSS_CLASSES = {
  WILL_BE_UNUSED: "will-be-unused",
  FOUND_TEMP: "found-temp",
  SELECTED: "selected",
};

export class SelectionService {
  constructor({ onSelectionChange, onSelectionComplete }) {
    this.config = ConfigurationService.getInstance();
    this.events = new EventService();
    this.selection = [];
    this.isAnimating = false;
    this._pendingWordFound = false;
    this._state = {
      isDragging: false,
      startTime: null,
      startPosition: null,
      totalMovement: 0,
      lastPoint: null,
      lastEventTime: 0,
      lastPosition: null, // Añadimos tracking de última posición para optimizar
      wordFound: false, // Nuevo estado para tracking de palabra encontrada
    };
    this._onSelectionChange = onSelectionChange;
    this._onSelectionComplete = onSelectionComplete;

    // Crear referencias enlazadas a los métodos para poder eliminarlos correctamente
    this._boundHandleStart = this._handleStart.bind(this);
    this._boundHandleMove = this._handleMove.bind(this);
    this._boundHandleEnd = this._handleEnd.bind(this);
    this._boundHandleGlobalClick = this._handleGlobalClick.bind(this);
    this._boundHandleResize = this._handleResize.bind(this);

    // Suscribirse al evento de palabra encontrada para limpiar el SVG antes de animar
    this.events.on(
      EventService.EVENTS.WORD_FOUND,
      this._onWordFound.bind(this)
    );
    this.events.on(
      EventService.EVENTS.ANIMATION_START,
      this._onAnimationStart.bind(this)
    );

    // Añadir listener para el evento resize
    window.addEventListener('resize', this._boundHandleResize);

    this.initialize();
  }

  initialize() {
    const board = document.querySelector(".board");
    if (!board) {
      console.log(
        "Tablero no encontrado, reintentando en el siguiente frame..."
      );
      requestAnimationFrame(() => this.initialize());
      return;
    }

    try {
      // Limpiar los event listeners anteriores si existen
      this._removeEventListeners();

      // Crear o recuperar el SVG de manera segura
      this._ensureSvgElement(board);

      // Configurar opciones de eventos
      const touchOptions = {
        passive: false,
      };

      // Ya no necesitamos capture: true porque manejamos la interacción por celda
      board.addEventListener("mousedown", this._boundHandleStart);
      board.addEventListener("mousemove", this._boundHandleMove);
      board.addEventListener("mouseup", this._boundHandleEnd);
      board.addEventListener("mouseleave", this._boundHandleEnd);

      // Touch events con opciones actualizadas
      board.addEventListener(
        "touchstart",
        this._boundHandleStart,
        touchOptions
      );
      board.addEventListener("touchmove", this._boundHandleMove, touchOptions);
      board.addEventListener("touchend", this._boundHandleEnd);
      board.addEventListener("touchcancel", this._boundHandleEnd);

      // Global click para limpiar selección
      document.addEventListener("mousedown", this._boundHandleGlobalClick);
      document.addEventListener("touchstart", this._boundHandleGlobalClick, {
        passive: true,
      });
    } catch (error) {
      console.error("Error al inicializar SelectionService:", error);
      // Intentar nuevamente en el siguiente frame
      requestAnimationFrame(() => this.initialize());
    }
  }

  _ensureSvgElement(board) {
    // Intentar obtener el SVG existente o crear uno nuevo
    let svg = board.querySelector("svg.selection-svg");

    if (svg) {
      // Si ya existe, solo limpiarlo
      svg.innerHTML = "";
    } else {
      // Si no existe, crear uno nuevo con clase para identificación
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.classList.add("selection-svg"); // Añadir clase para identificar fácilmente

      // Insertar al principio del tablero
      board.insertBefore(svg, board.firstChild);
      console.log("SVG insertado en el tablero");
    }

    this.svg = svg;
    this.board = board;

    console.log("✅ SVG inicializado correctamente");
  }

  _removeEventListeners() {
    if (this.board) {
      this.board.removeEventListener("mousedown", this._boundHandleStart);
      this.board.removeEventListener("mousemove", this._boundHandleMove);
      this.board.removeEventListener("mouseup", this._boundHandleEnd);
      this.board.removeEventListener("mouseleave", this._boundHandleEnd);
      this.board.removeEventListener("touchstart", this._boundHandleStart);
      this.board.removeEventListener("touchmove", this._boundHandleMove);
      this.board.removeEventListener("touchend", this._boundHandleEnd);
      this.board.removeEventListener("touchcancel", this._boundHandleEnd);
    }

    document.removeEventListener("mousedown", this._boundHandleGlobalClick);
    document.removeEventListener("touchstart", this._boundHandleGlobalClick);
  }

  _onWordFound() {
    console.log("🧹 Limpiando selección al encontrar palabra");
    this.clearSelection();
    // Marcar que se encontró una palabra durante el arrastre actual
    if (this._state.isDragging) {
      this._state.wordFound = true;
    }
  }

  _onAnimationStart() {
    console.log("🎬 Animación iniciada");
    this._pendingWordFound = false;
  }

  clearSelection() {
    // Verificar si hay celdas en animación pero que NO se convertirán en "unused"
    const blockingCells = this.selection.filter((pos) => {
      const cell = document.getElementById(`tile-${pos}`);
      // Solo bloqueamos si la celda está en animación y tiene la clase "will-be-unused"
      return (
        cell &&
        cell.classList.contains(CSS_CLASSES.FOUND_TEMP) &&
        cell.classList.contains(CSS_CLASSES.WILL_BE_UNUSED)
      );
    });

    if (blockingCells.length > 0) {
      console.log(
        "❌ Limpieza bloqueada por celdas que serán unused:",
        blockingCells
      );
      return;
    }

    // Limpiar SVG
    if (this.svg) {
      console.log("🧹 Limpiando SVG");
      this.svg.innerHTML = "";
    }

    // Limpiar marcas seleccionadas
    const marks = document.querySelectorAll(".mark.selected");
    marks.forEach((mark) => mark.classList.remove(CSS_CLASSES.SELECTED));

    // Reiniciar estado
    this.selection = [];

    // Notificar reset
    this.events.emit(EventService.EVENTS.SELECTION_RESET);
  }

  _updateSelectionLine() {
    // Si no hay selección o solo hay un elemento, no hay líneas que dibujar
    if (this.selection.length < 2) {
      if (this.svg) this.svg.innerHTML = "";
      return;
    }

    // Verificar si el SVG sigue siendo válido
    if (!this.svg || !this.svg.isConnected) {
      const board = document.querySelector(".board");
      if (board) {
        this._ensureSvgElement(board);
      } else {
        return; // No podemos dibujar líneas sin tablero
      }
    }

    // Limpiar líneas existentes
    this.svg.innerHTML = "";

    try {
      const board = this.svg.parentElement;
      const boardRect = board.getBoundingClientRect();

      // Filtrar la selección para solo incluir celdas no animadas
      const nonAnimatedCells = this.selection.filter((pos) => {
        const cell = document.getElementById(`tile-${pos}`);
        return cell && !cell.classList.contains(CSS_CLASSES.FOUND_TEMP);
      });

      // Iterar por cada par de posiciones en la selección filtrada
      for (let i = 1; i < nonAnimatedCells.length; i++) {
        const prevPos = nonAnimatedCells[i - 1];
        const currentPos = nonAnimatedCells[i];

        // Obtener las celdas directamente
        const prevCell = document.getElementById(`tile-${prevPos}`);
        const currentCell = document.getElementById(`tile-${currentPos}`);

        if (!prevCell || !currentCell) continue;

        // Obtener los rectángulos directamente de las celdas
        const prevRect = prevCell.getBoundingClientRect();
        const currentRect = currentCell.getBoundingClientRect();

        // Calcular coordenadas centrales relativas al tablero
        const x1 = prevRect.left + prevRect.width / 2 - boardRect.left;
        const y1 = prevRect.top + prevRect.height / 2 - boardRect.top;
        const x2 = currentRect.left + currentRect.width / 2 - boardRect.left;
        const y2 = currentRect.top + currentRect.height / 2 - boardRect.top;

        // Crear y configurar la línea
        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);

        // Añadir la línea al SVG
        this.svg.appendChild(line);
      }
    } catch (error) {
      console.error("Error dibujando líneas:", error);
    }
  }

  getState() {
    return {
      isAnimating: this.isAnimating,
      currentSelection: [...this.selection],
    };
  }

  _extractEventInfo(e) {
    const position = this._getPositionFromEvent(e);
    return { position };
  }

  _handleStart(e) {
    console.group("🎯 START - Estado inicial:", this.getState());

    if (this._shouldIgnoreEvent(e)) {
      console.groupEnd();
      return;
    }

    const { position } = this._extractEventInfo(e);
    if (!position) {
      console.groupEnd();
      return;
    }

    console.log("📍 Posición detectada:", position);
    this._initializeState(e, position);

    // Handle clicks on selected cells
    if (this._handleClickOnSelectedCell(position)) {
      console.groupEnd();
      return;
    }

    // Handle new selection
    this._handleNewSelection(position);
    console.groupEnd();
  }

  _shouldIgnoreEvent(e) {
    // Si estamos animando, ignorar el evento
    if (this.isAnimating) {
      console.log("⏳ Animación en curso - ignorando evento");
      return true;
    }

    // Verificar si el click fue dentro del tablero pero fuera de hitbox
    const isInsideBoard = e.target.closest(".board") !== null;
    const hitboxClicked = e.target.classList.contains("hitbox");

    if (isInsideBoard && !hitboxClicked) {
      console.log(
        "🎯 Click dentro del tablero pero fuera de hitbox - reseteando selección"
      );
      this.clearSelection();
      return true;
    }

    // Prevenir múltiples eventos para un mismo touch (debounce)
    const now = Date.now();
    if (now - this._state.lastEventTime < 100) {
      console.log("⏱️ Debounce activo - ignorando evento");
      return true;
    }

    return false;
  }

  _initializeState(e, position) {
    // Prevenir eventos por defecto solo para touch
    if (e.type.includes("touch")) {
      e.preventDefault();
    }

    const now = Date.now();
    this._state.lastEventTime = now;

    // Verificar si alguna celda de la selección actual tiene will-be-unused
    const hasWillBeUnusedCell = this.selection.some((pos) => {
      const cell = document.getElementById(`tile-${pos}`);
      return cell && cell.classList.contains(CSS_CLASSES.WILL_BE_UNUSED);
    });

    // Si hay celdas que serán unused en la selección actual, limpiar la selección
    if (hasWillBeUnusedCell) {
      this.clearSelection();
    }

    // Verificar si la celda objetivo será unused
    const targetCell = document.getElementById(`tile-${position}`);
    if (targetCell.classList.contains(CSS_CLASSES.WILL_BE_UNUSED)) {
      console.log("❌ Celda será unused, ignorando");
      return;
    }

    // Guardar estado inicial
    this._state = {
      isDragging: true,
      startTime: now,
      startPosition: position,
      totalMovement: 0,
      lastEventTime: now,
      lastPoint: e.touches
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: e.clientX, y: e.clientY },
      lastPosition: null,
      wordFound: false,
    };
    console.log("🔄 Estado inicial:", this._state);
  }

  _handleClickOnSelectedCell(position) {
    // Si es un click en la última celda seleccionada
    if (
      this.selection.length > 0 &&
      position === this.selection[this.selection.length - 1]
    ) {
      console.log("🎯 Click en última celda");
      if (this.selection.length === 1) {
        console.log("❌ Deseleccionando única celda");
        this.clearSelection();
        return true;
      }
      this._removeLastCell();
      return true;
    }

    // Si es un click en la penúltima celda
    if (
      this.selection.length > 1 &&
      position === this.selection[this.selection.length - 2]
    ) {
      console.log("🎯 Click en penúltima celda");
      this._removeLastCell();
      return true;
    }

    return false;
  }

  _removeLastCell() {
    const lastMark = document.getElementById(
      `mark-${this.selection[this.selection.length - 1]}`
    );
    lastMark?.classList.remove(CSS_CLASSES.SELECTED);
    this.selection.pop();
    this._updateSelectionLine();
    this._onSelectionChange?.(this.selection);
  }

  _handleNewSelection(position) {
    // Si ya está en la selección pero no es la última ni penúltima, comenzar nueva selección
    if (this.selection.includes(position)) {
      console.log("🔄 Reiniciando selección - posición ya incluida");
      this.clearSelection();
      this._addToSelection(position);
      return;
    }

    // Verificar adyacencia
    const isAdjacent = this._isAdjacent(position);
    console.log("📊 Verificación de adyacencia:", {
      position,
      lastPosition: this.selection[this.selection.length - 1],
      isAdjacent,
      currentSelection: [...this.selection],
    });

    // Si no hay selección o la posición es adyacente
    if (this.selection.length === 0 || isAdjacent) {
      console.log(
        this.selection.length === 0
          ? "✨ Iniciando nueva selección"
          : "➕ Añadiendo posición adyacente"
      );
      this._addToSelection(position);
    } else {
      console.log("🔄 Reiniciando selección - no adyacente");
      this.clearSelection();
      this._addToSelection(position);
    }
  }

  _handleMove(e) {
    if (!this._state.isDragging) return;

    // Si se encontró una palabra durante este arrastre, ignorar movimiento
    if (this._state.wordFound) {
      return;
    }

    // Reducimos el throttle a 16ms (aprox. 60fps) para mayor sensibilidad
    const now = Date.now();
    if (now - this._state.lastEventTime < 16) {
      return;
    }
    this._state.lastEventTime = now;

    const position = this._getPositionFromEvent(e);
    if (!position || position === this._state.lastPosition) return;

    // Actualizar última posición
    this._state.lastPosition = position;

    // Verificar si alguna celda en la selección tiene will-be-unused
    const hasWillBeUnusedCell = this.selection.some((pos) => {
      const cell = document.getElementById(`tile-${pos}`);
      return cell && cell.classList.contains(CSS_CLASSES.WILL_BE_UNUSED);
    });

    if (hasWillBeUnusedCell) {
      this.clearSelection();
      return;
    }

    // Verificar si la celda objetivo será unused
    const targetCell = document.getElementById(`tile-${position}`);
    if (targetCell.classList.contains(CSS_CLASSES.WILL_BE_UNUSED)) {
      return;
    }

    // Para eventos touch, prevenir el desplazamiento
    if (e.type.includes("touch")) {
      e.preventDefault();
    }

    // Actualizar el punto actual y movimiento total de manera más eficiente
    const currentPoint = e.touches
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };

    if (this._state.lastPoint) {
      const dx = currentPoint.x - this._state.lastPoint.x;
      const dy = currentPoint.y - this._state.lastPoint.y;
      this._state.totalMovement += Math.abs(dx) + Math.abs(dy); // Cambio a Manhattan distance para cálculo más rápido
    }
    this._state.lastPoint = currentPoint;

    // Si entramos en la penúltima celda mientras arrastramos
    if (
      this.selection.length > 1 &&
      position === this.selection[this.selection.length - 2]
    ) {
      const lastMark = document.getElementById(
        `mark-${this.selection[this.selection.length - 1]}`
      );
      if (lastMark) lastMark.classList.remove(CSS_CLASSES.SELECTED);
      this.selection.pop();
      this._onSelectionChange?.(this.selection);
      this._updateSelectionLine();
      return;
    }

    // Si la celda es diferente a la última y es adyacente
    if (
      position !== this.selection[this.selection.length - 1] &&
      this._isAdjacent(position) &&
      !this.selection.includes(position)
    ) {
      this._addToSelection(position);
      this._onSelectionChange?.(this.selection);
    }
  }

  _handleEnd() {
    if (!this._state.isDragging) return;

    this._state = {
      isDragging: false,
      startTime: null,
      startPosition: null,
      totalMovement: 0,
      lastPoint: null,
      lastEventTime: Date.now(),
      lastPosition: null, // Resetear la última posición
      wordFound: false, // Resetear el estado de palabra encontrada
    };
  }

  _handleGlobalClick(e) {
    // Solo limpiar la selección si el click fue fuera del juego y no hay animación en curso
    if (!this.selection.length || this.isAnimating) return;

    const isOutsideGame =
      !e.target.closest(".board") &&
      !e.target.closest(".hitbox") &&
      !e.target.closest(".modal-overlay") &&
      !e.target.closest(".menu");

    if (isOutsideGame) {
      this.clearSelection();
    }
  }

  _getPositionFromEvent(e) {
    const point = e.touches?.[0] ?? e;
    if (!point) return null;

    const elements = document.elementsFromPoint(point.clientX, point.clientY);
    const hitbox = elements.find((el) => el.classList.contains("hitbox"));
    if (!hitbox) return null;

    const position = hitbox.dataset.position;
    return /^[a-d][1-4]$/.test(position) ? position : null;
  }

  _isAdjacent(position) {
    console.log("🔍 Verificando adyacencia:", {
      position,
      selectionLength: this.selection.length,
      currentSelection: [...this.selection],
    });

    if (this.selection.length === 0) {
      console.log("✅ Primera selección - siempre permitida");
      return true;
    }

    const last = this.selection[this.selection.length - 1];

    // Si es la misma posición, no es adyacente
    if (position === last) {
      console.log("❌ Misma posición - no adyacente");
      return false;
    }

    // Si es un retroceso, permitirlo
    if (
      this.selection.length > 1 &&
      position === this.selection[this.selection.length - 2]
    ) {
      console.log("↩️ Retroceso permitido");
      return true;
    }

    // No permitir adyacencia con celdas que serán unused
    const lastCell = document.getElementById(`tile-${last}`);
    const targetCell = document.getElementById(`tile-${position}`);
    if (
      lastCell.classList.contains(CSS_CLASSES.WILL_BE_UNUSED) ||
      targetCell.classList.contains(CSS_CLASSES.WILL_BE_UNUSED)
    ) {
      console.log("❌ Celda será unused, no adyacente");
      return false;
    }

    const [rowA, colA] = [last.charCodeAt(0) - 97, parseInt(last[1]) - 1];
    const [rowB, colB] = [
      position.charCodeAt(0) - 97,
      parseInt(position[1]) - 1,
    ];

    const rowDiff = Math.abs(rowA - rowB);
    const colDiff = Math.abs(colA - colB);

    const isAdj = rowDiff <= 1 && colDiff <= 1;
    console.log("📐 Cálculo de adyacencia:", {
      rowDiff,
      colDiff,
      isAdjacent: isAdj,
      from: last,
      to: position,
    });

    return isAdj;
  }

  _addToSelection(position) {
    if (!position) return;

    const mark = document.getElementById(`mark-${position}`);
    if (!mark) return;

    // Caso normal: añadir nueva posición
    this.selection.push(position);
    mark.classList.add(CSS_CLASSES.SELECTED);

    // Emitir evento de actualización de selección
    this.events.emit("SELECTION_UPDATE");

    this._onSelectionChange?.(this.selection);

    // Actualizar líneas de forma segura
    this._updateSelectionLine();
  }

  /**
   * Maneja el evento de cambio de tamaño de la ventana para actualizar las líneas SVG
   * @private
   */
  _handleResize() {
    // Solo actualizar las líneas si hay una selección activa
    if (this.selection.length >= 2) {
      // Usamos requestAnimationFrame para asegurar que las actualizaciones de DOM ya ocurrieron
      requestAnimationFrame(() => {
        this._updateSelectionLine();
      });
    }
  }

  setAnimating(value) {
    if (!value) {
      console.log("🎬 Animación terminada");
      this._pendingWordFound = false;
    }
  }

  destroy() {
    this._removeEventListeners();

    // Desuscribirse de los eventos
    this.events.off(EventService.EVENTS.WORD_FOUND);
    this.events.off(EventService.EVENTS.ANIMATION_START);
    
    // Eliminar el listener de resize
    window.removeEventListener('resize', this._boundHandleResize);

    this.events.destroy();
    this.svg = null;
    this.board = null;
  }
}
