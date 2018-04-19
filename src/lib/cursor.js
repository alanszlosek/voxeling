var glm = require('gl-matrix'),
    vec3 = glm.vec3;
var Shapes = require('./shapes');
var raycast = require('voxel-raycast');
var pool = require('./object-pool');

// This needs cleanup, and encapsulation, but it works
var voxelHit = pool.malloc('array', 3);
var voxelNormal = pool.malloc('array', 3);
var distance = 10;
var direction = vec3.create();

module.exports = function(game, inputHandler, player, camera, lines, currentVoxel, currentNormalVoxel, selecting, low, high) {
    var hit;
    direction[0] = direction[1] = 0;
    direction[2] = -1;
    vec3.transformQuat(direction, direction, player.getRotationQuat());
    hit = raycast(game, camera.getPosition(), direction, distance, voxelHit, voxelNormal);
    if (hit > 0) {
        voxelHit[0] = Math.floor(voxelHit[0]);
        voxelHit[1] = Math.floor(voxelHit[1]);
        voxelHit[2] = Math.floor(voxelHit[2]);

        // Give us access to the current voxel and the voxel at it's normal
        currentVoxel = voxelHit;
        currentNormalVoxel[0] = voxelHit[0] + voxelNormal[0];
        currentNormalVoxel[1] = voxelHit[1] + voxelNormal[1];
        currentNormalVoxel[2] = voxelHit[2] + voxelNormal[2];

        if (selecting) {
            if (inputHandler.state.alt || inputHandler.state.firealt) {
                low[0] = Math.min(selectStart[0], currentNormalVoxel[0]);
                low[1] = Math.min(selectStart[1], currentNormalVoxel[1]);
                low[2] = Math.min(selectStart[2], currentNormalVoxel[2]);
                high[0] = Math.max(selectStart[0] + 1, currentNormalVoxel[0] + 1);
                high[1] = Math.max(selectStart[1] + 1, currentNormalVoxel[1] + 1);
                high[2] = Math.max(selectStart[2] + 1, currentNormalVoxel[2] + 1);
            } else {
                low[0] = Math.min(selectStart[0], currentVoxel[0]);
                low[1] = Math.min(selectStart[1], currentVoxel[1]);
                low[2] = Math.min(selectStart[2], currentVoxel[2]);
                high[0] = Math.max(selectStart[0] + 1, currentVoxel[0] + 1);
                high[1] = Math.max(selectStart[1] + 1, currentVoxel[1] + 1);
                high[2] = Math.max(selectStart[2] + 1, currentVoxel[2] + 1);
            }
            lines.fill(Shapes.wire.cube(low, high));
        } else {
            if (inputHandler.state.alt || inputHandler.state.firealt) {
                high[0] = currentNormalVoxel[0] + 1;
                high[1] = currentNormalVoxel[1] + 1;
                high[2] = currentNormalVoxel[2] + 1;
                lines.fill(Shapes.wire.cube(currentNormalVoxel, high));
            } else {
                high[0] = currentVoxel[0] + 1;
                high[1] = currentVoxel[1] + 1;
                high[2] = currentVoxel[2] + 1;
                lines.fill(Shapes.wire.cube(currentVoxel, high));
            }
        }
        lines.skip(false);
    } else {
        // clear
        lines.skip(true);
        currentVoxel = null;
    }
};