import sqlite3 from 'sqlite3';
import mysql from 'mysql';

import configServer from '../config-server.mjs';

console.log(configServer); //["mysql"]);

let mysqlConn = mysql.createConnection(configServer["mysql"]);
let sqlite = new sqlite3.Database(configServer["sqlite3"]["filename"]);

var sql = 'select created_ms,x,y,z,voxels from history';
var query = mysqlConn.query(sql);
let i = 0;
query
    .on('error', function(err) {
        // Handle error, an 'end' event will be emitted after this as well
        console.log(err);
    })
    .on('result', function(row) {
        // Pausing the connnection is useful if your processing involves I/O
        mysqlConn.pause();


        sqlite.run(
            'INSERT INTO history (x,y,z,voxels,created_ms) VALUES (?,?,?,?,?)',
            [
                row["x"], // x
                row["y"], // y
                row["z"],
                row["voxels"],
                row["created_ms"]
            ],
            function(error) {
                if (error) {
                    console.log(error)
                    return;
                }
                i++;
                console.log("Inserted " + i);
                mysqlConn.resume();
        });
    })
    .on('end', function() {
        // all rows have been received
        console.log("All done")

        mysqlConn.end();
        sqlite.close();
    });