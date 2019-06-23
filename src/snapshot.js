var mysql = require('mysql');
var config = require('../config');

var db = mysql.createPool(config.mysql);

var sql = 'select created_ms from history order by updated_ms DESC limit 1';
db.query(sql, function(error, results) {
    var lastBackup;
    var newTimestamp = Date.now();
    if (error) {
        callback('Error getting latest snapshot from MySQL: ' + error);
        db.end();
        return;
    }
    if (results.length == 0) {
        // Fetch them all
        lastBackup = 0;
    } else {
        lastBackup = results[0].created_ms;
    }

    var sql = 'select x,y,z,voxels from chunk where updated_ms > ?';
    db.query(sql, [lastBackup], function(error, chunks) {
        if (error) {
            callback('Error getting chunks from MySQL: ' + error);
            return;
        }
        if (chunks.length == 0) {
            console.log(newTimestamp + ': No chunk changes to snapshot');
            db.end();
            return;
        } else {
            console.log(newTimestamp + ': Snapshotting');
        }

        var placeholder = '(?,?,?,?,?),';
        var sql = 'INSERT INTO `history` (`x`, `y`, `z`, `voxels`, `created_ms`) VALUES';
        sql += placeholder.repeat(chunks.length);
        sql = sql.substring(0, sql.length - 1);
        var data = [];
        for (var i = 0; i < chunks.length; i++) {
            var chunk = chunks[i];
            var x = chunk.x;
            var y = chunk.y;
            var z = chunk.z;

            console.log('  x ' + x + ' y ' + y + ' z ' + z);

            data.push(
                x,
                y,
                z,
                chunk.voxels,
                newTimestamp
            );
        }

        db.query(
            sql,
            data,
            function(error) {
                if (error) {
                    console.log('Error saving chunks for snapshot', error);
                    db.end();
                    return;
                }
                console.log('Snapshotted.');
                db.end();
            }
        );
    });
});
