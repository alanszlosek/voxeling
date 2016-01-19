var EventEmitter = require('events').EventEmitter;
var debug = false;

// pointer lock stuff
function requestPointerLock(el) {
    return el.requestPointerLock || el.webkitRequestPointerLock || el.mozRequestPointerLock || el.msRequestPointerLock || el.oRequestPointerLock || null;
}

function pointerlockelement() {
    var doc = document;
    return 0 || doc.pointerLockElement || doc.mozPointerLockElement || doc.webkitPointerLockElement || doc.msPointerLockElement || doc.oPointerLockElement || null;
}

var onpointerlockchange = function() {
    if (!pointerlockelement()) {
        // released
        if (currentState == 'playing') {
            self.transition('start');
        }
    }
    if (debug) {
        console.log('lock change');
    }
};

var onpointerlockerror = function() {
    if (debug) console.log('lock error');
};

var mouseCallback;

var out = {
    dx: 0,
    dy: 0,
    dt: 0,
    initial: Date.now()
};
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
        _to: function() {
            if (debug) {
                console.log('entering start state');
            }
        },
        _from: function() {
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
        }
    },
    playing: {
        _to: function() {
            var self = this;
            if (debug) {
                console.log('entering playing state');
            }
            var el = document.body;
            var locker = requestPointerLock(el);
            locker.call(el);
        },
        _from: function() {
            if (debug) {
                console.log('leaving playing state');
            }
            // stop moving
            for (var i in controlStates) {
                controlStates[i] = false;
            }
            if (pointerlockelement()) {
                document.exitPointerLock();
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
            if (mouseCallback) {
                lastPageX = ev.pageX;
                lastPageY = ev.pageY;
                // Re-use the same out object
                out.dx = ev.movementX || ev.mozMovementX || ev.msMovementX || ev.oMovementX || 0;
                out.dy = ev.movementY || ev.mozMovementY || ev.msMovementY || ev.oMovementY || 0;
                out.dt = Date.now() - out.initial;
                mouseCallback(out);
            }
        },
        keydown: function(event) {
            // E
            if (event.which == 69) {
                this.transition('menu');
                return;
            }
            // M
            if (event.which == 77) {
                this.transition('map');
                return;
            }
            if (debug) console.log(event);
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
            if (code == 13) {
                this.transition('chat');
                return false;
            }
            if (code == 27) {
                // escape
                this.transition('start');
                return;
            }
            if (code == 82) {
                // R
                this.emitter.emit('view');
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
    menu: {
        _to: function() {
            if (debug) {
                console.log('entering menu state');
            }
        },
        _from: function() {
            if (debug) {
                console.log('leaving menu state');
            }
        },
        keydown: function(event) {
            if (debug) {
                console.log(event);
            }
            // Would love for this to exist only in client.js, but need to re-work event handler bind hierarchy
            var adjustment = 0;
            var perRow = 5;
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
        }
    },
    chat: {
        _to: function() {
            if (debug) {
                console.log('entering chat state');
            }
            document.getElementById('chat').className = 'active';
            document.getElementById('cmd').focus();
        },
        _from: function() {
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
var InputHandler = function(keyboardElement, mouseLockElement) {
    this.bind(keyboardElement, mouseLockElement);
    this.state = controlStates;
    this.emitter = new EventEmitter();
};

InputHandler.prototype.mouseDeltaCallback = function(callback) {
    mouseCallback = callback;
};

InputHandler.prototype.bind = function(keyboardElement, mouseLockElement) {
    var self = this;
    var genericHandler = function(e) {
        //console.log(e)
        var type = e.type;
        // should be mousedown, etc
        var path = states[currentState];
        if (type in path) {
            if (path[type].call(self, e) === false) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }
    };
    keyboardElement.addEventListener('keydown', genericHandler);
    keyboardElement.addEventListener('keyup', genericHandler);
    mouseLockElement.addEventListener('mousedown', genericHandler, false);
    mouseLockElement.addEventListener('mouseup', genericHandler, false);
    mouseLockElement.addEventListener('mousemove', genericHandler, false);
};

/*
var unbind = function(keyboardElement, mouseLockElement) {
    keyboardElement.removeEventListener('keydown', genericHandler);
    keyboardElement.removeEventListener('keyup', genericHandler);

    mouseLockElement.removeEventListener('mousedown', genericHandler)
    mouseLockElement.removeEventListener('mouseup', genericHandler)
    mouseLockElement.removeEventListener('mousemove', genericHandler)
}
*/
InputHandler.prototype.transition = function(newState) {
    var current;
    if (currentState) {
        // we might be starting at the null state
        current = states[currentState];
        if ('_from' in current) {
            current['_from'].call(this);
        }
        this.emitter.emit('from.' + currentState);
    }
    if (newState in states) {
        currentState = newState;
        current = states[currentState];
        if ('_to' in current) {
            current['_to'].call(this);
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

    if (lookHorizontal > threshold) {
        out.dx = Math.floor(speed * lookHorizontal);
        mouseCallback(out);
    } else if (lookHorizontal < -threshold) {
        out.dx = Math.floor(speed * lookHorizontal);
        mouseCallback(out);
    } else {
        out.dx = 0;
    }

    if (lookVertical > threshold) {
        out.dy = Math.floor(speed * lookVertical);
        mouseCallback(out);
    } else if (gamepad.axes[3] < -threshold) {
        out.dy = Math.floor(speed * lookVertical);
        mouseCallback(out);
    } else {
        out.dy = 0;
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