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
            textures: [14, 14, 14, 14, 14, 14]
        },
        3: {
            name: 'dirt',
            textures: [3, 3, 3, 3, 3, 3]
        },
        2: {
            name: 'brick',
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
        "2": "/textures/bricks2.png",
        "3": "/textures/dirtside1.png",
        "4": "/textures/coal2.png",
        "5": "/textures/color_beige2.png",
        "6": "/textures/water.png",
        "7": "/textures/lava.png",
        "9": "/textures/bricks2.png",
        "10": "/textures/bricks2.png",
        "11": "/textures/cobble.png",
        "12": "/textures/cobble.png",
        "13": "/textures/iron2.png",
        "14": "/textures/grass5top.png",
        "15": "/textures/mossycobble.png",
        "18": "/textures/sand.png",
        "19": "/textures/clay.png",
        "21": "/textures/color_yellow.png",
        "22": "/textures/planks_64x64.png",
        "27": "/textures/color_black.png",
        "28": "/textures/color_blue.png",
        "29": "/textures/color_brown.png",
        "30": "/textures/color_cyan.png",
        "31": "/textures/color_darkgreen.png",
        "32": "/textures/color_darkgrey.png",
        "33": "/textures/color_green.png",
        "34": "/textures/color_grey.png",
        "35": "/textures/color_violet.png",
        "36": "/textures/color_orange.png",
        "37": "/textures/color_pink.png",
        "38": "/textures/color_red.png",
        "39": "/textures/color_violet.png",
        "100": "/textures/leaves2.png",
        "101": "/textures/glass.png",
        "300": "/textures/chest-top.png",
        "301": "/textures/chest-front.png",
        "302": "/textures/grass5.png",
        "303": "/textures/treestump.png",
        "304": "/textures/treetrunk.png"
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
