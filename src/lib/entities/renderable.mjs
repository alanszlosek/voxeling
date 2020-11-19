import { Tickable } from './tickable';

var renderables = [];

class Renderable extends Tickable {
    constructor() {
        super();
        renderables.push(this);
    }

    render(ts) {
    }
}

export { Renderable, renderables }