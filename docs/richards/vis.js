
var superKewl = (function () {
    function rgbaToCss(rgba) {
      return tinycolor({r: rgba[0], g: rgba[1], b: rgba[2], a: rgba[3]}).toRgbString()
    }

    var Region = function (rgba, piccy) {

        this.rgba = rgba;
        this.tinycolor = tinycolor({r: rgba[0], g: rgba[1], b: rgba[2], a: rgba[3]});
        this.color = this.tinycolor.toRgbString();
        this.hsl = this.tinycolor.toHsl();
        this.hsl.h = Math.round(this.hsl.h);

        this.pixels = new Set();
        this.piccy = piccy;
    };
    Region.prototype = {
        fillIntoCtx: function (ctx) {
            if (this.last === 'fill')
                return;
            this.pixels.forEach(function (pixel) {
                var x = pixel % this.piccy.width;
                var y = (pixel - x) / this.piccy.width;
                ctx.fillRect(x, y, 1, 1);
            }, this);
            this.last = 'fill';
        },
        clearFromCtx: function (ctx) {
            if (this.last === 'clear')
                return;
            this.pixels.forEach(function (pixel) {
                var xy = this.piccy.idxToCoord(pixel);
                ctx.clearRect(xy.x, xy.y, 1, 1);
            }, this);
            this.last = 'clear';
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
                var region = this.regionsForColor[rgbaStr];

                if (region === undefined)
                    this.regions.push(region = this.regionsForColor[rgbaStr] = new Region(rgba, this));

                region.pixels.add(p);
            }

            console.info(_.map(this.regions, 'color').join('\n'));
            console.info('BUILT', this.regions.length, 'REGIONS');
            console.info(this.regionsForColor);
        },
        idxToCoord: function (pixel) {
            var x = pixel % this.width;
            return {
                x: x,
                y: (pixel - x) / this.width
            };
        },
        drawDebugRegions: function (ctx) {
            this.regions.forEach(function (r) {
                ctx.fillStyle = r.color;
                r.fillIntoCtx(ctx);
            }, this);
        }
    };

    var Numberwang = function (name, options) {
        this.name = name;
        this.logEvery = options.logEvery;
        this.smoothing = options.smoothing;
        this.initialized = false;
    };
    Numberwang.prototype = {
        next: function (val) {
            if (!this.initialized) {
                this.min = this.max = this.last = this.sum = val;
                this.count = 1;
                this.initialized = true;
            } else {
                if (val < this.min)
                    this.min = val;
                if (val > this.max)
                    this.max = val;
                // TODO: Optionally apply a LPF.
                this.sum += val;
                this.last = val;
                this.count += 1;
            }
            if (this.logEvery && !(this.count % this.logEvery))
                console.debug(
                    'NUM', this.name,
                    this.min.toFixed(2), '<', this.max.toFixed(2),
                    ' Avg:', this.mean().toFixed(2), ' Now:', val.toFixed(2));
            return val;
            // NUM vol 49.81 < 148.91  Avg: 103.85  Now: 93.55
            // NUM fq0 13.31 < 49.69  Avg: 31.83  Now: 29.75
            // NUM fq1 56.31 < 193.31  Avg: 127.57  Now: 115.88
            // NUM fq2 59.69 < 183.75  Avg: 127.87  Now: 112.94
            // NUM fq3 68.06 < 181.81  Avg: 128.11  Now: 115.63
        },
        mean: function () {
            return this.initialized ? this.sum / this.count : 0;
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
        this.analyser.fftSize = 64;
        var bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);

        this.n_vol = new Numberwang('vol', { logEvery: 50 });
        this.n_fq0 = new Numberwang('fq0', { logEvery: 50 });
        this.n_fq1 = new Numberwang('fq1', { logEvery: 50 });
        this.n_fq2 = new Numberwang('fq2', { logEvery: 50 });
        this.n_fq3 = new Numberwang('fq3', { logEvery: 50 });
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

            this.analyser.getByteFrequencyData(this.dataArray);
            var MAX_FREQ = 16000, MIN_FREQ = 20;
            var maxFreq = this.audioCtx.sampleRate / 2;
            // console.info('MAX FREQ', maxFreq);
            var data = this.dataArray;
            var endIdx = this.dataArray.length;
            if (maxFreq > MAX_FREQ)
                endIdx *= (MAX_FREQ / maxFreq);

            var startIdx = Math.floor((endIdx / MAX_FREQ) * MIN_FREQ);
            endIdx = startIdx + Math.floor((endIdx - startIdx) / 4) * 4;
            // console.info('TRUNCATING', this.dataArray.length, '->', endIdx - startIdx);
            data = Array.prototype.slice.call(this.dataArray, startIdx, endIdx);

            var freqBins = [], binWidth = data.length / 4;
            var sum = 0, volume = 0;
            for (var i = 0; i < data.length; i++) {
                sum += data[i];
                if (i % binWidth === binWidth - 1) {
                    sum /= binWidth;
                    freqBins.push(sum);
                    volume += sum;
                    sum = 0;
                }
            }
            volume /= 4;

            volume = this.n_vol.next(volume);
            freqBins[0] = this.n_fq0.next(freqBins[0]);
            freqBins[1] = this.n_fq1.next(freqBins[1]);
            freqBins[2] = this.n_fq2.next(freqBins[2]);
            freqBins[3] = this.n_fq3.next(freqBins[3]);


            var volumeStat = volume / 256;

            this._images.map.regions.forEach(function (r) {
                var draw;
                if (r.hsl.h === 190)
                    draw = r.hsl.l <= volumeStat;
                else if (r.hsl.h === 240)
                    draw = r.hsl.l >= volumeStat;
                else if (r.hsl.h === 0)
                    draw = r.hsl.l * 255 <= freqBins[0];
                else if (r.hsl.h === 25)
                    draw = r.hsl.l * 255 <= freqBins[1];
                else if (r.hsl.h === 50)
                    draw = r.hsl.l * 255 <= freqBins[2];
                else if (r.hsl.h === 80)
                    draw = r.hsl.l * 255 <= freqBins[3];
                if (draw) {
                    this.ctx.fillStyle = r.color;
                    r.fillIntoCtx(this.ctx);
                } else
                    r.clearFromCtx(this.ctx);
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

    var Editor = function (rootEl) {
        if (typeof rootEl === 'string')
            this.rootEl = document.getElementById(rootEl);
        else
            this.rootEl = rootEl;

        this.canvas = this.rootEl.querySelector('canvas');
        this.canvas.addEventListener('click', this._onCanvasClick.bind(this));
        this.ctx = this.canvas.getContext('2d');

        this.initiateColorMap();
        this.initiateZoomer();
        this.initiateHistory();
    };
    Editor.prototype = {
        initiateColorMap: function () {
            var editor = this;
            var colorEls = this.rootEl.querySelectorAll('.color-set > .color-block');

            var onclickFn = function (e) {
                if (e.button !== 0)
                    return;
                this.classList.add('active');
                colorEls.forEach(function (x) {
                    if (x !== this)
                        x.classList.remove('active')
                }, this);
                editor.color = tinycolor(this.getAttribute('gd-hsl')).toRgbString();
                console.debug('Setting canvas color to', editor.color, 'from', this.getAttribute('gd-hsl'));
            };

            colorEls.forEach(function (x) {
                x.addEventListener('click', onclickFn);
            });

            var current = this.rootEl.querySelector('.color-set > .color-block.active');
            editor.color = current ? current.style.backgroundColor : null;
        },
        initiateZoomer: function () {
            var editor = this;
            var zoomIn = this.rootEl.querySelector('.zoom-controls .zoom-in');
            var zoomOut = this.rootEl.querySelector('.zoom-controls .zoom-out');
            var zoomStat = this.rootEl.querySelector('.zoom-controls .zoom-stat');
            var availableScales = [
                0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12
            ];
            this._scaleIdx = availableScales.indexOf(1);
            var zoomUpdate = function () {
                var scale = availableScales[editor._scaleIdx];
                editor.canvas.style.width = (editor.canvas.width * scale) + 'px';
                zoomStat.innerHTML = scale * 100 + '%';
                if (editor._scaleIdx === availableScales - 1)
                    zoomIn.setAttribute('disabled', '');
                if (zoomOut.hasAttribute('disabled'))
                    zoomOut.removeAttribute('disabled');
                if (editor._scaleIdx === 0)
                    zoomOut.setAttribute('disabled', '');
                if (zoomIn.hasAttribute('disabled'))
                    zoomIn.removeAttribute('disabled');
            };
            zoomIn.addEventListener('click', function () {
                if (editor._scaleIdx < availableScales.length - 1) {
                    editor._scaleIdx++;
                    zoomUpdate();
                }
            });
            zoomOut.addEventListener('click', function () {
                if (editor._scaleIdx > 0) {
                    editor._scaleIdx--;
                    zoomUpdate();
                }
            });
        },
        initiateHistory: function () {
            var UNDO_MAX = 20;
            var undoStack = [];
            var redoStack = [];
            var getImageData = (function () {
                return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            }).bind(this);
            var setImageData = (function (imgData) {
                this.ctx.putImageData(imgData, 0, 0);
            }).bind(this);
            var undo = this.rootEl.querySelector('.history-controls .history-undo');
            var redo = this.rootEl.querySelector('.history-controls .history-redo');
            function _updateHistoryBtns() {
                if (undoStack.length > 0)
                    undo.removeAttribute('disabled');
                else
                    undo.setAttribute('disabled', '');
                if (redoStack.length > 0)
                    redo.removeAttribute('disabled');
                else
                    redo.setAttribute('disabled', '');
            }
            undo.addEventListener('click', function () {
                redoStack.push(getImageData());
                setImageData(undoStack.pop());
                _updateHistoryBtns();
            });
            redo.addEventListener('click', function () {
                undoStack.push(getImageData());
                setImageData(redoStack.pop());
                _updateHistoryBtns();
            });
            this.saveHistoryStep = function () {
                undoStack.push(getImageData());
                redoStack = [];
                while (undoStack.length > UNDO_MAX)
                    undoStack.shift();
                _updateHistoryBtns();
            };
        },
        setImage: function (urlOrElement) {
            var el = urlOrElement;
            if (typeof el === 'string') {
                el = new Image();
                el.src = urlOrElement;
            }
            var imageLoaded = (function () {
                this.canvas.width = el.width;
                this.canvas.height = el.height;
                this.ctx.drawImage(el, 0, 0);
            }).bind(this);
            if (el.complete)
                imageLoaded();
            else
                el.addEventListener('load', imageLoaded);
        },
        _onCanvasClick: function (e) {
            var x = e.offsetX;
            var y = e.offsetY;
            var scale = this.getScale();
            x /= scale;
            y /= scale;
            var tool = this.getTool();
            if (tool == 'bucket')
                this.bucket(x, y);
            else
                console.error('Unrecognised tool!', tool);
        },
        getTool: function () {
            // Only got one tool atm...
            return 'bucket';
        },
        bucket: function (x, y) {
            // TODO: Only do bucket fill if it's going to make any difference.
                // N.B. MSPaint doesn't do that but I think it's worthwhile.
            if (this.color /* && this.color different to pixel's */) {
                this.saveHistoryStep();
                this.ctx.fillStyle = this.color;
                this.ctx.fillFlood(x, y);
            }
        },
        getScale: function () {
            var el = this.canvas;
            return el.offsetWidth / el.width;
        }
    };

    return {
        Visualizer: Visualizer,
        Editor: Editor
    };
})();


document.addEventListener('DOMContentLoaded', function () {

    var vis = new superKewl.Visualizer('vis-canvas');
    // vis.addImage('map', '/static/richards/map_mandala.png');
    // vis.addImage('main', '/static/richards/map_mandala.png');
    vis.addImage('map', '/static/richards/map_demo.png');
    vis.addImage('main', '/static/richards/map_demo.png');

    var audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    // audioEl.crossOrigin = "anonymous";
    audioEl.src = "/static/richards/song2.mp3";

    vis.setSource(audioEl);

    var editor = new superKewl.Editor('editor');
    editor.setImage('/static/richards/map_mandala.png');
    // editor.setImage('/static/richards/map_demo.png');
}, false);
