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
            name: 'ground',
            sides: [
                14,
                23, 23, 23, 23,
                3
            ]
        },
        {
            value: 2,
            name: 'brick',
            src: 'http://g.tenten.us/textures/brick.png'
        },
        {
            value: 3,
            name: 'dirt',
            src: 'http://g.tenten.us/textures/dirt.png'
        },
        {
            value: 4,
            name: 'obsidian',
            src: 'http://g.tenten.us/textures/obsidian.png'
        },
        {
            value: 5,
            name: 'whitewool',
            src: 'http://g.tenten.us/textures/whitewool.png'
        },
        {
            value: 6,
            name: 'water',
            src: 'http://g.tenten.us/textures/water.png'
        },
        {
            value: 7,
            name: 'lava',
            src: 'http://g.tenten.us/textures/lava.png'
        },
        {
            value: 8,
            name: 'crate',
            src: 'http://g.tenten.us/textures/crate.png'
        },
        {
            value: 9,
            name: 'brick2',
            src: 'http://g.tenten.us/textures/brick2.png'
        },
        {
            value: 10,
            name: 'brick3',
            src: 'http://g.tenten.us/textures/brick3.png'
        },
        {
            value: 11,
            name: 'cobblestone',
            src: 'http://g.tenten.us/textures/cobblestone.png'
        },
        {
            value: 12,
            name: 'cobblestone2',
            src: 'http://g.tenten.us/textures/cobblestone2.png'
        },
        {
            value: 13,
            name: 'granite',
            src: 'http://g.tenten.us/textures/granite.png'
        },
        {
            value: 14,
            name: 'grass',
            src: 'http://g.tenten.us/textures/grass.png'
        },
        {
            value: 15,
            name: 'grassy cobblestone',
            src: 'http://g.tenten.us/textures/grassy_cobblestone.png'
        },
        {
            value: 16,
            name: 'ice',
            src: 'http://g.tenten.us/textures/ice.png'
        },
        {
            value: 17,
            name: 'long grass',
            src: 'http://g.tenten.us/textures/long_grass.png'
        },
        {
            value: 18,
            name: 'sandstone',
            src: 'http://g.tenten.us/textures/sandstone.png'
        },
        {
            value: 19,
            name: 'slate',
            src: 'http://g.tenten.us/textures/slate.png'
        },
        {
            value: 20,
            name: 'snow2',
            src: 'http://g.tenten.us/textures/sparkly_snow.png'
        },
        {
            value: 21,
            name: 'straw',
            src: 'http://g.tenten.us/textures/straw.png'
        },
        {
            value: 22,
            name: 'wood',
            src: 'http://g.tenten.us/textures/woodsiding.png'
        },
        {
            value: 23,
            name: 'grass+dirt',
            src: 'http://g.tenten.us/textures/grass_dirt.png'
        },

        {
            value: 100,
            name: 'leaves',
            src: '/textures/leaves_oak.png'
        }
    ]
}