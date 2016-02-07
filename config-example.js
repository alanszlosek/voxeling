module.exports = {
    chunkSize: 32,
    horizontalDistance: 2,
    verticalDistance: 2,
    horizontalRemoveDistance: 3,
    verticalRemoveDistance: 3,
    chunkCache: {},

    initialPosition: [16.5, 25.5, 16.5],
    chunkFolder: './chunks/test/',
    server: 'ws://127.0.0.1:10005',

    textures: [
        {
            value: 1,
            name: 'grass+dirt',
            sides: [
                14,
                23, 23, 23, 23,
                3
            ]
        },
        {
            value: 14,
            name: 'grass',
            src: '/textures/grass.png'
        },
        {
            value: 17,
            name: 'long grass',
            src: '/textures/long_grass.png'
        },
        {
            value: 3,
            name: 'dirt',
            src: '/textures/dirt.png'
        },
        {
            value: 23,
            name: 'grass_dirt',
            src: '/textures/grass_dirt.png',
            hidden: true
        },

        {
            value: 2,
            name: 'brick',
            src: '/textures/brick.png'
        },
        {
            value: 9,
            name: 'brick2',
            src: '/textures/brick2.png'
        },
        {
            value: 10,
            name: 'brick3',
            src: '/textures/brick3.png'
        },

        {
            value: 4,
            name: 'obsidian',
            src: '/textures/obsidian.png'
        },
        {
            value: 13,
            name: 'granite',
            src: '/textures/granite.png'
        },
        {
            value: 19,
            name: 'slate',
            src: '/textures/slate.png'
        },
        {
            value: 18,
            name: 'sandstone',
            src: '/textures/sandstone.png'
        },
        {
            value: 11,
            name: 'cobblestone',
            src: '/textures/cobblestone.png'
        },
        {
            value: 12,
            name: 'cobblestone2',
            src: '/textures/cobblestone2.png'
        },
        {
            value: 15,
            name: 'grassy cobblestone',
            src: '/textures/grassy_cobblestone.png'
        },

        {
            value: 7,
            name: 'lava',
            src: '/textures/lava.png'
        },
        
        {
            value: 6,
            name: 'water',
            src: '/textures/water.png'
        },
        {
            value: 16,
            name: 'ice',
            src: '/textures/ice.png'
        },
        {
            value: 20,
            name: 'snow',
            src: '/textures/sparkly_snow.png'
        },
        {
            value: 5,
            name: 'whitewool',
            src: '/textures/whitewool.png'
        },

        {
            value: 8,
            name: 'crate',
            src: '/textures/crate.png'
        },
        
        {
            value: 21,
            name: 'straw',
            src: '/textures/straw.png'
        },
        {
            value: 22,
            name: 'wood',
            src: '/textures/woodsiding.png'
        },
        
        {
            value: 100,
            name: 'leaves',
            src: '/textures/leaves_oak.png'
        }
    ]
}