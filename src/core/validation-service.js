export class ValidationService {
  static validateGridPosition(position) {
    if (!position || typeof position !== "string" || position.length !== 2) {
      return false;
    }

    const row = position.charCodeAt(0) - 97;
    const col = parseInt(position[1]) - 1;

    return row >= 0 && row < 4 && col >= 0 && col < 4;
  }

  static validateWord(word, path, grid) {
    if (!word || !path || !grid) return false;

    const letters = word.replace(/\s+/g, "").split("");
    const positions = this.pathToPositions(path);

    if (!positions) return false;

    return letters.every((letter, i) => {
      const pos = positions[i];
      if (!pos) return false;
      const [row, col] = this.positionToGridCoords(pos);
      return grid[row][col] === letter;
    });
  }

  static validateAdjacentPositions(posA, posB) {
    if (!this.validateGridPosition(posA) || !this.validateGridPosition(posB)) {
      return false;
    }

    const [rowA, colA] = this.positionToGridCoords(posA);
    const [rowB, colB] = this.positionToGridCoords(posB);

    return Math.abs(rowA - rowB) <= 1 && Math.abs(colA - colB) <= 1;
  }

  static createGridFromLevel(levelData) {
    const grid = Array(4)
      .fill()
      .map(() => Array(4).fill(""));

    Object.entries(levelData).forEach(([word, path]) => {
      const letters = word.replace(/\s+/g, "").split("");
      const positions = this.pathToPositions(path);

      if (!positions) return;

      letters.forEach((letter, i) => {
        const pos = positions[i];
        if (this.validateGridPosition(pos)) {
          const [row, col] = this.positionToGridCoords(pos);
          if (!grid[row][col]) {
            grid[row][col] = letter;
          }
        }
      });
    });

    return grid;
  }

  static findMatchingWord(selection, levelData, foundWords) {
    // Validaciones iniciales más robustas
    if (!selection?.length) {
      console.log("❌ [ValidationService] findMatchingWord: Selección vacía");
      return false;
    }

    if (!levelData || typeof levelData !== "object") {
      console.log(
        "❌ [ValidationService] findMatchingWord: Datos de nivel inválidos",
        levelData
      );
      return false;
    }

    // Construir el path a partir de la selección actual
    const currentPath = selection.join("");

    // Debug más compacto
    console.log(
      `🔎 [ValidationService] Buscando: "${currentPath}" entre ${
        Object.keys(levelData).length
      } palabras`
    );

    // Búsqueda directa por comparación de paths con logging optimizado
    try {
      const entry = Object.entries(levelData).find(([word, path]) => {
        const match = path === currentPath;
        if (match)
          console.log(
            `✓ [ValidationService] Coincidencia: "${word}" (${path})`
          );
        return match;
      });

      if (!entry) {
        // Loggear solo las primeras palabras para evitar sobrecarga de logs
        const wordSample = Object.entries(levelData)
          .slice(0, 3)
          .map(([word, path]) => `${word}: ${path}`);
        console.log(
          `❌ [ValidationService] No hay coincidencia. Muestra: ${wordSample.join(
            ", "
          )}${Object.keys(levelData).length > 3 ? "..." : ""}`
        );
        return false;
      }

      const [word] = entry;

      // Verificar si la palabra ya fue encontrada
      if (foundWords?.has(word)) {
        console.log(`⚠️ [ValidationService] Palabra ya encontrada: ${word}`);
        return false;
      }

      // Devolver la palabra encontrada
      console.log(`✅ [ValidationService] Palabra válida: ${word}`);
      return word;
    } catch (error) {
      console.error("❌ [ValidationService] Error en búsqueda:", error);
      return false;
    }
  }

  static getUsedLetters(levelData, foundWords) {
    const usedLetters = new Set();

    Object.entries(levelData).forEach(([word, path]) => {
      if (!foundWords.has(word)) {
        for (let i = 0; i < path.length; i += 2) {
          usedLetters.add(path.slice(i, i + 2));
        }
      }
    });

    return usedLetters;
  }

  static validateLevelData(levelData) {
    if (!levelData || typeof levelData !== "object") {
      return false;
    }

    const grid = this.createGridFromLevel(levelData);

    return Object.entries(levelData).every(([word, path]) =>
      this.validateWord(word, path, grid)
    );
  }

  static pathToPositions(path) {
    if (!path) return null;

    const positions = [];
    for (let i = 0; i < path.length; i += 2) {
      const pos = path.slice(i, i + 2);
      if (!this.validateGridPosition(pos)) {
        return null;
      }
      positions.push(pos);
    }
    return positions;
  }

  static positionToGridCoords(position) {
    return [position.charCodeAt(0) - 97, parseInt(position[1]) - 1];
  }

  static gridCoordsToPosition(row, col) {
    return `${String.fromCharCode(97 + row)}${col + 1}`;
  }

  static getAllGridPositions() {
    const positions = [];
    for (let i = 0; i < 16; i++) {
      const row = Math.floor(i / 4);
      const col = i % 4;
      positions.push(this.gridCoordsToPosition(row, col));
    }
    return positions;
  }
}