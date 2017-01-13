
var superKewl = (function () {

    function rgbToHsl(r, g, b) {
      r /= 255, g /= 255, b /= 255;

      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var h, s, l = (max + min) / 2;

      if (max == min) {
        h = s = 0; // achromatic
      } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
 
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }

        h /= 6;
      }

      return [ h, s, l ];
    }

    function rgbaToCss(rgba) {
      return 'rgba(' + rgba[0] + ',' + rgba[1] + ',' + rgba[2] + ',' + rgba[3] + ')';
    }

    var Region = function (rgba, piccy) {
        this.rgba = rgba;
        this.color = rgbaToCss(this.rgba);
        this.hsl = rgbToHsl(this.rgba[0], this.rgba[1], this.rgba[2]);
        // Microsoft Paint uses 0-240 for all of HSL.
        this.hslMSP = [Math.round(this.hsl[0] * 240), Math.round(this.hsl[1] * 240), Math.round(this.hsl[2] * 240)];
        console.debug('hsl conversion', this.color, '=>', this.hslMSP[0], this.hslMSP[1], this.hslMSP[2]);
        this.pixels = new Set();
        this.piccy = piccy;
    };
    Region.prototype = {
        fillIntoCtx: function (ctx) {
            this.pixels.forEach(function (pixel) {
                var x = pixel % this.piccy.width;
                var y = (pixel - x) / this.piccy.width;
                ctx.fillRect(x, y, 1, 1);
            }, this);
        },
        clearFromCtx: function (ctx) {
            this.pixels.forEach(function (pixel) {
                var x = pixel % this.piccy.width;
                var y = (pixel - x) / this.piccy.width;
                ctx.clearRect(x, y, 1, 1);
            }, this);
        }
    };

    var Piccy = function () {};
    Piccy.prototype = {
        getPixelDataAt: function (p) {
            var i = p * 4;
            return Array.prototype.slice.call(this.data, i, i + 4)
        },
        getPixelData: function (x, y) {
            if (!this.data)
                return null;
            var p = (y * this.width) + x;
            return this.getPixelDataAt(p);
        },
        _loaded: function () {
            var canvas = document.createElement('canvas');
            canvas.width = this.width = this.el.width;
            canvas.height = this.height = this.el.height;
            var context = canvas.getContext('2d');
            context.drawImage(this.el, 0, 0);
            this.data = context.getImageData(0, 0, this.width, this.height).data;
        },
        buildRegions: function () {
            console.info('BUILDING REGIONS');

            this.regions = [];
            this.regionsForColor = {};

            var pixels = this.data.length / 4;
            for (var p = 0; p < pixels; p++) {
                var rgba = this.getPixelDataAt(p);

                if (rgba[0] === 255 && rgba[1] === 255 && rgba[2] === 255)
                    // Skip white pixels.
                    continue;

                var rgbaStr = rgbaToCss(rgba);
                if (!(rgbaStr in this.regionsForColor))
                    this.regions.push(this.regionsForColor[rgbaStr] = new Region(rgba, this));

                this.regionsForColor[rgbaStr].pixels.add(p);
            }

            console.info('BUILT', this.regions.length, 'REGIONS');
            console.info(this.regionsForColor);
        },
        drawDebugRegions: function (ctx) {
            this.regions.forEach(function (r) {
                ctx.fillStyle = r.color;
                r.fillIntoCtx(ctx);
                console.debug('filled', r.pixels.size, r.hslMSP);
                // debugger;
            }, this);
        }
    };

    var Visualizer = function (canvas) {
        if (typeof canvas === 'string')
            this.canvas = document.getElementById(canvas);
        else
            this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this._images = {
            main: new Piccy(),
            map: new Piccy()
        };
        this.running = false;
        this.boundFrame = this.frame.bind(this);

        this.audioCtx = new AudioContext();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 32;
        var bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
    };
    Visualizer.prototype = {
        maybeGotImageData: function () {
            var notReady = false;
            _.forEach(this._images, function(value, key) {
                if (!value.data)
                    notReady = true;
            });
            if (!notReady) this.initialize();
        },
        _imageLoaded: function (name) {
            var img = this._images[name];
            img._loaded();
            this.maybeGotImageData();
        },
        addImage: function (name, urlOrElement) {
            var el = urlOrElement;
            if (typeof urlOrElement === 'string') {
                el = new Image();
                el.src = urlOrElement;
            }
            this._images[name].el = el;
            if (el.complete)
                this._imageLoaded(name, el);
            else {
                el.addEventListener('load', (function (evt) {
                    this._imageLoaded(name, el);
                }).bind(this));
            }
        },
        initialize: function () {
            var pic = this._images.map; 
            pic.buildRegions();
            pic.drawDebugRegions(this.ctx);
            this.start();
        },
        start: function () {
            this.running = true;
            this.frame();
        },
        stop: function () {
            this.running = false;
        },
        frame: function () {
            if (!this.running)
                return;

            this.analyser.getByteTimeDomainData(this.dataArray);
            this.dataArrayShort = [];
            var sum = 0;
            var volume = 0;
            for (var i = 0; i < this.dataArray.length; i++) {
                sum += this.dataArray[i];
                if (i % 4 === 3) {
                    this.dataArrayShort.push(sum / 4);
                    volume += sum;
                    sum = 0;
                }
            }

            volume /= 16;

            console.debug(_.padEnd('=', volume, '-'));

            this._images.map.regions.forEach(function (r) {
                var draw;
                if (r.hslMSP[0] === 127) {
                    var thresh = ((volume / 255) * (200 - 40)) + 40;
                    console.debug(thresh, r.hslMSP[2]);
                    if (r.hslMSP[2] <= thresh)
                        draw = true;
                }
                // if (draw) {
                //     this.ctx.fillStyle = r.color;
                //     r.fillIntoCtx(this.ctx);
                // } else
                //     r.clearFromCtx(this.ctx);
            }, this);

            window.requestAnimationFrame(this.boundFrame);
        },
        setSource: function (source) {
            this.analyser.disconnect();
            this.source = this.audioCtx.createMediaElementSource(source);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
        }
    };

    var Editor = function (canvas) {
        if (typeof canvas === 'string')
            this.canvas = document.getElementById(canvas);
        else
            this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
    };
    Editor.prototype = {
        setImage: function (urlOrElement) {
            var el = urlOrElement;
            if (typeof el === 'string') {
                el = new Image();
                el.src = urlOrElement;
            }
            var imageLoaded = (function (el) {
                this.canvas.width = el.width;
                this.canvas.height = el.height;
                this.ctx.drawImage(el, 0, 0);
            }).bind(this);
            if (el.complete)
                imageLoaded();
            else
                el.addEventListener('load', imageLoaded);
        }
    };

    return {
        Visualizer: Visualizer
    };
})();


document.addEventListener('DOMContentLoaded', function () {

    var vis = new superKewl.Visualizer('vis-canvas');
    vis.addImage('main', '/static/richards/src_mandala.png');
    // vis.addImage('map', '/static/richards/map_mandala.png');
    vis.addImage('map', '/static/richards/map_test.png');

    var audioEl = document.createElement('audio');
    // audioEl.autoplay = true;
    // audioEl.crossOrigin = "anonymous";
    audioEl.src = "/static/richards/song.mp3";

    vis.setSource(audioEl);
}, false);
