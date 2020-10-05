import { Tickable } from './entities/tickable.mjs';
class Stats extends Tickable {
    constructor() {
        super();
        let self = this;
        this.frames = 0;
        this.history = [];
        this.container = document.getElementById('stats');

        setInterval(
            function() {
                console.log(self.frames + 'fps');
                self.history.push(self.frames);
                self.frames = 0;

                self.draw();
                
            },
            1000
        );
    }
    draw() {
        let elements = '';
        if (this.history.length > 100) {
            this.history.shift();
        }

        for (let i in this.history) {
            let rate = this.history[i];
            console.log(rate);

            elements += '<div style="margin-top: ' + (60 - rate) + 'px; height: ' + rate + 'px;"></div>';
        }
        this.container.innerHTML = elements;

        
    }
    tick() {
        this.frames++;
    }
}

export default Stats;