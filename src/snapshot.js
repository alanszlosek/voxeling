var mysql = require('mysql');
var config = require('../config');

var db = mysql.createPool(config.mysql);

var sql = 'select snapshot_datetime from history order by snapshot_datetime DESC limit 1';
db.query(sql, function(error, results) {
    var lastBackup;
    var newTimestamp;
    if (error) {
        callback('Error getting latest snapshot from MySQL: ' + error);
        db.end();
        return;
    }
    if (results.length == 0) {
        // Fetch them all
        lastBackup = 0;
    } else {
        // DO I need to convert to an integer?
        lastBackup = results[0].snapshot_datetime * 1000;
    }

    // Create new timestamp
    newTimestamp = 'Y-m-d H:i:s';

    var sql = 'select x,y,z,voxels from chunk where updated_ms > ?';
    db.query(sql, [lastBackup], function(error, results) {
        if (error) {
            callback('Error getting chunks from MySQL: ' + error);
            return;
        }
        if (results.length == 0) {
            console.log(newTimestamp + ': No chunk changes to snapshot');
            db.end();
            return;
        } else {
            console.log(newTimestamp + ': Snapshotting');
        }

        var placeholder = '(?,?,?,?,?),';
        var sql = 'INSERT INTO `history` (`x`, `y`, `z`, `voxels`, `snapshot_datetime`) VALUES';
        sql += placeholder.repeat(results.length);
        sql = sql.substring(0, sql.length - 1);
        var data = [];
        for (var chunk in results) {
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
        console.log(sql);
        return;
        
        db.query(
            sql,
            data,
            function(error) {
                if (error) {
                    console.log('Error saving chunks for snapshot', error);
                }
            }
        );
    });
});
