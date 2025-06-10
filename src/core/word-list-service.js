import { EventService } from "./event-service.js";

export class WordListService {
  constructor(elements) {
    console.group("📝 WordListService Constructor");
    this.elements = elements;
    this.events = new EventService();
    this.wordList = this.elements.getElement("wordList");
    this.foundWords = new Set(); // Inicializar foundWords
    console.log("Elemento wordList encontrado:", !!this.wordList);
    console.groupEnd();
    this.resizeObserver = null;
    this.currentLevelData = null;
    this.currentFoundWords = null;
    this.initializeResizeObserver();
  }

  initializeResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.currentLevelData) {
        this.updateWordList(
          this.currentLevelData,
          this.currentFoundWords || new Set()
        );
      }
    });

    if (this.wordList) {
      this.resizeObserver.observe(this.wordList);
    }
  }

  updateWordList(levelData, foundWords) {
    if (!this.wordList || !levelData) {
      console.log("❌ [WordList] No hay elemento wordList o datos de nivel");
      return;
    }

    // Usar siempre un Set limpio si no se proporciona
    const safeFoundWords = foundWords || new Set();

    // Guardar los datos actuales para posibles actualizaciones futuras
    this.currentLevelData = levelData;
    this.currentFoundWords = safeFoundWords;
    this.foundWords = new Set(safeFoundWords); // Sincronizar foundWords con currentFoundWords

    console.log(
      `📝 [WordList] Actualizando lista (${
        Object.keys(levelData).length
      } palabras, ${safeFoundWords.size} encontradas)`
    );

    this.wordList.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const words = Object.keys(levelData).sort((a, b) => a.localeCompare(b));

    const measureElement = this.#createMeasureElement();

    words.forEach((word, index) => {
      fragment.appendChild(
        this.#createWordElement(
          word,
          index,
          safeFoundWords.has(word),
          measureElement
        )
      );
    });
    document.body.removeChild(measureElement);
    this.wordList.appendChild(fragment);
  }

  resetState() {
    console.log("🔄 [WordList] Reseteando estado");
    this.currentLevelData = null;
    this.currentFoundWords = new Set();
    this.foundWords = new Set(); // Reset foundWords también
    if (this.wordList) {
      this.wordList.innerHTML = "";
    }
  }

  getWordElement(word, levelData) {
    if (!levelData || !word) return null;

    const index = Object.keys(levelData)
      .sort((a, b) => a.localeCompare(b))
      .indexOf(word);

    return this.wordList?.querySelector(`[data-index="${index}"]`);
  }

  markWordAsFound(wordElement, word) {
    console.group(`📝 WordListService.markWordAsFound("${word}")`);
    if (!wordElement || !word) {
      console.warn("❌ wordElement o word no válidos");
      console.groupEnd();
      return;
    }

    if (this.foundWords.has(word)) {
      console.log("⚠️ Palabra ya marcada como encontrada");
      console.groupEnd();
      return;
    }

    console.log("1️⃣ Agregando palabra a foundWords");
    this.foundWords.add(word);

    console.log("2️⃣ Agregando clase found al contenedor");
    wordElement.classList.add("found");

    // Dar tiempo a que la transición de color se vea
    requestAnimationFrame(() => {
      console.log("3️⃣ Emitiendo evento WORD_FOUND interno");
      // Calcular si es la última palabra del nivel
      const isLevelComplete =
        this.currentLevelData &&
        this.foundWords.size === Object.keys(this.currentLevelData).length;

      // Usar un evento interno diferente que no dispare vibraciones
      this.events.emit("internal:word-found", {
        word,
        isLevelComplete,
      });
    });

    console.groupEnd();
  }

  // Private methods
  #createMeasureElement() {
    const measureElement = document.createElement("div");
    measureElement.className = "word word-measure";
    measureElement.style.cssText = `
      position: absolute;
      visibility: hidden;
      height: auto;
      width: auto;
      white-space: nowrap;
    `;
    document.body.appendChild(measureElement);
    return measureElement;
  }

  #createWordElement(word, index, isFound, measureElement) {
    const el = document.createElement("div");
    el.className = "word";
    el.setAttribute("data-index", index);

    const span = document.createElement("span");
    measureElement.textContent = word + "M";
    el.style.setProperty(
      "--word-content-width",
      `${measureElement.offsetWidth}px`
    );

    if (isFound) {
      span.textContent = word;
      el.classList.add("found"); // Agregar la clase found al div cuando la palabra ya está encontrada
    } else {
      const lengths = word.split(" ").map((part) => part.length);
      span.innerHTML = `<span class="word-length">${lengths.join(
        " + "
      )}</span>`;
    }

    el.appendChild(span);
    return el;
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.events.destroy();
    this.wordList = null;
    this.currentLevelData = null;
    this.currentFoundWords = null;
  }
}