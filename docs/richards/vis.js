// var canvas = document.createElement('canvas');
// var context = canvas.getContext('2d');
// var img = document.getElementById('myimg');
// canvas.width = img.width;
// canvas.height = img.height;
// context.drawImage(img, 0, 0 );
// var myData = context.getImageData(0, 0, img.width, img.height);

var superKewl = (function () {
    var Visualizer = function (canvas) {
        if (typeof canvas === 'string')
            this.canvas = document.getElementById('vis-canvas');
        else
            this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    };
    Visualizer.prototype = {
        gotImageData: function () {

        },
        maybeGotImageData: function () {
            if (this._srcImgData && this._maskImgData)
                this.gotImageData();
        },
        addImage: function (name, urlOrElement) {
            var el = urlOrElement;
            if (typeof urlOrElement === 'string') {
                el = document.createElement('img');
                el.src = urlOrElement;
            }
            if (el.complete)
                this._imageLoaded(name, el);
            else {
                el.addEventListener('loadend', (function (evt) {
                    console.debug('loadend for image', name, evt.type);
                }).bind(this));
            }
        }
    };

    return {
        Visualizer: Visualizer
    };
})();

var vis = new superKewl.Visualizer('vis-canvas');
vis.addImage('main', '/static/richards/src_mandala.png');
vis.addImage('map', '/static/richards/map_mandala.png');
