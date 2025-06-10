import { StorageManager } from "./storage.js";
import { EventService } from "./event-service.js";

export class ThemeService {
  constructor() {
    this.events = new EventService();
    this.initialized = false;
    this.currentTheme = "dark";
    this.availableThemes = new Map();
    this._themeGrid = document.querySelector(".theme-grid");
    this._activeTheme = null;
    this._themeChanging = false;
    this.loadThemeData();
  }

  loadThemeData() {
    this.themesData = this.#extractThemesFromCSS();
    if (!this.themesData?.categories) {
      console.error("❌ No theme data found");
      return;
    }
    this.#processThemeData();
    this.#generateThemeGrid();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const savedTheme = await StorageManager.getCurrentTheme();
      document.documentElement.dataset.theme = savedTheme;
      this.initialized = true;
      console.log("✅ ThemeService inicializado");
    } catch (error) {
      console.error("❌ Error:", error);
      document.documentElement.setAttribute("data-theme", "dark");
      throw error;
    }
  }

  async setTheme(themeName) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this._themeChanging || this._activeTheme === themeName) return true;

    try {
      this._themeChanging = true;
      await document.fonts.ready;
      document.documentElement.setAttribute("data-theme", themeName);
      this._activeTheme = themeName;
      await StorageManager.setCurrentTheme(themeName);
      this.events.emit(EventService.EVENTS.THEME_CHANGE, { theme: themeName });
      return true;
    } catch (error) {
      console.error("❌ Error applying theme:", error);
      return false;
    } finally {
      this._themeChanging = false;
    }
  }

  getCurrentTheme() {
    return document.documentElement.dataset.theme;
  }

  #extractThemesFromCSS() {
    const themesData = { categories: {} };

    try {
      // Check all stylesheets for theme data
      [...document.styleSheets].forEach((sheet) => {
        try {
          [...sheet.cssRules].forEach((rule) => {
            if (rule.type !== CSSRule.STYLE_RULE) return;

            const themeMatch = rule.selectorText?.match(
              /\[data-theme="([^"]+)"\]/
            );
            if (!themeMatch) return;

            const themeName = themeMatch[1];
            const cssText = rule.cssText;
            const name = cssText.match(/--theme-name:\s*["']([^"']+)["']/)?.[1];
            const category = cssText.match(
              /--theme-category:\s*["']([^"']+)["']/
            )?.[1];

            if (name && category) {
              if (!themesData.categories[category]) {
                themesData.categories[category] = { themes: [] };
              }
              themesData.categories[category].themes.push({
                name,
                file: themeName,
              });
            }
          });
        } catch (error) {
          // Skip stylesheets that can't be accessed due to CORS
          console.debug("Skipping stylesheet:", error);
        }
      });

      Object.values(themesData.categories).forEach((category) => {
        category.themes.sort((a, b) => a.name.localeCompare(b.name));
      });
    } catch (error) {
      console.error("Error extracting themes:", error);
    }

    return themesData;
  }

  #processThemeData() {
    this.availableThemes.clear();
    Object.values(this.themesData.categories).forEach(({ themes }) => {
      themes.forEach((theme) => {
        this.availableThemes.set(theme.file.replace(".css", ""), theme.name);
      });
    });
  }

  #generateThemeGrid() {
    if (!this._themeGrid) return;

    this._themeGrid.innerHTML = "";
    Object.entries(this.themesData.categories).forEach(([category, data]) => {
      this.#createCategorySection(category, data.themes);
    });
  }

  #createCategorySection(category, themes) {
    const header = document.createElement("div");
    header.className = "theme-category";
    header.textContent = category
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    this._themeGrid.appendChild(header);
    themes.forEach((theme) => {
      const themeName = theme.file.replace(".css", "");
      this._themeGrid.appendChild(
        this.#createThemeOption(themeName, theme.name)
      );
    });
  }

  #createThemeOption(themeName, displayName) {
    const option = document.createElement("button");
    option.className = "theme-option";
    option.dataset.theme = themeName;
    option.innerHTML = `
      <div class="preview-wrapper">
        <div class="preview-cell">
          <div class="preview-text">A</div>
          <div class="preview-mark"></div>
        </div>
        <div class="preview-title">${displayName}</div>
      </div>
    `;
    option.addEventListener("click", () => this.setTheme(themeName));
    return option;
  }

  destroy() {
    this._themeGrid = null;
    this.events.destroy();
    this.availableThemes.clear();
    this.initialized = false;
  }
}

export { ThemeService as T };
