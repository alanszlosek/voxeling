var fs = require('fs');
var mysql = require('mysql');
var zlib = require('zlib');
var config = require('../config');

var mysqlPool = mysql.createPool(config.mysql);
var folderPath = '../chunks/coders';

fs.readdir(folderPath, function(error, files) {

    var batch = function() {
        for (var i = 0; i < 5; i++) {
            if (files.length > 0) {
                closure(files.pop());
            }
        }
        if (files.length > 0) {
            setTimeout(batch, 100);
        }
        
    };

    var closure = function(filename) {
        fs.readFile(folderPath + '/' + filename, function(err, data) {
            if (err) {
                console.log('failed to read file ' + filename);
                return;
            }
            var position = filename.replace(/n/g, '-').split('.').map(function(value) {
                return Number(value);
            });

            zlib.gzip(data, function(error, buffer) {
                if (error) {
                    console.log('Error compressing voxels', error);
                    return;
                }
                mysqlPool.query(
                    'REPLACE INTO chunk SET ?',
                    {
                        x: position[0],
                        y: position[1],
                        z: position[2],
                        voxels: buffer,
                        updated_ms: Date.now()
                    },
                    function(error) {
                        if (error) {
                            console.log('MysqlChunkStore::saveVoxels', error);
                        }
                    }
                );
            });
        });
    };

    batch();
});
