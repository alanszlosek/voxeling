module.exports = {
    chunkSize: 32,
    drawDistance: 2,
    removeDistance: 3,

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
    websocketBindAddress: '127.0.0.1',
    websocketBindPort: 10005,
    maxPlayers: 10,

    textures: [
        {
            value: 1,
            name: 'grass+dirt',
            sides: [
                14,
                302, 302, 302, 302,
                3
            ]
        },
        {
            value: 14,
            name: 'grass',
            src: '/testbdcraft/default_grass.png'
        },
        {
            value: 17,
            name: 'grass2',
            src: '/testbdcraft/default_grass_footsteps.png'
        },
        {
            value: 3,
            name: 'dirt',
            src: '/testbdcraft/default_dirt.png'
        },
        {
            value: 302,
            name: 'grass_dirt',
            src: '/testbdcraft/default_grass_side.png',
            hidden: true
        },

        {
            value: 2,
            name: 'brick',
            src: '/testbdcraft/default_brick.png'
        },
        {
            value: 9,
            name: 'brick2',
            src: '/testbdcraft/default_brick.png',
            hidden: true
        },
        {
            value: 10,
            name: 'brick3',
            src: '/testbdcraft/default_brick.png',
            hidden: true
        },

        {
            value: 4,
            name: 'coal',
            src: '/testbdcraft/default_mineral_coal.png'
        },
        {
            value: 13,
            name: 'iron',
            src: '/testbdcraft/default_mineral_iron.png'
        },
        {
            value: 19,
            name: 'clay',
            src: '/testbdcraft/default_clay.png'
        },
        {
            value: 18,
            name: 'sandstone',
            src: '/testbdcraft/default_sandstone.png'
        },
        {
            value: 11,
            name: 'cobble',
            src: '/testbdcraft/default_cobble.png'
        },
        {
            value: 12,
            name: 'cobble2',
            src: '/testbdcraft/default_cobble.png',
            hidden: true
        },
        {
            value: 15,
            name: 'moss cobble',
            src: '/testbdcraft/default_mossycobble.png'
        },

        {
            value: 7,
            name: 'lava',
            src: '/testbdcraft/default_lava.png'
        },
        
        {
            value: 6,
            name: 'water',
            src: '/testbdcraft/default_water.png'
        },
        {
            value: 16,
            name: 'ice',
            src: '/textures/ice.png',
            hidden: true
        },
        {
            value: 20,
            name: 'snow',
            src: '/textures/sparkly_snow.png',
            hidden: true
        },

        {
            value: 8,
            name: 'chest',
            sides: [
                300,
                301, 301, 301, 301,
                301
            ]
        },
        {
            value: 300,
            name: 'chest top',
            src: '/testbdcraft/default_chest_top.png',
            hidden: true
        },
        {
            value: 301,
            name: 'chest side',
            src: '/testbdcraft/default_chest_side.png',
            hidden: true
        },
        
        {
            value: 22,
            name: 'wood',
            src: '/testbdcraft/default_wood.png'
        },
        {
            value: 24,
            name: 'tree',
            sides: [
                303,
                304, 304, 304, 304,
                303
            ]
        },
        {
            value: 303,
            name: 'tree_top',
            src: '/testbdcraft/default_tree_top.png',
            hidden: true
        },
        {
            value: 304,
            name: 'tree_side',
            src: '/testbdcraft/default_tree.png',
            hidden: true
        },
        {
            value: 100,
            name: 'leaves',
            src: '/testbdcraft/default_leaves.png'
        },
        {
            value: 305,
            name: 'full-tree',
            src: '/testbdcraft/default_tree.png',
        },

        {
            value: 27,
            name: 'black wool',
            src: '/testbdcraft/wool_black.png'
        },
        {
            value: 34,
            name: 'grey wool',
            src: '/testbdcraft/wool_grey.png'
        },
        {
            value: 32,
            name: 'dk grey wool',
            src: '/testbdcraft/wool_dark_grey.png'
        },
        {
            value: 29,
            name: 'brown wool',
            src: '/testbdcraft/wool_brown.png'
        },
        {
            value: 28,
            name: 'blue wool',
            src: '/testbdcraft/wool_blue.png'
        },
        {
            value: 30,
            name: 'cyan wool',
            src: '/testbdcraft/wool_cyan.png'
        },
        {
            value: 33,
            name: 'green wool',
            src: '/testbdcraft/wool_green.png'
        },
        {
            value: 31,
            name: 'dk green wool',
            src: '/testbdcraft/wool_dark_green.png'
        },
        {
            value: 35,
            name: 'magenta wool',
            src: '/testbdcraft/wool_magenta.png'
        },
        {
            value: 39,
            name: 'violet wool',
            src: '/testbdcraft/wool_violet.png'
        },
        {
            value: 37,
            name: 'pink wool',
            src: '/testbdcraft/wool_pink.png'
        },
        {
            value: 38,
            name: 'red wool',
            src: '/testbdcraft/wool_red.png'
        },
        {
            value: 21,
            name: 'yellow wool',
            src: '/testbdcraft/wool_yellow.png'
        },
        {
            value: 36,
            name: 'orange wool',
            src: '/testbdcraft/wool_orange.png'
        },
        {
            value: 5,
            name: 'white wool',
            src: '/testbdcraft/wool_white.png'
        },

        {
            value: 101,
            name: 'glass',
            src: '/textures/glass.png'
        },

        {
            value: 50,
            name: 'player',
            src: '/textures/player.png',
            hidden: true
        },
        {
            value: 51,
            name: 'substack',
            src: '/textures/substack.png',
            hidden: true
        },
        {
            value: 52,
            name: 'viking',
            src: '/textures/viking.png',
            hidden: true
        }
        
    ]
}
