
class Bounds {
    constructor(width, height, depth) {
        this.width = width;
        this.height = height;
        this.depth = depth;

        this.bottomFrontLeft = [ 0, 0, 0 ];
        this.bottomFrontRight = [ 0, 0, 0 ];
        this.bottomBackLeft = [ 0, 0, 0 ];
        this.bottomBackRight = [ 0, 0, 0 ];
        this.middleFrontLeft = [ 0, 0, 0 ];
        this.middleFrontRight = [ 0, 0, 0 ];
        this.middleBackLeft = [ 0, 0, 0 ];
        this.middleBackRight = [ 0, 0, 0 ];
        this.topFrontLeft = [ 0, 0, 0 ];
        this.topFrontRight = [ 0, 0, 0 ];
        this.topBackLeft = [ 0, 0, 0 ];
        this.topBackRight = [ 0, 0, 0 ];

        this.all = [ this.bottomFrontLeft, this.bottomFrontRight, this.bottomBackLeft, this.bottomBackRight, this.middleFrontLeft, this.middleFrontRight, this.middleBackLeft, this.middleBackRight, this.topFrontLeft, this.topFrontRight, this.topBackLeft, this.topBackRight ];
        this.front = [ this.bottomFrontLeft, this.bottomFrontRight, this.middleFrontLeft, this.middleFrontRight, this.topFrontLeft, this.topFrontRight ];
        this.back = [ this.bottomBackLeft, this.bottomBackRight, this.middleBackLeft, this.middleBackRight, this.topBackLeft, this.topBackRight ];
        this.left = [ this.bottomFrontLeft, this.bottomBackLeft, this.middleFrontLeft, this.middleBackLeft, this.topFrontLeft, this.topBackLeft ];
        this.right = [ this.bottomFrontRight, this.bottomBackRight, this.middleFrontRight, this.middleBackRight, this.topFrontRight, this.topBackRight ];
        this.top = [ this.topFrontLeft, this.topFrontRight, this.topBackLeft, this.topBackRight ];
        this.bottom = [ this.bottomFrontLeft, this.bottomFrontRight, this.bottomBackLeft, this.bottomBackRight ];

        // So we can visualize the bounding boxes
        this.lines = [];
    }

    updateBounds(centerPosition) {
        var x = centerPosition[0], y = centerPosition[1], z = centerPosition[2];
        var w = this.width / 2;
        var h = this.height / 2;
        var bounds;
        // x0/y0/z0 - forward + left
        bounds = this.bottomFrontLeft;
        bounds[0] = x - w;
        bounds[1] = y;
        bounds[2] = z - w;
        // x0/y0/z1 - backward + left
        bounds = this.bottomBackLeft;
        bounds[0] = x - w;
        bounds[1] = y;
        bounds[2] = z + w;
        // x1/y0/z1 - backward + right
        bounds = this.bottomBackRight;
        bounds[0] = x + w;
        bounds[1] = y;
        bounds[2] = z + w;
        // x1/y0/z0 - forward + right
        bounds = this.bottomFrontRight;
        bounds[0] = x + w;
        bounds[1] = y;
        bounds[2] = z - w;
        bounds = this.middleFrontLeft;
        bounds[0] = x - w;
        bounds[1] = y + h;
        bounds[2] = z - w;
        bounds = this.middleBackLeft;
        bounds[0] = x - w;
        bounds[1] = y + h;
        bounds[2] = z + w;
        bounds = this.middleBackRight;
        bounds[0] = x + w;
        bounds[1] = y + h;
        bounds[2] = z + w;
        bounds = this.middleFrontRight;
        bounds[0] = x + w;
        bounds[1] = y + h;
        bounds[2] = z - w;
        bounds = this.topFrontLeft;
        bounds[0] = x - w;
        bounds[1] = y + this.height;
        bounds[2] = z - w;
        bounds = this.topBackLeft;
        bounds[0] = x - w;
        bounds[1] = y + this.height;
        bounds[2] = z + w;
        bounds = this.topBackRight;
        bounds[0] = x + w;
        bounds[1] = y + this.height;
        bounds[2] = z + w;
        bounds = this.topFrontRight;
        bounds[0] = x + w;
        bounds[1] = y + this.height;
        bounds[2] = z - w;

        this._updateLines()
    }

    _updateLines() {
        // Prepare lines for WebGL LINE_LOOP drawing
        var points = [
            // Around the bottom
            this.bottomFrontLeft,
            this.bottomFrontRight,
            this.bottomBackRight,
            this.bottomBackLeft,
            this.bottomFrontLeft,

            // Up then around the middle
            this.middleFrontLeft,
            this.middleFrontRight,
            this.middleBackRight,
            this.middleBackLeft,
            this.middleFrontLeft,

            // Up then around the top
            this.topFrontLeft,
            this.topFrontRight,
            this.topBackRight,
            this.topBackLeft,
            this.topFrontLeft,

            // Over then down the side
            this.topFrontRight,
            this.middleFrontRight,
            this.bottomFrontRight,

            // Back then up the side
            this.bottomBackRight,
            this.middleBackRight,
            this.topBackRight,

            // Left then down the side
            this.topBackLeft,
            this.middleBackLeft,
            this.bottomBackLeft
        ];

        // Create array to hold line info, if not done already
        if (this.lines.length == 0) {
            var sz = points.length * 3;
            this.lines = new Float32Array(sz);
        }

        var i = 0;
        for (var point of points) {
            this.lines[ i++ ] = point[0];
            this.lines[ i++ ] = point[1];
            this.lines[ i++ ] = point[2];
        }
    }
}

export { Bounds };