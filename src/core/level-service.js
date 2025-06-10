import { LEVEL_ORDER, getLevel } from "./levels.js";
import { EventService } from "./event-service.js";
import { StorageManager } from "./storage.js";

export class LevelService {
  constructor(elements) {
    this.elements = elements;
    this.events = new EventService();
    this.currentLevel = null;
    this.levelNumberElement = this.elements.getElement("levelNumber");
  }

  async initialize() {
    const defaultLevel = LEVEL_ORDER[0];
    const savedLevel = await StorageManager.getCurrentLevel();
    const levelToLoad =
      savedLevel && LEVEL_ORDER.includes(savedLevel)
        ? savedLevel
        : defaultLevel;

    return await this.loadLevel(levelToLoad);
  }

  async loadLevel(levelId) {
    // Get level on demand using the new getLevel function
    const levelData = getLevel(levelId);

    if (!levelData) {
      console.error("ID de nivel inválido:", levelId);
      return null;
    }

    // Clear current state first
    this.currentLevel = null;

    // Set new level state
    this.currentLevel = {
      ...levelData,
      id: levelId,
      name: levelData.name,
      data: levelData.data, // Explicitly include data property
    };

    await StorageManager.setCurrentLevel(levelId);
    this.updateLevelNumber(levelId);

    this.events.emit(EventService.EVENTS.LEVEL_LOADED, {
      levelId,
      levelData: this.currentLevel,
    });

    return this.currentLevel;
  }

  updateLevelNumber(levelId) {
    if (!this.levelNumberElement) {
      this.levelNumberElement = document.querySelector(".level-number");
      if (!this.levelNumberElement) return;
    }

    const levelNumber = LEVEL_ORDER.indexOf(levelId) + 1;
    if (!levelNumber) {
      console.warn("ID de nivel inválido:", levelId);
      return;
    }

    requestAnimationFrame(() => {
      this.levelNumberElement.textContent = `#${levelNumber}`;
      this.levelNumberElement.classList.add("visible");
    });
  }

  getCurrentLevel() {
    return this.currentLevel;
  }

  getLevelData() {
    return this.currentLevel?.data || {};
  }

  isLevelComplete(foundWords) {
    return (
      foundWords.size === Object.keys(this.currentLevel?.data || {}).length
    );
  }

  async saveState() {
    if (this.currentLevel?.id) {
      await StorageManager.setCurrentLevel(this.currentLevel.id);
    }
  }

  async checkState() {
    const savedLevel = await StorageManager.getCurrentLevel();
    if (savedLevel && savedLevel !== this.currentLevel?.id) {
      await this.loadLevel(savedLevel);
    }
  }

  destroy() {
    this.events.destroy();
    this.currentLevel = null;
    this.levelNumberElement = null;
  }
}
