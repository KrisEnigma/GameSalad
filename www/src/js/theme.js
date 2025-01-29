import { Capacitor } from '@capacitor/core';
import { S as Storage } from './store.js';
import css from './styles.js';
import themes from './themes.js';  // Agregar esta importación

class ThemeSelector {
    constructor() {
        this.currentTheme = 'dark';
        this.themesData = themes;  // Guardar referencia a los temas
        this.availableThemes = new Map();
        this.categoryOrder = [];
        this.loadedStylesheets = new Set();
        this.loadedFonts = new Set();
        this.singleWordTerms = new Set(['pac-man']);
        this._styleCache = new Map();
        this._previewStyles = new Map();
        this._themeLoadPromise = null;
        this._activeTheme = null;
        this._pendingThemeLoad = null;
        this._activeStyleElement = null;

        // Ya no inyectar los estilos en el constructor
        this._styleElement = document.createElement('style');
        this._themesStyleElement = document.createElement('style');
        this._themesStyleElement.id = 'theme-styles';
        this.loadThemeData();

        this.themeGrid = document.querySelector('.theme-grid');
    }

    loadThemeData() {
        if (!this.themesData?.categories) {
            console.error('❌ No se encontraron datos de temas');
            return;
        }

        // Limpiar datos previos
        this.categoryOrder = [];
        this.availableThemes.clear();

        Object.entries(this.themesData.categories).forEach(([category, data]) => {
            this.categoryOrder.push(category);
            data.themes.forEach(theme => {
                this.availableThemes.set(theme.file.replace('.css', ''), theme.name);
            });
        });

        // Generar el grid después de cargar los datos
        this.generateThemeGrid();

        console.log('✅ Temas cargados:', {
            categorías: this.categoryOrder,
            temas: Array.from(this.availableThemes.entries())
        });
    }

    generateThemeGrid() {
        if (!this.themeGrid) {
            console.error('❌ Elemento theme-grid no encontrado');
            return;
        }

        this.themeGrid.innerHTML = '';
        
        Object.entries(this.themesData.categories).forEach(([category, data]) => {
            // Convertir nombre de categoría a formato legible
            const displayName = category.split('-').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');

            // Agregar encabezado de categoría
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'theme-category';
            categoryHeader.textContent = displayName;
            this.themeGrid.appendChild(categoryHeader);

            // Agregar temas de la categoría
            data.themes.forEach(theme => {
                const themeName = theme.file.replace('.css', '');
                const option = document.createElement('button');
                option.className = 'theme-option';
                option.dataset.theme = themeName;

                const wrapper = document.createElement('div');
                wrapper.className = 'preview-wrapper';

                const previewCell = document.createElement('div');
                previewCell.className = 'preview-cell';
                
                // Agregar texto de muestra
                const previewText = document.createElement('div');
                previewText.className = 'preview-text';
                previewText.textContent = 'A';
                previewCell.appendChild(previewText);
                
                const previewMark = document.createElement('div');
                previewMark.className = 'preview-mark';
                previewCell.appendChild(previewMark);

                const previewTitle = document.createElement('div');
                previewTitle.className = 'preview-title';
                previewTitle.textContent = theme.name;

                wrapper.appendChild(previewCell);
                wrapper.appendChild(previewTitle);
                option.appendChild(wrapper);

                // Agregar event listener
                option.addEventListener('click', () => this.setTheme(themeName));

                this.themeGrid.appendChild(option);
            });
        });
    }

    async injectBaseStyles() {
        console.log('💉 Inyectando estilos base...');
        
        // 1. Inyectar estilos base primero
        this._styleElement.textContent = css;
        document.head.appendChild(this._styleElement);
        
        // 2. Asegurarnos de que los temas estén cargados
        this.loadThemeData();
        
        // 3. Inyectar estilos de temas
        if (!this._themesStyleElement) {
            this._themesStyleElement = document.createElement('style');
            this._themesStyleElement.id = 'theme-styles';
        }
        this._themesStyleElement.textContent = this.getThemeStyles();
        document.head.appendChild(this._themesStyleElement);
        
        // 4. Esperar a que se procesen los estilos
        await new Promise(resolve => {
            requestAnimationFrame(() => setTimeout(resolve, 100));
        });
    }

    getThemeStyles() {
        if (!this.themesData?.categories) {
            console.error('❌ No hay datos de temas');
            return '';
        }

        const styles = [];
        Object.values(this.themesData.categories).forEach(category => {
            category.themes.forEach(theme => {
                const themeName = theme.file.replace('.css', '');
                const themeStyles = this.findThemeStylesInCss(themeName);
                if (themeStyles) {
                    styles.push(themeStyles);
                }
            });
        });

        return styles.join('\n\n');
    }

    findThemeStylesInCss(themeName) {
        // Buscar la sección del tema en el CSS
        const startMarker = `[data-theme='${themeName}']`;
        const cssContent = css;
        
        let startIndex = cssContent.indexOf(startMarker);
        if (startIndex === -1) return null;

        // Encontrar el bloque completo del tema
        let braceCount = 0;
        let endIndex = startIndex;
        let inBlock = false;

        for (let i = startIndex; i < cssContent.length; i++) {
            const char = cssContent[i];
            if (char === '{') {
                braceCount++;
                inBlock = true;
            } else if (char === '}') {
                braceCount--;
            }

            if (inBlock && braceCount === 0) {
                endIndex = i + 1;
                break;
            }
        }

        return cssContent.substring(startIndex, endIndex);
    }

    async initialize() {
        console.group('[ThemeSelector] Inicializando');
        try {
            const savedTheme = await Storage.get(Storage.KEYS.THEME, 'dark');
            console.log('Tema guardado:', savedTheme);
            
            this._pendingTheme = savedTheme;
            
            // Cargar datos y generar grid
            this.loadThemeData();
            
            console.log('✅ ThemeSelector preparado');
            return true;
        } catch (error) {
            console.error('❌ Error:', error);
            document.documentElement.setAttribute('data-theme', 'dark');
            return false;
        } finally {
            console.groupEnd();
        }
    }

    // Nuevo método para aplicar el tema pendiente
    async applyPendingTheme() {
        if (!this._pendingTheme) return;

        console.log('🎨 Aplicando tema:', this._pendingTheme);
        
        try {
            // 1. Cargar fuentes
            await this.loadFontsForTheme(this._pendingTheme);
            
            // 2. Aplicar tema
            document.documentElement.setAttribute('data-theme', this._pendingTheme);
            this._activeTheme = this._pendingTheme;

            // 3. Esperar fuentes y dar tiempo extra
            await document.fonts.ready;
            await new Promise(resolve => setTimeout(resolve, 100));

            this._pendingTheme = null;
            console.log('✅ Tema aplicado');
        } catch (error) {
            console.error('❌ Error aplicando tema:', error);
        }
    }

    async parseFonts(css) {
        const fontRegex = /@import url\(['"]([^'"]+)['"]\);/g;
        const fonts = new Set();
        let match;
        
        while ((match = fontRegex.exec(css)) !== null) {
            fonts.add(match[1]);
        }

        return Array.from(fonts);
    }

    async loadFontsForTheme(themeName) {
        try {
            // Extraer todas las fuentes del CSS
            const fonts = await this.parseFonts(css);
            
            // Crear los elementos link para cada fuente
            const links = fonts.map(fontUrl => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = fontUrl;
                return link;
            });

            // Esperar a que todas las fuentes se carguen
            await Promise.all(
                links.map(link => {
                    return new Promise((resolve, reject) => {
                        link.onload = () => resolve();
                        link.onerror = () => reject();
                        document.head.appendChild(link);
                    });
                })
            );

            await document.fonts.ready;
            console.log('✅ Fuentes cargadas para el tema:', themeName);
        } catch (error) {
            console.error('❌ Error cargando fuentes:', error);
        }
    }

    async preloadFontsForTheme(themeName) {
        try {
            console.log('🔤 Precargando fuentes para:', themeName);
            const fonts = await this.parseFonts(css);
            
            // Cargar fuentes directamente sin preload
            const links = fonts.map(fontUrl => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';  // Usar stylesheet en vez de preload
                link.href = fontUrl;
                return link;
            });

            // Agregar links y esperar a que carguen
            await Promise.all(
                links.map(link => new Promise((resolve) => {
                    link.onload = resolve;
                    link.onerror = resolve; // No bloquear en error
                    document.head.appendChild(link);
                }))
            );

            // Esperar a que las fuentes estén listas
            await document.fonts.ready;
            console.log('✅ Fuentes cargadas');
        } catch (error) {
            console.error('❌ Error cargando fuentes:', error);
        }
    }

    async setTheme(themeName) {
        if (this._activeTheme === themeName) return true;

        try {
            console.group('🎨 Cambiando tema a:', themeName);
            
            // 1. Cargar fuentes primero
            await this.loadFontsForTheme(themeName);
            
            // 2. Actualizar atributo data-theme
            document.documentElement.setAttribute('data-theme', themeName);
            this._activeTheme = themeName;
            
            // 3. Esperar fuentes
            await document.fonts.ready;
            
            // 4. Guardar tema
            await Storage.setCurrentTheme(themeName);
            
            // 5. Notificar cambio
            window.dispatchEvent(new CustomEvent('themechange', {
                detail: { theme: themeName }
            }));

            console.log('✅ Tema aplicado');
            console.groupEnd();
            return true;
        } catch (error) {
            console.error('❌ Error aplicando tema:', error);
            console.groupEnd();
            return false;
        }
    }
}

export { ThemeSelector as T };
