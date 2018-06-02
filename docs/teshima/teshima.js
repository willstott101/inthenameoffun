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

        var array; // TODO: Don't always cut off the underlying buffer?
        // Perhaps keep at maximum seen dimensions?

        const rects = [];

        if (this.array) {
            if (this.width !== width) {
                array = new Uint8Array(width * height * this.stride);
                let cropRowLen = Math.min(this.width, width) * this.stride;
                let srcRowLen = this.width * this.stride;
                let dstRowLen = width * this.stride;
                for (var y = 0; y <= height; y++) {
                    let i = srcRowLen * y;
                    array.set(this.array.subarray(i, i + cropRowLen), dstRowLen * y);
                }
            } else if (height > this.height) {
                array = new Uint8Array(width * height * this.stride);
                array.set(this.array); // Grown
            } else
                array = this.array.slice(0, width * height * this.stride); // Shrunk
        } else
            array = new Uint8Array(width * height * this.stride);

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

    getElement(x, y, i, array) {
        return (array || this.array)[(y * this.width + x) * this.stride + i];
    }

    render(canvas, ctx) { }

    update() { }
}


class Concrete extends Array3Drawable {
    // 2D array of cixels (concrete pixels)
    // Needs ot store:
        // Height (of concrete)
        // Wetness (willingness for water to travel here)
    constructor(scales) {
        super(2);

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
                let tv = -1;
                for (var i = 0; i < this.scales.length; i++)
                {
                    let v = this.simplex.noise2D(xi * this.scales[i], yi * this.scales[i]);
                    // tv *= v;
                    // tv = Math.max(tv, v);
                    tv += v + 1;
                }
                if (tv > 3)
                    tv = 1;
                else if (tv < -3)
                    tv = -1;
                else
                    tv = tv / 3;

                this.setElement(xi, yi, 0, Math.floor(tv * 128 + 128));
            }
        }
    }

    render(canvas, ctx) {
        const w = canvas.width;
        const h = canvas.height;
        // var mode = {};
        // var sum = 0;
        const dat = ctx.createImageData(w, h);
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++)
            {
                let v = this.getElement(x, y, 0);
                let i = y * w * 4 + x * 4;
                dat.data[i + 0] = v;
                dat.data[i + 1] = v;
                dat.data[i + 2] = v;
                dat.data[i + 3] = 256;
                // dat.data.set([v, v, v, 256], i);
                // mode[v] = (mode[v] || 0) + 1;
                // sum += v;
                // console.debug(v);
            }
        }
        // console.debug(sum / (w * h));
        // console.debug(mode);
        ctx.putImageData(dat, 0, 0);
    }
}


class Water extends Array3Drawable {
    // 2D array of wixels (water pixels)
    // Needs to store:
        // Volume (of water in this wixel)
        // 2D Velocity (of water in this wixel)
    constructor() {
        super(3);
    }

    tick () {
        var orig = this.array.slice();
        for (var x = 0; x < this.width; x++)
            for (var y = 0; y < this.height; y++)
                this.tickWixel(x, y, orig);
    }

    tickWixel (x, y, orig) {
        // ONLY FLOW OUT FROM WIXELS. Should help avoid instability.
        // Look at all 8 adjacent wixels, and get surplus water in this one vs all others.
        // Average the surplus and dump that amount into all of them?
        // Get surplus of this one against all others.
        // Scale surplus for each to normalize to total surplus?
        // var adjSum = this.sumAdjacentLevels(x, y, orig);
        var val = this.getElement(x, y, 0);

        if (!val && this.hasAdjacentWater(x, y, orig))
            this.drip(x, y);

        // var adjDelta = adjSum - val;
        // // Is there surplus in this wixel?
        // if (adjDelta > 0)
        // {
        //     // this.push
        // }
    }

    sumAdjacentLevels (x, y, array) {
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

    hasAdjacentWater (x, y, array) {
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

    drip (x, y, d) {
        // TODO: Fill a circle with water instead of one pixel.
        // const dd = Math.PI / d;
        // for (var yi = 0; yi < r; yi++) {
        //     var w = Math.round(Math.sin(dd * yi));
        // }
        // for (let ri = 0; ri < 1; ri += rd) {
        //     var w = Math.round(Math.sin(ri));
        // }
        this.setElement(x, y, 0, 255);
    }

    render(canvas, ctx) {
        const w = canvas.width;
        const h = canvas.height;
        // var mode = {};
        // var sum = 0;
        // const dat = ctx.createImageData(w, h);
        ctx.fillStyle = 'rgba(0, 0, 255, 0.6)';
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++)
            {
                let v = this.getElement(x, y, 0);
                // let i = y * w * 4 + x * 4;
                // debugger;
                // dat.data.set([0, 0, 255, i % 2 ? 256 : 0], i);
                // dat.data[i + 0] = 0;
                // dat.data[i + 1] = 0;
                // dat.data[i + 2] = 255;
                // dat.data[i + 3] = i % 2 ? 256 : 0;
                if (v)
                    ctx.fillRect(x, y, 1, 1);
                // mode[v] = (mode[v] || 0) + 1;
                // sum += v;
                // console.debug(v);
            }
        }
        // console.debug(sum / (w * h));
        // console.debug(mode);
        // ctx.putImageData(dat, 0, 0);
    }
}


function connectConcreteScaleSliders(concrete, cb) {
    const doc = document;
    const scale1 = doc.getElementById('scale1');
    const scale2 = doc.getElementById('scale2');
    const scale3 = doc.getElementById('scale3');

    function setScales()
    {
        concrete.setScales(scale1.value, scale2.value, scale3.value);
        cb();
    }

    scale1.addEventListener('change', setScales);
    scale2.addEventListener('change', setScales);
    scale3.addEventListener('change', setScales);

    setScales();
}


ready(function ()
{
const doc = document;
const body = doc.body;
const canvas = doc.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
var cWidth;
var cHeight;

// global atm
window.water = new Water();
window.concrete = new Concrete([]);


function sizeCanvas() {
    // TODO: don't always use maximum resolution.
    // Perhaps reduce the resolution if performance is bad..?
    cWidth = canvas.width = window.innerWidth;
    cHeight = canvas.height = window.innerHeight;
    water.size(cWidth, cHeight);
    concrete.size(cWidth, cHeight);
    concrete.render(canvas, ctx);
}
sizeCanvas();
window.addEventListener('resize', sizeCanvas, true);


connectConcreteScaleSliders(concrete, () => {
    concrete.render(canvas, ctx);
});

// concrete.render(canvas, ctx);

console.log(water);
console.log(concrete);


canvas.addEventListener("pointerdown", function(ev)
{
    var radius = Math.max(Math.max(ev.width, ev.height), 30);
    water.drip(ev.offsetX, ev.offsetY, radius);
});

setInterval(() => {
    water.tick();
    concrete.render(canvas, ctx);
    water.render(canvas, ctx);
}, 100);

});

