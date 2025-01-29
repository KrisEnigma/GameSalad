import fs from 'fs/promises';
import path from 'path';
import postcss from 'postcss';
import lodash from 'lodash';
const { kebabCase } = lodash;

// Configurar rutas base
const BASE_PATH = './www/public';
const STYLES_PATH = path.join(BASE_PATH, 'styles');
const THEMES_PATH = path.join(STYLES_PATH, 'themes');

// Función principal para convertir CSS a JS
async function convertThemesToJS(themes, baseCssContent) {
    const themeJS = {};

    // Procesar el CSS base primero
    const baseStyles = await processCSS(baseCssContent);
    themeJS.base = baseStyles;

    // Procesar cada tema
    for (const category in themes.categories) {
        themeJS[category] = {};

        for (const theme of themes.categories[category].themes) {
            const themeName = theme.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cssFilePath = path.join(THEMES_PATH, category, theme.file);

            try {
                const cssContent = await fs.readFile(cssFilePath, 'utf8');
                const themeStyles = await processCSS(cssContent);
                themeJS[category][themeName] = themeStyles;
            } catch (err) {
                console.error(`Error processing ${theme.name}: ${err.message}`);
            }
        }
    }

    return themeJS;
}

// Procesar un archivo CSS y convertirlo a objeto JS
async function processCSS(css) {
    const result = {};

    try {
        const ast = await postcss.parse(css);

        ast.walkRules(rule => {
            // Manejar reglas @import
            if (rule.type === 'atrule' && rule.name === 'import') {
                if (!result.imports) result.imports = [];
                result.imports.push(rule.params.replace(/['"]/g, ''));
                return;
            }

            // Procesar reglas normales
            const selector = rule.selector;
            if (!result[selector]) result[selector] = {};

            rule.walkDecls(decl => {
                // Convertir nombres de variables CSS a kebab-case
                const prop = decl.prop.startsWith('--') ? decl.prop : kebabCase(decl.prop);
                const value = decl.value;

                if (!result[selector][prop]) {
                    result[selector][prop] = value;
                }
            });
        });

        // Procesar @keyframes
        ast.walkAtRules('keyframes', rule => {
            if (!result.keyframes) result.keyframes = {};

            const keyframeName = rule.params;
            result.keyframes[keyframeName] = {};

            rule.walkRules(keyframeRule => {
                result.keyframes[keyframeName][keyframeRule.selector] = {};

                keyframeRule.walkDecls(decl => {
                    const prop = kebabCase(decl.prop);
                    result.keyframes[keyframeName][keyframeRule.selector][prop] = decl.value;
                });
            });
        });

    } catch (err) {
        console.error('Error parsing CSS:', err);
    }

    return result;
}

// Función para escribir el resultado en un archivo JS
async function writeThemesToFile(themes, outputPath) {
    const content = `
// Autogenerado por CSS to JS Theme Converter
const themes = ${JSON.stringify(themes, null, 2)};

export default themes;
`;

    await fs.writeFile(outputPath, content, 'utf8');
}

// Función principal
async function main() {
    try {
        // Leer el CSS base
        const baseCss = await fs.readFile(path.join(STYLES_PATH, 'styles.css'), 'utf8');

        // Leer la configuración de temas
        const themesConfig = await import('./www/src/js/themes.js');

        // Convertir todos los temas
        const convertedThemes = await convertThemesToJS(themesConfig.default, baseCss);

        // Escribir el resultado en la carpeta src/js
        const outputPath = path.join('./www/src/js', 'themes.converted.js');
        await writeThemesToFile(convertedThemes, outputPath);

        console.log('Conversión completada exitosamente');
    } catch (err) {
        console.error('Error en la conversión:', err);
    }
}

main();