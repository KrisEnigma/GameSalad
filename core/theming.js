import { S as Storage } from "./storage.js";

class ThemeSelector {
  constructor() {
    this.currentTheme = "dark";
    this._themeGrid = document.querySelector(".theme-grid");
    this._themes = [];
    this._themesLoaded = false;

    document.querySelector(".back-button")?.addEventListener("click", () => {
      document.getElementById("theme-modal")?.classList.remove("active");
      document.getElementById("modal")?.classList.add("active");
    });

    document.getElementById("theme-button")?.addEventListener("click", () => {
      if (!this._themesLoaded) {
        requestIdleCallback(() => this.loadThemesFromCSS());
      }
    });
  }

  loadThemesFromCSS() {
    if (this._themesLoaded) return;

    try {
      const themes = new Set();
      const processSheet = (sheet) => {
        try {
          [...sheet.cssRules]
            .filter((rule) => rule.selectorText?.startsWith("[data-theme="))
            .forEach((rule) => {
              const themeId = rule.selectorText.match(
                /\[data-theme="([^"]+)"\]/
              )?.[1];
              if (themeId && !themes.has(themeId)) {
                const style = rule.style;
                this._themes.push({
                  id: themeId,
                  name:
                    style
                      .getPropertyValue("--theme-name")
                      ?.replace(/['"]/g, "") || themeId,
                  category:
                    style
                      .getPropertyValue("--theme-category")
                      ?.replace(/['"]/g, "") || "basic",
                });
                themes.add(themeId);
              }
            });
        } catch (e) {
          console.debug("Error accediendo stylesheet:", e);
        }
      };

      const sheets = [...document.styleSheets];
      let currentIndex = 0;

      const processNextBatch = () => {
        const endIndex = Math.min(currentIndex + 5, sheets.length);

        for (let i = currentIndex; i < endIndex; i++) {
          processSheet(sheets[i]);
        }

        currentIndex = endIndex;

        if (currentIndex < sheets.length) {
          requestAnimationFrame(processNextBatch);
        } else {
          this._themes.sort((a, b) =>
            a.category === b.category
              ? a.name.localeCompare(b.name)
              : a.category.localeCompare(b.category)
          );
          this._themesLoaded = true;
          this.generateThemeGrid();
        }
      };

      requestAnimationFrame(processNextBatch);
    } catch (e) {
      console.error("Error cargando temas:", e);
    }
  }

  injectBaseStyles() {
    // This is a no-op function to prevent the error
    // The styles are already loaded via <link> tags in index.html
    return Promise.resolve();
  }

  async initialize() {
    try {
      await this.setTheme(await Storage.get(Storage.keys.THEME, "dark"));
      this.generateThemeGrid();
      window.dispatchEvent(new CustomEvent("themes-initialized"));
      return true;
    } catch (error) {
      console.error("❌ Error en inicialización:", error);
      document.documentElement.setAttribute("data-theme", "dark");
      return false;
    }
  }

  generateThemeGrid() {
    if (!this._themeGrid) return;

    const categories = new Map();
    this._themes.forEach((theme) => {
      const themes = categories.get(theme.category) || [];
      themes.push(theme);
      categories.set(theme.category, themes);
    });

    const fragment = document.createDocumentFragment();
    categories.forEach((themes, category) => {
      const header = document.createElement("div");
      header.className = "theme-category";
      header.textContent = category
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      fragment.appendChild(header);

      themes.forEach((theme) =>
        fragment.appendChild(this.createThemeOption(theme.id, theme.name))
      );
    });

    this._themeGrid.innerHTML = "";
    this._themeGrid.appendChild(fragment);
  }

  createThemeOption(themeId, displayName) {
    const option = document.createElement("button");
    option.className = "theme-option";
    option.dataset.theme = themeId;
    option.setAttribute("aria-pressed", themeId === this.currentTheme);
    option.innerHTML = `
      <div class="preview-wrapper${
        themeId === this.currentTheme ? " active" : ""
      }">
        <div class="preview-cell">
          <div class="preview-text">A</div>
          <div class="preview-mark"></div>
        </div>
        <div class="preview-title">${displayName}</div>
      </div>
    `;
    option.addEventListener("click", () => this.setTheme(themeId));
    return option;
  }

  async setTheme(themeName) {
    if (this.currentTheme === themeName) return true;

    try {
      document.documentElement.setAttribute("data-theme", themeName);
      this.currentTheme = themeName;

      this._themeGrid?.querySelectorAll(".theme-option").forEach((option) => {
        const isActive = option.dataset.theme === themeName;
        option.setAttribute("aria-pressed", isActive);
        option
          .querySelector(".preview-wrapper")
          ?.classList.toggle("active", isActive);
      });

      await Storage.setCurrentTheme(themeName);
      window.dispatchEvent(
        new CustomEvent("themechange", { detail: { theme: themeName } })
      );
      return true;
    } catch (error) {
      console.error("❌ Error aplicando tema:", error);
      return false;
    }
  }
}

export { ThemeSelector as T };
