var EventEmitter = require('events').EventEmitter;
var debug = false;

var mouseCallback = function() {};

var codeMap = {
    // control
    17: 'alt',
    // shift
    16: 'select',
    // W
    87: 'forward',
    // S
    83: 'backward',
    // A
    65: 'left',
    // D
    68: 'right',
    // space
    32: 'jump',
    // F
    70: 'fly'
};


var states = {
    start: {
        to: function() {
            if (debug) {
                console.log('entering start state');
            }
        },
        from: function() {
            if (debug) {
                console.log('leaving start state');
            }
        },
        mouseup: function(event) {
            // Only if event target is the canvas
            if (event.target.tagName == 'CANVAS') {
                this.transition('playing');
                return false;
            }
        },
        change: function(event) {
            switch (event.target.id) {
                case 'drawDistance':
                    this.emitter.emit('drawDistance', event.target.value);
                    break;
                case 'avatar':
                    this.emitter.emit('avatar', event.target.value);
                    break;
            }
        }
    },
    playing: {
        to: function() {
            var self = this;
            if (debug) {
                console.log('entering playing state');
            }
            this.canvas.requestPointerLock();
        },
        from: function() {
            if (debug) {
                console.log('leaving playing state');
            }
            // stop moving
            for (var i in controlStates) {
                controlStates[i] = false;
            }
        },
        // Chrome intercepts Escape key presses, so let's transition based on this event
        pointerlockchange: function(event) {
            if (document.pointerLockElement === this.canvas) {
                //console.log('The pointer lock status is now locked');
            } else {
                //console.log('The pointer lock status is now unlocked');
                this.transition('start');
            }
        },
        mousedown: function(event) {
            if (event.which == 3 || controlStates.alt) {
                controlStates.firealt = true;
                this.emitter.emit('firealt.down');
            } else if (event.which == 1) {
                controlStates.fire = true;
                this.emitter.emit('fire.down');
            }
        }, 
        mouseup: function(event) {
            if (event.which == 3 || controlStates.alt) {
                controlStates.firealt = false;
                this.emitter.emit('firealt.up');
            } else if (event.which == 1) {
                controlStates.fire = false;
                this.emitter.emit('fire.up');
            }
        },
        mousemove: function(ev) {
            mouseCallback(
                ev.movementX,
                ev.movementY
            );
        },
        keydown: function(event) {
            if (debug) console.log(event);
            // E
            if (event.which == 69) {
                this.transition('materials');
                return;
            }
            // M
            if (event.which == 77) {
                this.transition('map');
                return;
            }
            // Escape
            if (code == 27) {
                console.log('escape');
                // We shouldn't ever get here
            }
            
            var code = event.which;
            var key;
            if (code in codeMap) {
                key = codeMap[code];
                if (key in controlStates) {
                    controlStates[key] = 1;
                }
                return false;
            }
        },
        keyup: function(event) {
            var code = event.which;
            var key;
            if (debug) console.log(event);
            // Enter
            if (code == 13) {
                this.transition('chat');
                return false;
            }
            // Escape
            if (code == 27) {
                console.log('escape');
                // We shouldn't ever get here
            }
            // R
            if (code == 82) {
                this.emitter.emit('view');
                return;
            }
            // Shift
            if (code == 16) {
                this.emitter.emit('shift');
                return;
            }
            if (code in codeMap) {
                key = codeMap[code];
                if (key in controlStates) {
                    controlStates[key] = 0;
                }
                // try to prevent ctrl+W from bubbling up
                return false;
            }
        }
    },
    // end playing state
    materials: {
        to: function() {
            if (debug) {
                console.log('entering materials state');
            }
        },
        from: function() {
            if (debug) {
                console.log('leaving materials state');
            }
        },
        keydown: function(event) {
            if (debug) {
                console.log(event);
            }
            // Would love for this to exist only in client.js, but need to re-work event handler bind hierarchy
            var adjustment = 0;
            var perRow = 6;
            switch (event.which) {
                // E
                case 69:
                    this.transition('playing');
                    break;

                // escape should transition back to start
                case 27:
                    this.transition('start');
                    break;

                case 87:
                // W
                case 38:
                    // up
                    adjustment = -perRow;
                    break;

                // S and down
                case 83:
                case 40:
                    adjustment = perRow;
                    break;

                // A and left
                case 65:
                case 37:
                    // left
                    adjustment = -1;
                    break;

                // D and right
                case 68:
                case 39:
                    adjustment = 1;
                    break;

                default:
                break;
            }
            if (adjustment != 0) {
                var matches = document.querySelectorAll('#textureContainer div');
                var from = 0;
                for (var i = 0; i < matches.length; i++) {
                    if (matches[i].className == 'selected') {
                        from = i;
                    }
                    matches[i].className = '';
                }
                matches[from + adjustment].className = 'selected';
                this.emitter.emit('currentMaterial', Number(matches[from + adjustment].getAttribute('data-texturevalue')));
            }
        },
        mousedown: function(event) {
            var $div = $(event.target).closest('div');
            var matches = document.querySelectorAll('#textureContainer div');
            var from = 0;
            for (var i = 0; i < matches.length; i++) {
                matches[i].className = '';
            }
            $div.addClass('selected');
            this.emitter.emit('currentMaterial', Number($div.data('texturevalue')));
        }
    },
    chat: {
        to: function() {
            if (debug) {
                console.log('entering chat state');
            }
            document.getElementById('chat').className = 'active';
            document.getElementById('cmd').focus();
        },
        from: function() {
            if (debug) {
                console.log('leaving chat state');
            }
            document.getElementById('chat').className = '';
            document.getElementById('cmd').value = '';
        },
        keyup: function(event) {
            if (event.which == 13) {
                var el = document.getElementById('cmd');
                if (document.activeElement === el) {
                    //unbind mouse would be nice
                    this.emitter.emit('chat', el.value);
                    el.value = '';
                    el.blur();
                    this.transition('playing');
                    return false;
                }
            }
            // if press escape, go back to playing
            if (event.which == 27) {
                // escape
                this.transition('playing');
                return false;
            }
        }
    },
    disconnected: {
        to: function() {
        },
        from: function() {
        }
    }
};

var controlStates = {
    select: false,
    alt: false,
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    fly: false,
    fire: false,
    firealt: false
};

var currentState = '';

var gamepad;

// Really want to proxy events, so that way I can convert controller events to mouse events and send them to the player/camera
// movement handler.
var InputHandler = function(bindToElement, canvas) {
    var self = this;
    this.bindToElement = bindToElement;
    this.canvas = canvas;
    this.state = controlStates;
    this.emitter = new EventEmitter();

    this.boundStates = {};

    // Fix up states data structure with functions bound to this
    for (var state in states) {
        this.boundStates[state] = {};
        for (var method in states[state]) {
            this.boundStates[state][method] = states[state][method].bind(this);
        }
    }

    document.addEventListener(
        'pointerlockerror',
        function(error) {
            console.log('Pointer Lock Error', error);
        },
        false
    );
};

InputHandler.prototype.mouseDeltaCallback = function(callback) {
    mouseCallback = callback;
};

InputHandler.prototype.transition = function(newState) {
    var current;
    if (currentState) {
        // we might be starting at the null state
        current = this.boundStates[currentState];
        // Unbind current event handlers
        for (var method in current) {
            if (method == 'from' || method == 'to') {
                continue;
            }
            if (method == 'pointerlockchange') {
                document.removeEventListener(method, current[method], false);
            } else {
                this.bindToElement.removeEventListener(method, current[method], false);
            }
        }
        if ('from' in current) {
            current['from']();
        }
        this.emitter.emit('from.' + currentState);
    }
    if (newState in states) {
        currentState = newState;
        current = this.boundStates[currentState];
        // Bind new event handlers
        for (var method in current) {
            if (method == 'from' || method == 'to') {
                continue;
            }
            if (method == 'pointerlockchange') {
                document.addEventListener(method, current[method], false);
            } else {
                this.bindToElement.addEventListener(method, current[method], false);
            }
        }
        if ('to' in current) {
            current['to']();
        }
        this.emitter.emit('to.' + newState);
    }
};

function buttonPressed(b) {
    if (typeof b == "object") {
        return b.pressed;
    }
    return b == 1;
}

var fired = false;

InputHandler.prototype.tick = function() {
    var gamepad = navigator.getGamepads()[0];
    if (!gamepad) {
        return;
    }

    // HANDLE MOVEMENT
    var threshold = 0.15;
    if (gamepad.axes[0] > threshold) {
        controlStates.left = 0;
        controlStates.right = Math.abs(gamepad.axes[0]);
    } else if (gamepad.axes[0] < -threshold) {
        controlStates.left = Math.abs(gamepad.axes[0]);
        controlStates.right = 0;
    } else {
        controlStates.left = controlStates.right = 0;
    }

    if (gamepad.axes[1] > threshold) {
        controlStates.backward = Math.abs(gamepad.axes[1]);
        controlStates.forward = 0;
    } else if (gamepad.axes[1] < -threshold) {
        controlStates.backward = 0;
        controlStates.forward = Math.abs(gamepad.axes[1]);
    } else {
        controlStates.backward = controlStates.forward = 0;
    }

    // HANDLE LOOKING
    threshold = 0.15;
    var speed = 4;
    var lookHorizontal = gamepad.axes[2];
    var lookVertical = gamepad.axes[3];
    var deltaX = 0;
    var deltaY = 0;

    if (lookHorizontal > threshold) {
        deltaX = Math.floor(speed * lookHorizontal);
    } else if (lookHorizontal < -threshold) {
        deltaX = Math.floor(speed * lookHorizontal);
    }

    if (lookVertical > threshold) {
        deltaY = Math.floor(speed * lookVertical);
    } else if (gamepad.axes[3] < -threshold) {
        deltaY = Math.floor(speed * lookVertical);
    }
    if (deltaX || deltaY) {
        mouseCallback(deltaX, deltaY);
    }

    if (buttonPressed(gamepad.buttons[0]) || buttonPressed(gamepad.buttons[7])) {
        controlStates.jump = true;
    } else {
        controlStates.jump = false;
    }
    if (buttonPressed(gamepad.buttons[1]) || buttonPressed(gamepad.buttons[6])) {
        controlStates.fly = true;
    } else {
        controlStates.fly = false;
    }

    // 4 - left shoulder
    // 6 left trigger
    // fire triggers too quickly ... track state changes
    // TODO: update this to emit fire.down and fire.up, same for firealt
    if (buttonPressed(gamepad.buttons[5])) {
        // right shoulder
        if (!fired) {
            this.emitter.emit('fire');
            fired = true;
        }
    } else if (buttonPressed(gamepad.buttons[4])) {
        // right trigger
        if (!fired) {
            this.emitter.emit('firealt');
            fired = true;
        }
    } else {
        fired = false;
    }
};

InputHandler.prototype.on = function(name, callback) {
    this.emitter.on(name, callback);
};

if (!module) {
    module = {};
}

module.exports = InputHandler;
