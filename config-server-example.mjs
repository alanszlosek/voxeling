export default {
    // node http+websocket server will bind to these:
    "httpBindAddress": "127.0.0.1",
    "httpBindPort": 10005,

    "chunkFolder": "chunks/test/",
    // Uncomment if using mysql to store world chunks
    /*
    mysql: {
        connectionLimit: 10,
        user: 'voxeling',
        password: 'voxeling',
        database: 'voxeling',
        host: 'localhost'
    },
    */
    // Uncomment if using mongo to store world chunks
    /*
    "mongo": {
        "uri": "mongodb://192.168.1.100",
        "database": "voxeling"
    }
    */
}
