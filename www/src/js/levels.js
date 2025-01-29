const LEVEL_DEFINITIONS = [
    {
        id: 'vg_characters',
        name: 'VG Characters',
        data: {
            SONIC: 'a1b1c1d1c2',
            'LARA CROFT': 'a3b3c4d3c2d2c3b2a2',
            MARIO: 'd4d3c4b4a4',
        },
    },
    {
        id: 'chess',
        name: 'Ajedrez',
        data: {
            PAWN: 'a1a2a3b3',
            QUEEN: 'd4c4b4a4b3',
            KING: 'c3c2b3b2',
            KNIGHT: 'c3b3c2b2c1d1',
            BISHOP: 'd3c2d2c1b1a1',
        },
    },
    {
        id: 'planets',
        name: 'Planetas',
        data: {
            MARS: 'c4b3c3b4',
            MERCURY: 'c4d4c3d2c2d1c1',
            NEPTUNE: 'a3a2b1b2c2d3d4',
            SATURN: 'b4b3b2c2c3d3',
            URANUS: 'c2c3b3a3a4b4',
            VENUS: 'a1a2a3a4b4',
        },
    },
];
// Convertir el arreglo a un objeto de niveles
const LEVELS = LEVEL_DEFINITIONS.reduce((acc, { id, name, data }) => {
    acc[id] = { name, data };
    return acc;
}, {});
const LEVEL_ORDER = Object.keys(LEVELS);

export { LEVEL_ORDER as L, LEVELS as a };
