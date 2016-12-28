var glm = require('../gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;
var scratch = require('../scratch');

var Shapes = require('../shapes2');
var Model = require('../model2');
var Scene = require('../scene-graph');

function Sun(gl, shader, textures, player) {
    var self = this;
    this.sunRotation = 0;

    var meshes = [];
    
    var d = 6;
    var uv = [
        0, 0, d, d,
        0, 0, d, d,
        0, 0, d, d,
        0, 0, d, d,
        0, 0, d, d,
        0, 0, d, d
    ];
    var sunMesh = this.sun = Shapes.three.rectangle(d, d, d, uv, 1, textures.byName.lava);
    meshes.push(sunMesh);

    this.model = new Model(
        gl,
        shader,
        meshes,
        // Tick method for doing movement
        function() {
            var position = player.getPosition();
            //var translation = vec3.fromValues(position[0], position[1] - 20, position[2]);
            mat4.translate(this.localMatrix, scratch.identityMat4, position);
            mat4.rotateZ(this.localMatrix, this.localMatrix, self.sunRotation);
            mat4.translate(this.localMatrix, this.localMatrix, [0, -200, 0]);
        }
    );

    this.hierarchy = new Scene.Node(gl, this.model);


    // Cube orbiting around the sun
    var d = 2;
    var uv = [
        0, 0, d, d,
        0, 0, d, d,
        0, 0, d, d,
        0, 0, d, d,
        0, 0, d, d,
        0, 0, d, d
    ];
    var shape = Shapes.three.rectangle(d, d, d, uv, 1, textures.byName.lava);
    var meshes = [shape];

    var num = 10;
    var circ = Math.PI * 2;
    for (var i = 0; i < num; i++) {
        var orbital = new Model(
            gl,
            shader,
            meshes,
            // Tick method for doing movement
            function(seconds) {
                var translation = vec3.fromValues(4, 0, 0);
                mat4.rotateY(this.localMatrix, scratch.identityMat4, self.tempSpeed + (this.num * (circ / num)));
                mat4.translate(this.localMatrix, this.localMatrix, translation);
                // Rotate them back for more pointy shimmer
                mat4.rotateY(this.localMatrix, this.localMatrix, -(self.tempSpeed + (this.num * (circ / num))));
            }
        );
        orbital.num = i;

        this.hierarchy.addChild(
            new Scene.Node(gl, orbital)
        );
    }
    for (var i = 0; i < num; i++) {
        var orbital = new Model(
            gl,
            shader,
            meshes,
            // Tick method for doing movement
            function(seconds) {
                var translation = vec3.fromValues(0, 4, 0);
                mat4.rotateX(this.localMatrix, scratch.identityMat4, self.tempSpeed + (this.num * (circ / num)));
                mat4.translate(this.localMatrix, this.localMatrix, translation);
                mat4.rotateX(this.localMatrix, this.localMatrix, -(self.tempSpeed + (this.num * (circ / num))));
            }
        );
        orbital.num = i;

        this.hierarchy.addChild(
            new Scene.Node(gl, orbital)
        );
    }

}

Sun.prototype.tick = function(weatherTime, sunRotation) {
    this.weatherTime = weatherTime;
    this.sunRotation = sunRotation;

    // tick the models hierarchy
    // TODO: calculate self.weatherTime / 300.0 and cache somewhere so child Nodes don't have to repeatedly calculate?
    this.tempSpeed = this.weatherTime / 300.0;
    this.hierarchy.tick(scratch.identityMat4, 0);
};

Sun.prototype.render = function(parentView, ts) {
    this.hierarchy.render(scratch.identityMat4, ts);
};

module.exports = Sun;
