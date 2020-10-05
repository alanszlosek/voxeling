import { Tickable } from './entities/tickable.mjs';
class Stats extends Tickable {
    constructor() {
        super();
        let self = this;
        this.frameCount = 0;
        this.history = [];
        this.container = document.getElementById('statsLines');
        this.minMax = document.getElementById('statsFps');
        this.min = 60;
        this.max = 0;

        setInterval(
            function() {
                

                self.history.push(self.frameCount);
                self.frameCount = 0;

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
        let min = 60;
        let max = 0;
        for (let i in this.history) {
            let fps = this.history[i];
            min = Math.min(min, fps);
            max = Math.max(max, fps);
            // we assume 60fps is the highest possible frame rate currently
            let rate = Math.floor(fps / 2);
            elements += '<div style="margin-top: ' + (30 - rate) + 'px; height: ' + rate + 'px;"></div>';
        }
        this.container.innerHTML = elements;
        this.minMax.innerText = min + ' - ' + max;

        
    }
    tick() {
        this.frameCount++;
        
    }
}

export default Stats;