'use strict';

function ready(fn) {
    const doc = document;
    if (doc.attachEvent ? doc.readyState === "complete" : doc.readyState !== "loading")
        fn();
    else
        doc.addEventListener('DOMContentLoaded', fn);
}


class Array3Drawable {
    constructor(stride) {
        this.stride = stride; // Cannot change stride atm.
        this.width = this.height = 0;
    }

    size(width, height) {
        if (this.height === height && this.width === width)
            return; // No Change.

        var array;

        const rects = [];

        if (this.array) {
            if (this.width !== width) {
                array = new Uint8ClampedArray(width * height * this.stride);
                let cropRowLen = Math.min(this.width, width) * this.stride;
                let srcRowLen = this.width * this.stride;
                let dstRowLen = width * this.stride;
                for (var y = 0; y <= height; y++) {
                    let i = srcRowLen * y;
                    array.set(this.array.subarray(i, i + cropRowLen), dstRowLen * y);
                }
            } else if (height > this.height) {
                array = new Uint8ClampedArray(width * height * this.stride);
                array.set(this.array); // Grown
            } else
                array = this.array.slice(0, width * height * this.stride); // Shrunk
        } else
            array = new Uint8ClampedArray(width * height * this.stride);

        if (this.height < height)
            rects.push([0, this.height, width, height - this.height]);
        if (this.width < width && this.array)
            rects.push([this.width, 0, width - this.width, Math.min(this.height, height)]);

        this.width = width;
        this.height = height;
        this.array = array;

        for (var i = 0; i < rects.length; i++)
            this.initialize(...rects[i]);
    }

    initialize(x, y, width, height) {

    }

    setElement(x, y, i, value, array) {
        (array || this.array)[(y * this.width + x) * this.stride + i] = value;
    }

    incrElement(x, y, i, value, array) {
        const arr = array || this.array;
        const idx = (y * this.width + x) * this.stride + i;
        const orig = arr[idx];
        return (arr[idx] += value) - orig;
    }

    getElement(x, y, i, array) {
        return (array || this.array)[(y * this.width + x) * this.stride + i];
    }

    setElementAt(idx, i, value, array) {
        (array || this.array)[idx * this.stride + i] = value;
    }

    getElementAt(idx, i, array) {
        return (array || this.array)[idx * this.stride + i];
    }

    render(canvas, ctx) { }

    tick(timeDelta) { }

    stats(element) {
        var sum = 0;
        var min = 256;
        var max = -1;
        const w = this.width;
        const h = this.height;
        const count = w * h;
        const elem = element || 0;
        for (let i = 0; i < count; i++) {
            let v = this.getElementAt(i, elem);
            sum += v;
            if (v > max) max = v;
            if (v < min) min = v;
        }
        return {
            mean: sum / (w * h),
            min: min,
            max: max,
            // sum: sum,
            // count: count,
        };
    }
}


class Concrete extends Array3Drawable {
    // 2D array of cixels (concrete pixels)
    // Needs ot store:
        // Height (of concrete)
        // Wetness (willingness for water to travel here)
    constructor(scales) {
        super(3);

        this.simplex = new SimplexNoise();
        this.scales = scales;
    }

    initialize(x, y, width, height) {
        this.generate(x, y, width, height);
    }

    regenerate() {
        this.generate(0, 0, this.width, this.height);
    }

    setScales(scale1, scale2, scale3) {
        this.scales = [scale1, scale2, scale3];
        console.log('Regenerating with scales:', this.scales);
        this.regenerate();
    }

    generate(x, y, width, height) {
        const x2 = x + width;
        const y2 = y + height;

        console.log('Concrete generating rect:', x, y, width, height);
        
        for (let yi = y; yi < y2; yi++) {
            for (let xi = x; xi < x2; xi++) {
                let tv = 0;
                for (var i = 0; i < this.scales.length; i++)
                {
                    let v = this.simplex.noise2D(xi * this.scales[i], yi * this.scales[i]);
                    // tv *= v;
                    // tv = Math.max(tv, v);
                    tv += v;
                }
                if (tv > 3)
                    tv = 1;
                else if (tv < -3)
                    tv = -1;
                else
                    tv = tv / 3;

                this.setElement(xi, yi, 0, Math.round((tv * 200) + 128));
            }
        }

        this.bakeVelocities(x, y, x2, y2);

        console.debug('Concrete generated - stats:', this.stats(0));
        console.debug('                - vx stats:', this.stats(1));
        console.debug('                - vy stats:', this.stats(2));
    }

    bakeVelocities(x, y, x2, y2) {
        const diagonal = (1 / Math.sqrt(1 + 1)) * 0.5;

        for (let yi = y; yi < y2; yi++) {
            for (let xi = x; xi < x2; xi++)
            {
                var vx = 0;
                var vy = 0;

                if (xi < this.width - 1)
                    vx += 255 - this.getElement(xi + 1, yi,     0);

                if (xi > 0)
                    vx -= 255 - this.getElement(xi - 1, yi,     0);

                if (yi < this.width - 1)
                    vy += 255 - this.getElement(yi,     yi + 1, 0);

                if (yi > 0)
                    vy -= 255 - this.getElement(yi,     yi - 1, 0);

                if (xi < this.width - 1 && yi < this.height - 1)
                {
                    let tr = (255 - this.getElement(xi + 1, yi + 1, 0)) * diagonal;
                    vx += tr;
                    vy += tr;
                }
                if (xi < this.width - 1 && yi > 0)
                {
                    let br = (255 - this.getElement(xi + 1, yi - 1, 0)) * diagonal;
                    vx += br;
                    vy -= br;
                }
                if (xi > 0 && yi < this.height - 1)
                {
                    let tl = (255 - this.getElement(xi - 1, yi + 1, 0)) * diagonal;
                    vx -= tl;
                    vy += tl;
                }
                if (xi > 0 && yi > 0) {
                    let bl = (255 - this.getElement(xi - 1, yi - 1, 0)) * diagonal;
                    vx -= bl;
                    vy -= bl;
                }

                this.setElement(xi, yi, 1, vx);
                this.setElement(xi, yi, 2, vy);
            }
        }

    }

    render(canvas, ctx) {
        console.debug('Rendering concrete');
        const w = canvas.width;
        const h = canvas.height;
        const dat = ctx.createImageData(w, h);
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++)
            {
                let i = y * w + x;
                let v = this.getElementAt(i, 0);
                i *= 4;
                dat.data[i + 0] = v;
                dat.data[i + 1] = v;
                dat.data[i + 2] = v;
                dat.data[i + 3] = 256;
            }
        }
        ctx.putImageData(dat, 0, 0);
    }
}

class Emitter {
    constructor(x, y, radius, flowRate) {
        this.x = x;
        this.y = y;
        this.radius = radius || 1;
        this.flowRate = flowRate || 128;
    }

    update(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
    }

    flow(water, timeDelta) {
        const r = this.radius;
        const x = this.x;
        const y = this.y;
        const d = timeDelta * this.flowRate;
        for (let xi = -r; xi <= r; xi++)
        {
            let wx = x + xi;
            if (wx < 0) continue;
            if (wx >= water.width) break;

            let yr = Math.round(Math.cos(Math.asin(xi / r)) * r);

            for (let yi = -yr; yi <= yr; yi++)
            {
                let wy = y + yi;
                if (wy < 0) continue;
                if (wy >= water.height) break;

                this.flowWixel(water, wx, wy, d);
            }
        }
    }

    flowWixel(water, x, y, d) {
        water.incrElement(x, y, 0, d);
    }
}

class Water extends Array3Drawable {
    // 2D array of wixels (water pixels)
    // Needs to store:
        // Volume (of water in this wixel)
        // 2D Velocity (of water in this wixel)
    constructor() {
        super(3);

        this.emitters = {};
    }

    addEmitter(pId, x, y, radius) {
        const e = new Emitter(x, y, radius);
        this.emitters[pId] = e;
    }

    updateEmitter(pId, x, y, radius) {
        if (this.emitters.hasOwnProperty(pId))
            this.emitters[pId].update(x, y, radius);
    }

    removeEmitter(pId) {
        if (this.emitters.hasOwnProperty(pId))
            delete this.emitters[pId];
    }

    tick(timeDelta) {
        const ems = this.emitters;
        for (let pId in ems)
            if (ems.hasOwnProperty(pId))
                ems[pId].flow(this, timeDelta);

        const orig = this.array.slice();
        for (var x = 0; x < this.width; x++)
            for (var y = 0; y < this.height; y++)
                this.tickWixel(x, y, orig, timeDelta);
    }

    tickWixel(x, y, orig, timeDelta) {
        // ONLY FLOW OUT FROM WIXELS. Should help avoid instability.

        // Algo Thoughts 1
            // Look at all 8 adjacent wixels, and get surplus water in this one vs all others.
            // Average the surplus and dump that amount into all of them?
            // Get surplus of this one against all others.
            // Scale surplus for each to normalize to total surplus?
            // var adjSum = this.sumAdjacentLevels(x, y, orig);

        // var val = this.getElement(x, y, 0);
        // var adjDelta = adjSum - val;
        // // Is there surplus in this wixel?
        // if (adjDelta > 0)
        // {
        //     // this.push
        // }

        // "Game of Life" - inspired algo
            // Empty wixels on low-ish areas of concrete become full if there's any nearby water.
        var val = this.getElement(x, y, 0, orig);
        var max = this.maxAdjacentLevel(x, y, orig);
        if (max > val)
        {
            // Limit to concrete "height"
            // max = Math.min(concrete.getElement(x, y, 0), max);
            let conc = concrete.getElement(x, y, 0);
            if (max > conc)
                this.setElement(x, y, 0, max);
            // else
            //     this.setElement(x, y, 0, conc);
        }

        // Concrete Velocity Algo
            // Water flows out of wixels at the rate pre-caclucated in Concrete.bakeVelocities
        // var val = this.getElement(x, y, 0, orig);
        // if (val)
        // {
        //     var vx = concrete.getElement(x, y, 1) * timeDelta;
        //     if (vx > 0)
        //     {
        //         if (x < this.width - 1)
        //             vx = this.incrElement(x + 1, y, 0, vx);
        //     } else if (x > 0)
        //         vx = this.incrElement(x - 1, y, 0, vx);
        //     else
        //         vx = 0;

        //     var vy = concrete.getElement(x, y, 2) * timeDelta;
        //     if (vy > 0)
        //     {
        //         if (y < this.height - 1)
        //             vy = this.incrElement(x, y + 1, 0, vy);
        //     } else if (y > 0)
        //         vy = this.incrElement(x, y - 1, 0, vy);
        //     else
        //         vy = 0;

        //     this.incrElement(x, y, 0, - vx - vy);
        // }
    }

    sumAdjacentLevels(x, y, array) {
        var s = 0;
        if (y > 0)
        {
            if (x > 0)
                s += this.getElement(x - 1, y - 1, 0, array);
            s += this.getElement(x, y - 1, 0, array);
            if (x < this.width - 1)
                s += this.getElement(x + 1, y - 1, 0, array);
        }
        if (x > 0)
            s += this.getElement(x - 1, y, 0, array);
        if (x < this.width - 1)
            s += this.getElement(x + 1, y, 0, array);
        if (y < this.height - 1)
        {
            if (x > 0)
                s += this.getElement(x - 1, y + 1, 0, array);
            s += this.getElement(x, y + 1, 0, array);
            if (x < this.width - 1)
                s += this.getElement(x + 1, y + 1, 0, array);
        }
        return s;
    }

    hasAdjacentWater(x, y, array) {
        if (y > 0)
        {
            if (x > 0)
                if (this.getElement(x - 1, y - 1, 0, array))
                    return true;
            if (this.getElement(x, y - 1, 0, array))
                return true;
            if (x < this.width - 1)
                if (this.getElement(x + 1, y - 1, 0, array))
                    return true;
        }
        if (x > 0)
            if (this.getElement(x - 1, y, 0, array))
                return true;
        if (x < this.width - 1)
            if (this.getElement(x + 1, y, 0, array))
                return true;
        if (y < this.height - 1)
        {
            if (x > 0)
                if (this.getElement(x - 1, y + 1, 0, array))
                    return true;
            if (this.getElement(x, y + 1, 0, array))
                return true;
            if (x < this.width - 1)
                if (this.getElement(x + 1, y + 1, 0, array))
                    return true;
        }
        return false;
    }

    maxAdjacentLevel(x, y, array) {
        var s = 0;
        const w2 = this.width - 1;
        const h2 = this.height - 1;
        if (y > 0)
        {
            if (x > 0)
                s = Math.max(this.getElement(x - 1, y - 1, 0, array), s);
            s = Math.max(this.getElement(x, y - 1, 0, array), s);
            if (x < w2)
                s = Math.max(this.getElement(x + 1, y - 1, 0, array), s);
        }
        if (x > 0)
            s = Math.max(this.getElement(x - 1, y, 0, array), s);
        if (x < w2)
            s = Math.max(this.getElement(x + 1, y, 0, array), s);
        if (y < h2)
        {
            if (x > 0)
                s = Math.max(this.getElement(x - 1, y + 1, 0, array), s);
            s = Math.max(this.getElement(x, y + 1, 0, array), s);
            if (x < w2)
                s = Math.max(this.getElement(x + 1, y + 1, 0, array), s);
        }
        return s;
    }

    render(canvas, ctx) {
        const w = canvas.width;
        const h = canvas.height;
        const dat = ctx.createImageData(w, h);
        for (let x = 0; x < w; x++)
        {
            for (let y = 0; y < h; y++)
            {
                let i = y * w + x;
                let v = this.getElementAt(i, 0);
                i *= 4;
                dat.data[i + 0] = 0;
                dat.data[i + 1] = 0;
                dat.data[i + 2] = 255;
                dat.data[i + 3] = v;
            }
        }
        ctx.putImageData(dat, 0, 0);
    }
}


function connectConcreteScaleSliders(concrete, cb) {
    const doc = document;
    const scale1 = doc.getElementById('scale1');
    const scale2 = doc.getElementById('scale2');
    const scale3 = doc.getElementById('scale3');

    function setScales()
    {
        concrete.setScales(scale1.value / 20, scale2.value / 20, scale3.value / 20);
        cb();
    }

    scale1.addEventListener('change', setScales);
    scale2.addEventListener('change', setScales);
    scale3.addEventListener('change', setScales);

    setScales();
}


class Renderer {
    constructor(canvasId, renderScale) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.drawables = [];
        this.renderScale = renderScale || 1;
    }

    sizeToWindow() {
        const w = this.canvas.width = Math.round(window.innerWidth * this.renderScale);
        const h = this.canvas.height = Math.round(window.innerHeight * this.renderScale);

        const ds = this.drawables;
        for (var i = 0; i < ds.length; i++)
            ds[i].size(w, h);
    }

    render(drawables) {
        if (drawables === undefined)
            drawables = this.drawables;

        for (var i = 0; i < drawables.length; i++)
            drawables[i].render(this.canvas, this.ctx);
    }

    tick(timeDelta) {
        const ds = this.drawables;
        for (var i = 0; i < ds.length; i++)
            ds[i].tick(timeDelta);
    }

    add(drawable) {
        const ds = this.drawables;
        if (!ds.includes(drawable))
            ds.push(drawable);
    }

    scaleVals(...args) {
        return args.map(a => Math.round(a * this.renderScale));
    }
}


ready(function ()
{
    // global for easy debugging
    window.water = new Water();
    window.concrete = new Concrete([]);

    console.log(water);
    console.log(concrete);

    const RENDER_SCALE = 0.4;

    const waterRenderer = new Renderer('top-canvas', RENDER_SCALE);
    const concreteRenderer = new Renderer('bg-canvas', RENDER_SCALE);

    waterRenderer.add(water);
    concreteRenderer.add(concrete);



    function sizeCanvas() {
        waterRenderer.sizeToWindow();
        concreteRenderer.sizeToWindow();

        concreteRenderer.render();
    }
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas, true);


    connectConcreteScaleSliders(concrete, () => {
        concreteRenderer.render([concrete]);
    });

    waterRenderer.canvas.addEventListener("pointerdown", function(ev)
    {
        let r = Math.max(Math.max(ev.width, ev.height) / 2, 4);
        const [x, y, radius] = waterRenderer.scaleVals(ev.offsetX, ev.offsetY, r);
        water.addEmitter(ev.pointerId, x, y, radius);
    });

    waterRenderer.canvas.addEventListener("pointermove", function(ev)
    {
        if (ev.pressure === 0)
            return;
        let r = Math.max(Math.max(ev.width, ev.height), 15);
        const [x, y, radius] = waterRenderer.scaleVals(ev.offsetX, ev.offsetY, r);
        water.updateEmitter(ev.pointerId, x, y, radius);
    });

    function onup (ev) { water.removeEmitter(ev.pointerId); }
    document.addEventListener("pointerup", onup);
    document.addEventListener("pointercancel", onup);


    var startTime;
    var lastTime;
    function step(timestamp) {
        if (!startTime)
            startTime = lastTime = timestamp;
        var progress = timestamp - startTime;
        var deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        waterRenderer.tick(deltaTime / 1000);
        waterRenderer.render();

        window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);

});

