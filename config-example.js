module.exports = {
    chunkSize: 32,
    drawDistance: 2,

    initialPosition: [16.5, 25.5, 16.5],
    worldRadius: 10,
    chunkFolder: 'chunks/test/',
    mysql: {
        connectionLimit: 10,
        user: 'voxeling',
        password: 'voxeling',
        database: 'voxeling',
        host: 'localhost'
    },
    server: 'ws://127.0.0.1:10005',
    httpServer: 'ws://127.0.0.1:10005',
    websocketBindAddress: '127.0.0.1',
    websocketBindPort: 10005,
    maxPlayers: 10,

    voxelRemap: {
        16: 5,
        20: 5
    },
    texturePicker: [
        1, 14, 17, 3,
        2, 4, 13, 19,
        18, 11, 15, 7,
        6, 8, 22, 24,
        100, 27, 34, 32,
        29, 28, 30, 33,
        31, 35, 39, 37,
        38, 21, 36, 5,
        101

    ],
    voxels: {
        1: {
            name: 'grass+dirt',
            /*
            top: 0,
            front: 1,
            left: 2,
            back: 3,
            right: 4,
            bottom: 5
            */
            textures: [
                14,
                302, 302, 302, 302,
                3
            ]
        },
        14: {
            name: 'grass',
            textures: [14, 14, 14, 14, 14, 14]
        },
        17: {
            name: 'grass2',
            textures: [17, 17, 17, 17, 17, 17]
        },
        3: {
            name: 'dirt',
            textures: [3, 3, 3, 3, 3, 3]
        },
        2: {
            name: 'brick',
            src: '/testbdcraft/default_brick.png',
            textures: [2, 2, 2, 2, 2, 2]
        },
        9: {
            name: 'brick2',
            textures: [9, 9, 9, 9, 9, 9],
            hidden: true
        },
        10: {
            name: 'brick3',
            textures: [10, 10, 10, 10, 10, 10],
            hidden: true
        },

        4: {
            name: 'coal',
            textures: [4, 4, 4, 4, 4, 4]
        },
        13: {
            name: 'iron',
            textures: [13, 13, 13, 13, 13, 13]
        },
        19: {
            name: 'clay',
            textures: [19, 19, 19, 19, 19, 19]
        },
        18: {
            name: 'sandstone',
            textures: [18, 18, 18, 18, 18, 18]
        },
        11: {
            name: 'cobble',
            textures: [11, 11, 11, 11, 11, 11]
        },
        12: {
            name: 'cobble2',
            textures: [12, 12, 12, 12, 12, 12],
            hidden: true
        },
        15: {
            name: 'moss cobble',
            textures: [15, 15, 15, 15, 15, 15]
        },

        7: {
            name: 'lava',
            textures: [7, 7, 7, 7, 7, 7]
        },

        6: {
            name: 'water',
            textures: [6, 6, 6, 6, 6, 6]
        },
        16: {
            name: 'ice',
            textures: [16, 16, 16, 16, 16],
            hidden: true
        },
        20: {
            name: 'snow',
            textures: [20, 20, 20, 20, 20, 20],
            hidden: true
        },

        8: {
            name: 'chest',
            textures: [
                300,
                301, 301, 301, 301,
                301
            ]
        },

        22: {
            name: 'wood',
            textures: [22, 22, 22, 22, 22, 22]
        },
        24: {
            name: 'tree',
            textures: [
                303,
                304, 304, 304, 304,
                303
            ]
        },
        100: {
            name: 'leaves',
            textures: [100, 100, 100, 100, 100, 100]
        },

        27: {
            name: 'black wool',
            textures: [27, 27, 27, 27, 27, 27]
        },
        34: {
            name: 'grey wool',
            textures: [34, 34, 34, 34, 34, 34]
        },
        32: {
            name: 'dk grey wool',
            textures: [32, 32, 32, 32, 32, 32]
        },
        29: {
            name: 'brown wool',
            textures: [29, 29, 29, 29, 29, 29]
        },
        28: {
            name: 'blue wool',
            textures: [28, 28, 28, 28, 28, 28]
        },
        30: {
            name: 'cyan wool',
            textures: [30, 30, 30, 30, 30, 30]
        },
        33: {
            name: 'green wool',
            textures: [33, 33, 33, 33, 33, 33]
        },
        31: {
            name: 'dk green wool',
            textures: [31, 31, 31, 31, 31, 31]
        },
        35: {
            name: 'magenta wool',
            textures: [35, 35, 35, 35, 35, 35]
        },
        39: {
            name: 'violet wool',
            textures: [39, 39, 39, 39, 39, 39]
        },
        37: {
            name: 'pink wool',
            textures: [37, 37, 37, 37, 37, 37]
        },
        38: {
            name: 'red wool',
            textures: [38, 38, 38, 38, 38, 38]
        },
        21: {
            name: 'yellow wool',
            textures: [21, 21, 21, 21, 21, 21]
        },
        36: {
            name: 'orange wool',
            textures: [36, 36, 36, 36, 36, 36]
        },
        5: {
            name: 'white wool',
            textures: [5, 5, 5, 5, 5, 5]
        },

        101: {
            name: 'glass',
            textures: [101, 101, 101, 101, 101, 101]
        }
    },

    textures: {
        14: '/testbdcraft/default_grass.png',
        17: '/testbdcraft/default_grass_footsteps.png',
        3: '/testbdcraft/default_dirt.png',
        302: '/testbdcraft/default_grass_side.png',
        2: '/testbdcraft/default_brick.png',
        9: '/testbdcraft/default_brick.png',
        10: '/testbdcraft/default_brick.png',
        4: '/testbdcraft/default_mineral_coal.png',
        13: '/testbdcraft/default_mineral_iron.png',
        19: '/testbdcraft/default_clay.png',
        18: '/testbdcraft/default_sandstone.png',
        11: '/testbdcraft/default_cobble.png',
        12: '/testbdcraft/default_cobble.png',
        15: '/testbdcraft/default_mossycobble.png',
        7: '/testbdcraft/default_lava.png',
        6: '/testbdcraft/default_water.png',
        //16: '/textures/ice.png',
        //20: '/textures/sparkly_snow.png',
        300: '/testbdcraft/default_chest_top.png',
        301: '/testbdcraft/default_chest_side.png',
        22: '/testbdcraft/default_wood.png',
        303: '/testbdcraft/default_tree_top.png',
        304: '/testbdcraft/default_tree.png',
        100: '/testbdcraft/default_leaves.png',
        27: '/testbdcraft/wool_black.png',
        34: '/testbdcraft/wool_grey.png',
        32: '/testbdcraft/wool_dark_grey.png',
        29: '/testbdcraft/wool_brown.png',
        28: '/testbdcraft/wool_blue.png',
        30: '/testbdcraft/wool_cyan.png',
        33: '/testbdcraft/wool_green.png',
        31: '/testbdcraft/wool_dark_green.png',
        35: '/testbdcraft/wool_magenta.png',
        39: '/testbdcraft/wool_violet.png',
        37: '/testbdcraft/wool_pink.png',
        38: '/testbdcraft/wool_red.png',
        21: '/testbdcraft/wool_yellow.png',
        36: '/testbdcraft/wool_orange.png',
        5: '/testbdcraft/wool_white.png',
        101: '/textures/glass.png'
    },
    players: {
        1001: {
            name: 'player',
            src: '/textures/player.png',
            hidden: true
        },
        1002: {
            name: 'substack',
            src: '/textures/substack.png',
            hidden: true
        },
        1003: {
            value: 52,
            name: 'viking',
            src: '/textures/viking.png',
            hidden: true
        }
    }
}
