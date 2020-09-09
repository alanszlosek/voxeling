var renderables = [];

class Renderable {
    constructor() {
        renderables.push(this);
    }
}

export { Renderable, renderables }