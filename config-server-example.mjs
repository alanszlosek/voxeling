export default {
    // node http+websocket server will bind to these:
    "httpBindAddress": "0.0.0.0",
    "httpBindPort": 11000,

    // NOTE: SQLITE3 IS THE DEFAULT FOR RUNNING IN DOCKER

    // Default is to store world state in Sqlite3
    "sqlite3": {
        "filename": "/app/database/voxeling.sqlite3"
    },

    
    // IF YOU DON'T WANT SQLITE, COMMENT OUT THE SQLITE BLOCK ABOVE,
    // THEN UNCOMMENT ONE OF THE FOLLOWING BLOCKS

    // TODO: data storage connection strings need to come from
    // envvars so the container platform can specify at run-time
    
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

    // Uncomment to store world state in files
    //"chunkFolder": "/PATH/TO/voxeling/chunks",

}
