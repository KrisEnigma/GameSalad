import fs from 'fs/promises';
import path from 'path';

// Configuración de rutas
const CSS_DIR = './www/public/styles';
const OUTPUT_FILE = './www/src/js/styles.js';

async function processCSS(cssContent) {
    // Eliminar saltos de línea innecesarios pero mantener la estructura
    return cssContent
        .replace(/^\s*$(?:\r\n?|\n)/gm, '')
        .replace(/\s+$/gm, '');
}

async function convertCSStoJS() {
    try {
        // Leer el CSS base
        const baseCSS = await fs.readFile(
            path.join(CSS_DIR, 'styles.css'), 
            'utf8'
        );

        // Leer y procesar temas
        const themesDir = path.join(CSS_DIR, 'themes');
        const categories = await fs.readdir(themesDir);

        let allCSS = await processCSS(baseCSS);
        
        // Procesar cada categoría y sus temas
        for (const category of categories) {
            const categoryPath = path.join(themesDir, category);
            const stat = await fs.stat(categoryPath);
            
            if (stat.isDirectory()) {
                const themes = await fs.readdir(categoryPath);
                for (const theme of themes) {
                    if (theme.endsWith('.css')) {
                        const themeCSS = await fs.readFile(
                            path.join(categoryPath, theme), 
                            'utf8'
                        );
                        allCSS += '\n\n' + await processCSS(themeCSS);
                    }
                }
            }
        }

        // Generar el archivo JS
        const jsContent = `// filepath: ${OUTPUT_FILE}
const css = \`${allCSS}\`;

export default css;
`;

        // Escribir el archivo
        await fs.writeFile(OUTPUT_FILE, jsContent, 'utf8');
        console.log('✅ CSS convertido exitosamente a JS');

    } catch (error) {
        console.error('❌ Error en la conversión:', error);
    }
}

// Ejecutar la conversión
convertCSStoJS();
