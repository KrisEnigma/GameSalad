// Reglas para la creación de niveles:
// 1. El tablero es una cuadrícula 4x4 (a-d horizontal, 1-4 vertical)
// 2. Cada celda del tablero debe ser utilizada al menos una vez en el nivel
// 3. Las celdas pueden ser reutilizadas por diferentes palabras
// 4. Las letras consecutivas en una palabra deben ser adyacentes en el tablero
//    (horizontal, vertical o diagonal)
// 5. Las coordenadas siguen el formato: letra (a-d) seguida de número (1-4)
//    Ejemplo: "a1" es la esquina superior izquierda

// Definiciones estáticas de niveles
const LEVEL_DEFINITIONS = [
  {
    id: "videogames",
    name: "Video Game Heroes",
    data: {
      SONIC: "a1b1c1d1c2",
      "LARA CROFT": "a3b3c4d3c2d2c3b2a2",
      MARIO: "d4d3c4b4a4",
    },
  },
  {
    id: "chess",
    name: "Chess Pieces",
    data: {
      PAWN: "a1a2a3b3",
      QUEEN: "d4c4b4a4b3",
      KING: "c3c2b3b2",
      KNIGHT: "c3b3c2b2c1d1",
      BISHOP: "d3c2d2c1b1a1",
    },
  },
  {
    id: "planets",
    name: "Solar System",
    data: {
      MARS: "c4b3c3b4",
      MERCURY: "c4d4c3d2c2d1c1",
      NEPTUNE: "a3a2b1b2c2d3d4",
      SATURN: "b4b3b2c2c3d3",
      URANUS: "c2c3b3a3a4b4",
      VENUS: "a1a2a3a4b4",
    },
  },
  {
    id: "street_fighters",
    name: "Street Fighters",
    data: {
      KEN: "a1b2c3",
      ADON: "a4b4c4c3",
      RYU: "c1d1d2",
      "CHUN LI": "b3c2d2c3d3d4",
      AKUMA: "b1a1a2a3a4",
    },
  },
];

// Procesar y exponer los niveles inmediatamente
export const LEVELS = {};
export const LEVEL_ORDER = [];

// Inicializa todos los niveles directamente al cargar el módulo
for (const levelDef of LEVEL_DEFINITIONS) {
  const { id, name, data } = levelDef;
  LEVEL_ORDER.push(id);
  LEVELS[id] = { id, name, data };
}

// Función para obtener un nivel ya procesado
export function getLevel(levelId) {
  if (!LEVELS[levelId]) {
    console.error(`❌ Nivel no encontrado: ${levelId}`);
    return null;
  }
  return LEVELS[levelId];
}
