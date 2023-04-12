export default {
    // TODO: some of these are WIP, related to the "double density" effort
    "chunkWidth": 32, // N units of the coordinate system
    "chunkArraySize": 32768, // 32 * 32 * 32
    "textureUnits": 16, // wonder whether max texture units varies by computer
    "meshedTriangleMaxRowSpan": 32,
    "chunkSize": 32, // number of blocks in a chunk
    "chunkWidthInBlocks": 64, // Chunk is broken into this many blocks in each direction. Should be multiple of chunkSize/chunkWidth
    "blocksPerChunkDirection": 64,
    "blockDensity": 2, // we can calculate this in Coordinates
    "drawDistance": 2,
    "removeDistance": 3,

    "initialPosition": [16.5, 25.5, 16.5], // 16.5, 25.5, 16.5
    "worldRadius": 10, // creates a world that's 20x20x20 chunks
    "maxPlayers": 10,

    "texturePicker": [
        1, 3, 2, 4, 13, 19,
        // sandstone, cobble1, mossy cobble1, cobble2, mossy cobble2, 
        18, 11, 15, 7,
        // water, chest, wood, tree
        6, 8, 22, 24,
        // leaves, colored wools
        100, 27, 34, 32,
        29, 28, 30, 33,
        31, 35, 39, 37,
        38, 21, 36, 5,
        // glass
        101

    ],
    "voxels": {
        "1": {
            "name": "grass+dirt",
            "textures": [
                14,
                302, 302, 302, 302,
                3
            ]
        },
        "2": {
            "name": "brick",
            "textures": [2, 2, 2, 2, 2, 2]
        },
        "3": {
            "name": "dirt",
            "textures": [3, 3, 3, 3, 3, 3]
        },
        "4": {
            "name": "coal",
            "textures": [4, 4, 4, 4, 4, 4]
        },
        "5": {
            "name": "white wool",
            "textures": [5, 5, 5, 5, 5, 5]
        },
        "6": {
            "name": "water",
            "textures": [6, 6, 6, 6, 6, 6]
        },
        "7": {
            "name": "lava",
            "textures": [7, 7, 7, 7, 7, 7]
        },
        "8": {
            "name": "chest",
            "textures": [
                300,
                301, 301, 301, 301,
                301
            ]
        },
        "9": {
            "name": "brick2",
            "textures": [9, 9, 9, 9, 9, 9],
            "hidden": true
        },
        "10": {
            "name": "brick3",
            "textures": [10, 10, 10, 10, 10, 10],
            "hidden": true
        },
        "11": {
            "name": "cobble",
            "textures": [11, 11, 11, 11, 11, 11]
        },
        "12": {
            "name": "cobble2",
            "textures": [12, 12, 12, 12, 12, 12],
            "hidden": true
        },
        "13": {
            "name": "iron",
            "textures": [13, 13, 13, 13, 13, 13]
        },
        "14": {
            "name": "grass",
            "textures": [14, 14, 14, 14, 14, 14]
        },
        "15": {
            "name": "moss cobble",
            "textures": [15, 15, 15, 15, 15, 15]
        },
        "16": {
            "name": "ice",
            "textures": [16, 16, 16, 16, 16],
            "hidden": true
        },
        "17": {
            "name": "grass2",
            "textures": [14, 14, 14, 14, 14, 14]
        },
        "18": {
            "name": "sandstone",
            "textures": [18, 18, 18, 18, 18, 18]
        },
        "19": {
            "name": "clay",
            "textures": [19, 19, 19, 19, 19, 19]
        },
        "20": {
            "name": "snow",
            "textures": [20, 20, 20, 20, 20, 20],
            "hidden": true
        },
        "21": {
            "name": "yellow wool",
            "textures": [21, 21, 21, 21, 21, 21]
        },
        "22": {
            "name": "wood",
            "textures": [22, 22, 22, 22, 22, 22]
        },
        "24": {
            "name": "tree",
            "textures": [
                303,
                304, 304, 304, 304,
                303
            ]
        },
        "27": {
            "name": "black wool",
            "textures": [27, 27, 27, 27, 27, 27]
        },
        "28": {
            "name": "blue wool",
            "textures": [28, 28, 28, 28, 28, 28]
        },
        "29": {
            "name": "brown wool",
            "textures": [29, 29, 29, 29, 29, 29]
        },
        "30": {
            "name": "cyan wool",
            "textures": [30, 30, 30, 30, 30, 30]
        },
        "31": {
            "name": "dk green wool",
            "textures": [31, 31, 31, 31, 31, 31]
        },
        "32": {
            "name": "dk grey wool",
            "textures": [32, 32, 32, 32, 32, 32]
        },
        "33": {
            "name": "green wool",
            "textures": [33, 33, 33, 33, 33, 33]
        },
        "34": {
            "name": "grey wool",
            "textures": [34, 34, 34, 34, 34, 34]
        },
        "35": {
            "name": "magenta wool",
            "textures": [35, 35, 35, 35, 35, 35]
        },
        "36": {
            "name": "orange wool",
            "textures": [36, 36, 36, 36, 36, 36]
        },
        "37": {
            "name": "pink wool",
            "textures": [37, 37, 37, 37, 37, 37]
        },
        "38": {
            "name": "red wool",
            "textures": [38, 38, 38, 38, 38, 38]
        },
        "39": {
            "name": "violet wool",
            "textures": [39, 39, 39, 39, 39, 39]
        },
        "100": {
            "name": "leaves",
            "textures": [100, 100, 100, 100, 100, 100]
        },
        "101": {
            "name": "glass",
            "textures": [101, 101, 101, 101, 101, 101]
        },

        // just for unit testing
        "254": {
            "hidden": true,
            "textures": [
                // top, back, front, left, right, bottom
                2,3,4,5,6,7
            ]
        },
        "255": {
            "hidden": true,
            "textures": [
                // top, back, front, left, right, bottom
                32,33,34,35,36,37
            ]
        }
    },

    "textures": {
        "2": "/textures/voxels/bricks2.png",
        "3": "/textures/voxels/dirtside1.png",
        "4": "/textures/voxels/coal2.png", // "/testbdcraft/default_mineral_coal.png",
        "5": "/textures/voxels/color_white.png", // "/testbdcraft/wool_white.png",
        "6": "/textures/voxels/water.png", // "/testbdcraft/default_water.png",
        "7": "/textures/voxels/lava.png", // "/testbdcraft/default_lava.png",
        "9": "/textures/voxels/bricks2.png",
        "10": "/textures/voxels/bricks2.png",
        "11": "/textures/voxels/cobble.png",
        "12": "/textures/voxels/cobble.png",
        "13": "/textures/voxels/iron2.png", // "/testbdcraft/default_mineral_iron.png"
        "14": "/textures/voxels/grass5top.png",
        "15": "/textures/voxels/mossycobble.png",
        // "17": "/testbdcraft/default_grass_footsteps.png",
        "18": "/textures/voxels/sand.png", // "/testbdcraft/default_sandstone.png",
        "19": "/textures/voxels/clay.png", // "/testbdcraft/default_clay.png",
        "21": "/textures/voxels/color_yellow.png", // "/testbdcraft/wool_yellow.png",
        "22": "/textures/voxels/planks_64x64.png", // "/testbdcraft/default_wood.png",
        "27": "/textures/voxels/color_black.png", // "/testbdcraft/wool_black.png",
        "28": "/textures/voxels/color_darkblue.png", // "/testbdcraft/wool_blue.png",
        "29": "/textures/voxels/color_brown.png", // "/testbdcraft/wool_brown.png",
        "30": "/textures/voxels/color_lightblue.png", // "/testbdcraft/wool_cyan.png",
        "31": "/textures/voxels/color_darkgreen.png", // "/testbdcraft/wool_dark_green.png",
        "32": "/textures/voxels/color_darkgrey.png", // "/testbdcraft/wool_dark_grey.png",
        "33": "/textures/voxels/color_green.png", // "/testbdcraft/wool_green.png",
        "34": "/textures/voxels/color_grey.png", // "/testbdcraft/wool_grey.png",
        "35": "/textures/voxels/color_purple.png", // "/testbdcraft/wool_magenta.png",
        "36": "/textures/voxels/color_orange.png", // "/testbdcraft/wool_orange.png",
        "37": "/textures/voxels/color_pink.png", // "/testbdcraft/wool_pink.png",
        "38": "/textures/voxels/color_red.png", // "/testbdcraft/wool_red.png",
        "39": "/textures/voxels/color_violet.png", // "/testbdcraft/wool_violet.png",
        "100": "/textures/voxels/leaves2.png", // "/testbdcraft/default_leaves.png",
        "101": "/textures/voxels/glass.png",
        "300": "/textures/voxels/chest-top.png", // "/testbdcraft/default_chest_top.png",
        "301": "/textures/voxels/chest-front.png", // "/testbdcraft/default_chest_side.png",
        "302": "/textures/voxels/grass5.png",
        "303": "/textures/voxels/treestump.png", // "/testbdcraft/default_tree_top.png",
        "304": "/textures/voxels/treetrunk.png" // "/testbdcraft/default_tree.png",
    },
    "texturesWithTransparency": {
        "6": true,
        "100": true
    },
    "players": {
        "1001": {
            "name": "player",
            "src": "/textures/voxels/player.png",
            "hidden": true
        },
        "1002": {
            "name": "substack",
            "src": "/textures/voxels/substack.png",
            "hidden": true
        },
        "1003": {
            "value": 52,
            "name": "viking",
            "src": "/textures/voxels/viking.png",
            "hidden": true
        }
    }
}
