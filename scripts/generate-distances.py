import json

# try to do this in more compact fashion
# do it in rings, not redundant lists

out = [
]

worldRadius = 10
distances = range(1, (worldRadius * 2) + 1)
step = 32
full_range = range( -(worldRadius*step), (worldRadius*step)+step, 32)

for a in distances:
    out.append( [] )

for x in full_range:
    for y in full_range:
        for z in full_range:
            level = int(
                max(
                    abs(x),
                    abs(y),
                    abs(z)
                )
                /
                step
            )
            out[level].append( [x, y, z] )


print("export default " + json.dumps(out) + ";")