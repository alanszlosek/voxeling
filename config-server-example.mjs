export default {
    // node http+websocket server will bind to these:
    "httpBindAddress": "0.0.0.0",
    "httpBindPort": 11000,

    "chunkFolder": "chunks/test/",

    // UNCOMMENT ONLY ONE OF THE FOLLOWING BLOCKS

    // Uncomment to store world state in MySQL
    /*
    mysql: {
        connectionLimit: 10,
        user: 'voxeling',
        password: 'voxeling',
        database: 'voxeling',
        host: 'localhost'
    },
    */
    // Uncomment to store world state in MongoDB
    /*
    "mongo": {
        "uri": "mongodb://192.168.1.100",
        "database": "voxeling"
    }
    */
    // Uncomment to store world state in Sqlite3
    /*
    "sqlite3": {
        "filename": "/path/to/sqlite3/database"
    }
    */
}
