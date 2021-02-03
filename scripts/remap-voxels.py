import gzip
import json
import mysql.connector
import re
import time

def current_milli_time():
    return round(time.time() * 1000)

with open('../config-server.mjs', 'r') as f:
    j = f.read()

    # remove comments and ESM stuff
    j = j.replace('export default ', '')
    j = re.sub(r"(// [^\n]+)", '', j)
    config = json.loads(j)
    config = config['mysql']

db = mysql.connector.connect(user=config['user'], password=config['password'], host=config['host'], database=config['database'])
# mysql
# gzip

remap = {
    "16": 5,
    "20": 5,
    "14": 1,
    "17": 1,
    "12": 11
}

field = 'gzippedVoxels'

c = db.cursor(dictionary=True)

# SELECT gzippedVoxels FROM chunks
r = c.execute('SELECT x,y,z,voxels2 FROM chunk')
for row in c.fetchall():
    expanded = bytearray(gzip.decompress(row['voxels2']))

    i = 0
    modified = False
    while i < 32768:
        voxel = str(expanded[i])
        if voxel in remap:
            expanded[i] = remap[voxel]
            modified = True
        i = i + 1

    if modified:
        d = db.cursor()
        compressed = gzip.compress(expanded)
        # write
        data = (
            compressed,
            current_milli_time(),
            row['x'],
            row['y'],
            row['z']
        )
        d.execute('UPDATE chunk SET voxels=%s,updated_ms=%s WHERE x=%s AND y=%s AND z=%s', data)
        db.commit()
        d.close()
        print('Updated %d,%d,%d' % (row['x'], row['y'], row['z']))

c.close()
db.close()
