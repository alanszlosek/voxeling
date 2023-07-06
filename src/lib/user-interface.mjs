// TODO: refactor this so we don't have to include config again
import { default as config } from '../../config-client.mjs';
import randomName from 'sillyname';
import { Tickable } from './capabilities/tickable.mjs';
import { WebGL } from './webgl.mjs';


var debug = false;

var mouseCallback = function() {};

var codeMap = {
    // control
    17: 'alt',
    // shift
    16: 'shift',
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
    70: 'fly',
    // Y
    89: 'spin',
};

let gameGlobal;
var states = {
    start: {
        to: function() {
            if (debug) {
                console.log('entering start state');
            }
            
            var element;
            var value;
            document.getElementById('overlay').className = 'introduction';

            // nickname
            element = document.getElementById('username');
            value = localStorage.getItem('name');
            if (!value || value.length == 0 || value.trim().length == 0) {
                value = randomName();
                localStorage.setItem('name', value);
            }
            element.value = value;

            // draw distance
            element = document.getElementById('drawDistance');
            value = parseInt(localStorage.getItem('drawDistance'));
            if (!value) {
                value = 2;
                localStorage.setItem('drawDistance', value);
            }
            element.value = value;
            config.drawDistance = value;

            // trigger drawDistance event after 2 seconds on load?
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
                    var value = parseInt(event.target.value);
                    if (value < 0) {
                        value = 1;
                    }
                    localStorage.setItem('drawDistance', value);

                    config.drawDistance = value;

                    // TODO: this shouldn't be here
                    gameGlobal.voxels.hazeDistance = (value * 32.0) - 4.0;

                    gameGlobal.clientWorkerHandle.regionChange();
                    break;
                case 'avatar':
                    gameGlobal.player.setTexture( event.target.value );
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
            
            document.getElementById('overlay').className = '';

            // Enable motion / physics
            gameGlobal.pubsub.publish('running', []);
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
            if (event.which == 1) {
                // Is Shift key being held down during left click?
                if (controlStates.shift) {
                    controlStates.action2 = true;
                } else {
                    controlStates.action1 = true;
                }
            } else if (event.which == 3) {
                controlStates.action2 = true;
            }
        }, 
        mouseup: function(event) {
            // Trying to cover edge cases here ...
            // Shift might have been released before mouse, so reset all mouse related states on Up
            controlStates.action1 = false;
            controlStates.action2 = false;
        },
        mousemove: function(ev) {
            // do bitwise op to remove lower 8 bits or so to clamp to consistent intervals
            //let mask = 128 + 64 + 32 + 16 + 8 + 4;
            //gameGlobal.player.updateYawPitch(ev.movementX, ev.movementY);

            // TODO: finalize this
            gameGlobal.pubsub.publish('mousemove', [ev.movementX, ev.movementY]);
        },
        keydown: function(event) {
            if (debug) console.log(event);
            // E
            if (event.which == 69) {
                this.transition('materials');
                return;
            }
            // N
            if (event.which == 78) {
                this.game.snow.toggle();
                return;
            }
            // C - toggle cursor?
            if (event.which == 67) {
                // toggle cursor
                gameGlobal.cursor.enabled = !gameGlobal.cursor.enabled;
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
                    controlStates[key] = true; // TODO: why not boolean?
                }
                return false;
            } else {
                console.log('unexpect keypress: ' + code);
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
                gameGlobal.camera.nextView();
                return;
            }
            if (code in codeMap) {
                key = codeMap[code];
                if (key in controlStates) {
                    controlStates[key] = false;
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
            document.getElementById('overlay').className = 'textures';
        },
        from: function() {
            if (debug) {
                console.log('leaving materials state');
            }
            document.getElementById('overlay').className = '';
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
            /*
            if (adjustment < 0) {
                adjustment = perRow + adjustment;
            }
            */
            if (adjustment != 0) {
                var matches = document.querySelectorAll('#textureContainer > div');
                var from = 0;
                var tentative = 0;
                for (var i = 0; i < matches.length; i++) {
                    if (matches[i].className == 'selected') {
                        from = i;
                        matches[i].className = '';
                    }                    
                }
                // TODO: need more logic here for moving before first row
                // and beyond last row. tricky maths if last row not filled out.
                tentative = from + adjustment;

                if (tentative == -1) {
                    // carry on
                    from = matches.length - 1;
                } else if (tentative == matches.length) {
                    // carry on
                    from = 0;
                } else if (0 <= tentative && tentative < matches.length) {
                    // carry on
                    from = tentative;
                } else {
                    // don't change
                }
                
                matches[from].className = 'selected';
                gameGlobal.cursor.currentMaterial = Number(
                    matches[from].getAttribute('data-texturevalue')
                );
                console.log('material: ' + gameGlobal.cursor.currentMaterial);
            }
        },
        mousedown: function(event) {
            //var $div = $(event.target).closest('div');
            var matches = document.querySelectorAll('#textureContainer > div');
            var from = 0;
            for (var i = 0; i < matches.length; i++) {
                matches[i].className = '';
            }
            //$div.addClass('selected');
            //this.emitter.emit('currentMaterial', Number($div.data('texturevalue')));
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
                    //this.emitter.emit('chat', el.value);
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
    shift: false,
    alt: false,
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    fly: false,
    fire: false,
    firealt: false,
    action1: false, // default: destroy block
    action2: false, // default: create block,
    spin: false
};

var currentState = '';


var tag = function(tagName, attributes, children) {
    var element = document.createElement(tagName);
    for (var i in attributes) {
        element.setAttribute(i, attributes[i]);
    }
    // Convert text to text node
    for (var i = 0; i < children.length; i ++) {
        var node = children[i];
        if (node == null) {
            continue;
        } else if (node instanceof Node) {
        } else {
            node = document.createTextNode(node);
        }
        element.appendChild(node);
    }

    return element;
};

// Really want to proxy events, so that way I can convert controller events to mouse events and send them to the player/camera
// movement handler.
class UserInterface extends Tickable {
    constructor(game) {
        super();
        let self = this;
        this.canvas = game.canvas;

        gameGlobal = this.game = game;
        this.state = controlStates;
        this.gamepad = null;

        this.coordsElement = document.getElementById('coordinates');
        this.game.pubsub.subscribe('player.updatePosition', function(position) {
            // TODO: move this into user-interface
            // Update coordinates shown at top-right every second
            //if (ts - this.coordsTimestamp >= 1000.0) {
                //this.coordsTimestamp = ts;
                let pos = self.game.player.getPosition().map(Math.floor);
                self.coordsElement.innerText = pos.join(', ');
            //}
        });
        

        this.bindToElement = document.body;

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
        /*
        window.addEventListener(
            'gamepadconnected',
            function(error) {
                    console.log('Gamepad connected');
                }
            },
            false
        );
        window.addEventListener(
            'gamepaddisconnected',
            function(error) {
                console.log('Gamepad disconnected');
                self.gamepad = null;
            },
            false
        );
        */
        this.drawTextures();

        this.transition('start');
    }

    drawTextures() {
        let self = this;
        let container = this.materials = document.getElementById('textureContainer');
        let textures = this.game.config.voxels;
        let textureOffsets = this.game.textureOffsets;
        let pixelOffsets = textureOffsets.pixelOffsets;
        // pixelOffsets assumes we're not scaling down the image,
        // but here we are ... showing textures in 90 pixel divs
        let scale = 90 / textureOffsets['textureRowPixels'];
        let scaleTo = '90px';

        this.game.config.texturePicker.forEach(function(voxelValue, index) {
            // get texture value from top face of voxel cube
            let textureValue = self.game.config.voxels[voxelValue].textures[1];
            
            let offsetY = scale * pixelOffsets[ textureValue ];
            let classNames = index == 0 ? 'selected' : '';
            let styles = {
                'background-image': 'url("' + '/materials.png")',
                'background-position': '0px -' + offsetY + 'px',
                'background-size': scaleTo
            };
            let style = '';
            for (let key in styles) {
                let value = styles[key];
                style += key + ':' + value + ';';
            }
            let div = tag(
                'DIV',
                {
                    'data-texturevalue': voxelValue,
                    'style': style,
                    'class': classNames
                },
                []
            );
            container.appendChild(div);
        });
    }

    
    mouseDeltaCallback(callback) {
        mouseCallback = callback;
    }

    transition(newState) {
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
            //this.emitter.emit('from.' + currentState);
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
            //this.emitter.emit('to.' + newState);
        }
    }

    tick(ts) {
        if (!navigator.getGamepads) {
            return;
        }
        let gamepad = navigator.getGamepads()[0];
        if (gamepad == null) {
            return;
        }
        let controlStates = this.state;
    
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
        var speed = 1.1;
        var lookHorizontal = gamepad.axes[2];
        var lookVertical = gamepad.axes[3];
        var deltaX = 0;
        var deltaY = 0;
    
        if (lookHorizontal > threshold || lookHorizontal < -threshold) {
            deltaX = speed * lookHorizontal;
        }
    
        if (lookVertical > threshold || lookVertical < -threshold) {
            deltaY = speed * lookVertical;
        }
        if (deltaX || deltaY) {
            console.log(deltaX);
            gameGlobal.updateYawPitch(deltaX, deltaY);
            //gameGlobal.player.yaw -= deltaX;
            //gameGlobal.player.pitch -= deltaY;
            // TODO: is this necessary?
            gameGlobal.player.updateQuat();
        }
    
        if (buttonPressed(gamepad.buttons[0]) || buttonPressed(gamepad.buttons[7])) {
            console.log('jump');
            controlStates.jump = true;
        } else {
            controlStates.jump = false;
        }
        if (buttonPressed(gamepad.buttons[1]) || buttonPressed(gamepad.buttons[6])) {
            controlStates.fly = true;
        } else {
            controlStates.fly = false;
        }
        if (buttonPressed(gamepad.buttons[2]) || buttonPressed(gamepad.buttons[5])) {
            controlStates.shift = true;
        } else {
            controlStates.shift = false;
        }
    
        // 4 - left shoulder
        // 6 left trigger
        // fire triggers too quickly ... track state changes
        // TODO: update this to emit fire.down and fire.up, same for firealt
        if (buttonPressed(gamepad.buttons[5])) {
            // right shoulder
            if (!fired) {
                fired = true;
            }
        } else if (buttonPressed(gamepad.buttons[4])) {
            // right trigger
            if (!fired) {
                fired = true;
            }
        } else {
            fired = false;
        }
    }
    
    on(name, callback) {
        //this.emitter.on(name, callback);
        console.log('UI: on handler called. why?');
    }
}

function buttonPressed(b) {
    if (typeof b == "object") {
        return b.pressed;
    }
    return b == 1;
}

var fired = false;

export { UserInterface };
