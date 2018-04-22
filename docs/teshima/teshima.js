'use strict';

function ready(fn) {
    const doc = document;
    if (doc.attachEvent ? doc.readyState === "complete" : doc.readyState !== "loading")
        fn();
    else
        doc.addEventListener('DOMContentLoaded', fn);
}


class Array3 {
    constructor(width, height, stride) {
        this.stride = stride; // Cannot change stride atm.
        this.width = this.height = 0;
        this.size(width, height);
    }

    size(width, height) {
        if (this.height === height && this.width === width)
            return; // No Change.

        var array; // TODO: Don't always cut off the underlying buffer?
        // Instead keep at maximum seen dimensions?

        const rects = [];

        if (this.array) {
            if (this.width !== width) {
                array = new UInt8Array(width * height * this.stride);
                let cropRowLen = Math.min(this.width, width) * this.stride;
                let srcRowLen = this.width * this.stride;
                let dstRowLen = width * this.stride;
                for (var y = 0; y <= height; y++) {
                    let i = srcRowLen * y;
                    array.set(this.array.subarray(i, i + cropRowLen), dstRowLen * y);
                }
            } else if (height > this.height) {
                array = new UInt8Array(width * height * this.stride);
                array.set(this.array); // Grown
            } else
                array = this.array.slice(0, width * height * this.stride); // Shrunk
        } else
            array = new UInt8Array(width * height * this.stride);

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

    setElement(x, y, i, value) {
        this.array[y * this.width * this.stride + x * this.stride + i] = value
    }
}


class Concrete extends Array2 {
    // 2D array of cixels (concrete pixels)
    // Needs ot store:
        // Height (of concrete)
        // Wetness (willingness for water to travel here)
    constructor(width, height) {
        this.simplex =  new SimplexNoise();

        super.constructor(width, height, 2)
    }

    initialize(x, y, width, height) {
        const x2 = x + width;
        const y2 = y + height;
        for (x; x < x2; x++) {
            for (y; y < height; y++)
                this.setElement(x, y, 0, Math.floor(this.simplex.noise2D(x, y) * 128 + 128));
        }
    }
}


class Water extends Array2 {
    // 2D array of wixels (water pixels)
    // Needs to store:
        // Volume (of water in this wixel)
        // 2D Velocity (of water in this wixel)
}


ready(function ()
{
const doc = document;
const body = doc.body;
const canvas = doc.getElementById('main-canvas');
var cWidth;
var cHeight;

function sizeCanvas() {
    // TODO: don't always use maximum resolution.
    // Perhaps reduce the resolution if performance is bad..?
    cWidth = canvas.width = body.clientWidth;
    cHeight = canvas.height = body.clientHeight;
}

sizeCanvas();
window.addEventListener('resize', sizeCanvas, true);

var water = new Water(cWidth, cHeight);

});

