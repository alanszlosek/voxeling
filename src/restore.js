var mysql = require('mysql');
var config = require('../config');
var dayjs = require('dayjs');

var db = mysql.createPool(config.mysql);

var newTimestamp = Date.now();
var earliest = dayjs('2016-02-28T10:21:57-0400');
var ts;

// Roll back to this time
//$ts = strtotime('2017-01-12 20:53:03');
//$ts = strtotime('2017-11-15 18:52:00'); // hedges along yellow brick road
ts = dayjs('2017-11-27T21:34:00-0400'); // exposed spirals a few chunks away from origin, dug out lots of terraces
ts = dayjs('2017-11-28T15:57:00-0400'); // lower more terraces, dirt near origin, repair gutted tree
ts = dayjs('2017-11-28T19:50:00-0400'); // minor stuff
ts = dayjs('2017-12-06T06:00:01-0400'); // snapshot time
ts = dayjs('2017-12-19T21:10:00-0400'); // snapshot time
ts = dayjs('2018-03-30T16:53:00-0400');
ts = dayjs('2018-03-31T05:00:00-0400'); // rainbow tunnel!

ts = dayjs('2020-01-01T00:00:00Z');


console.log('Cutoff: ' + ts.toISOString());

// Fetch chunk ids modified after date
var sql = 'select distinct x,y,z from history where created_ms>?';
db.query(sql, [ts], function(error, changes) {
    if (error) {
        callback('Error getting latest snapshot from MySQL: ' + error);
        db.end();
        return;
    }
    for (var i = 0; i < changes.length; i++) {
        var chunk = changes[i];
        var x = chunk.x;
        var y = chunk.y;
        var z = chunk.z;

        // TODO: think thorugh this logic when i've NOT had a beer

        //$version = $db->fetchRow('select * from history where x=', $x, ' AND y=', $y, ' AND z=', $z, ' AND snapshot_datetime BETWEEN ', $earliest, ' AND ', $dt, ' ORDER BY snapshot_datetime DESC LIMIT 1');
        var sql = 'select * from history where x=? and y=? and z=? AND created_ms<=? ORDER BY created_ms DESC LIMIT 1';
        db.query(sql, [x,y,z,ts], function(error, results) {
            if (error) {
                callback('Error getting latest snapshot from MySQL: ' + error);
                db.end();
                return;
            }

            var chunk = results[0];

            var sql3 = 'UPDATE chunks SET voxels=?,updated_ms=? WHERE x=? AND y=? AND z=?';
            var data = [
                voxels,
                newTimestamp,
                x,
                y,
                z
            ];
            db.query(sql, data, function(error, results) {
                if (error) {
                    callback('Failed to update ' + chunkID + ': ' + error);
                    db.end();
                    return;
                }
            });

        });
    }

});
