var RENDER_SCALE = 1;

var MAX_FRACTAL_SIZE = 48;
var INITIAL_SIZE = 200;

var INITIAL_SCALE_RATE = 5;
var SCALE_ACCELERATION = 2;

var GeomUtils = {
  // Defines some vectors which can be composed to traverse equilateral triangles.
  bottEdge: new paper.Point(1, 0),
  downRightEdge: (new paper.Point(1, 0)).rotate(60, [0, 0]),
  downLeft: (new paper.Point(1, 0)).rotate(120, [0, 0]),

  getTemplateTriangle: function () {
    if (!this.templateTriangle) {
      var templateTriangle = new paper.Path([
        // Top center
        new paper.Point(0, 0),
        // Bottom right
        this.downRightEdge.multiply(2),
        // Bottom middle
        this.downRightEdge.add(this.downLeft),
        // Right middle
        this.downRightEdge,
        // Left middle
        this.downLeft,
        // Bottom middle
        this.downRightEdge.add(this.downLeft),
        // Bottom left
        this.downLeft.multiply(2),
      ]);
      // Then close.
      templateTriangle.closed = true;
      templateTriangle.applyMatrix = false;
      templateTriangle.position = [0, 0];
      this.templateTriangle = templateTriangle;
    }

    return this.templateTriangle;
  },

  addTriangleTo: function (parent) {
    var triangle = this.getTemplateTriangle().clone();
    triangle.parent = parent;
    triangle.fillColor = 'black';
    triangle.data = {fractal: true};
    return triangle;
  },

  pathTriangle: function (ctx, position, size) {
    ctx.beginPath();
    ctx.moveTo(position.x, position.y);
    var point = this.downRightEdge.multiply(size).add(position);
    ctx.lineTo(point.x, point.y);
    ctx.lineTo(point.x - size, point.y);
    ctx.closePath();
  },

  splitTriangles: function (triangles, minFractalScale) {
    var didSplit = false;
    console.debug('Running split iteration over', triangles.length, 'items.');
    triangles.forEach(function (triangle, idx)
    {
      if (triangle.scaling.length > minFractalScale)
      {
        GeomUtils.splitTriangle(triangle);
        didSplit = true;
      }
    });
    return didSplit;
  },

  splitTriangle: function (triangle) {
    // var posScale = triangle.scaling;
    // triangle.scale(0.5);

    // triangle.clone().translate(this.rightTri.multiply(posScale));
    // triangle.clone().translate(this.leftTri.multiply(posScale));
    // triangle.translate(this.topTri.multiply(posScale));

    var posScale = triangle.scaling;
    var scaling = posScale.multiply(0.5);
    var pos = triangle.position;

    var parent = triangle.parent;

    var rightTri = this.addTriangleTo(parent);
    var rtp = pos.add(this.rightTri.multiply(posScale));
    rightTri.translate(rtp).scale(scaling, rtp);

    var leftTri = this.addTriangleTo(parent);
    var ltp = pos.add(this.leftTri.multiply(posScale));
    leftTri.translate(ltp).scale(scaling, ltp);

    triangle.translate(this.topTri.multiply(posScale));
    triangle.scale(0.5);
  },

  splitTrianglePositions: function (trianglePositions, size) {
    var downRightEdge = this.downRightEdge.multiply(size);
    var downLeft = this.downLeft.multiply(size);
    return trianglePositions.reduce(function (tps, tp)
    {
      tps.push(tp, tp.add(downRightEdge), tp.add(downLeft));
      return tps;
    }, []);
  }
};

GeomUtils.triHeight = GeomUtils.downRightEdge.y * 2;
GeomUtils.triWidth = GeomUtils.downRightEdge.x * 4;
GeomUtils.rightTri = new paper.Point(GeomUtils.bottEdge.x * 0.5, (GeomUtils.downRightEdge.y * 0.5));
GeomUtils.leftTri = new paper.Point(GeomUtils.bottEdge.x * -0.5, (GeomUtils.downRightEdge.y * 0.5));
GeomUtils.topTri = new paper.Point(0, -GeomUtils.downRightEdge.y * 0.5);

var main = function () {
  var _paper = new window.paper.PaperScope();
  var getPaper = function () {
    _paper.activate();
    return window.paper;
  };

  var paper = getPaper();
  paper.setup('game-canvas');

  var canvas = paper.view.element;
  var context = paper.view._context;

  var START_TIME = (new Date()).getTime();
  var LAST_TIME = null;

  var SIZE = INITIAL_SIZE;

  var trianglePositions = [paper.view.center.add(0,- GeomUtils.downRightEdge.y * SIZE / 2)];
  console.debug('center', paper.view.center.x, paper.view.center.y);
  console.debug('trianglePosition', trianglePositions[0].x, trianglePositions[0].y);

  console.debug('INITIAL_SIZE', INITIAL_SIZE);
  console.debug('MAX_FRACTAL_SIZE', MAX_FRACTAL_SIZE);

  while (SIZE > MAX_FRACTAL_SIZE) {
    console.debug('DOING SPLIT');
    SIZE /= 2;
    trianglePositions = GeomUtils.splitTrianglePositions(trianglePositions, SIZE);
  }
  console.debug('SIZE', SIZE);
  console.debug('trianglePositions.length', trianglePositions.length);


  paper.view.onFrame = function (evt) {

    context.clearRect(0, 0, canvas.width, canvas.height);

    var increase = evt.time * SCALE_ACCELERATION * INITIAL_SCALE_RATE * evt.delta;
    console.debug('increase in size', increase);
    if (increase > 0)
      scale = (increase / SIZE) + 1;
    else
      scale = 1;
    console.debug('scale', scale);
    SIZE += increase;

    while (SIZE > MAX_FRACTAL_SIZE) {
      console.debug('DOING SPLIT');
      SIZE /= 2;
      trianglePositions = GeomUtils.splitTrianglePositions(trianglePositions, SIZE);
    }

    var width = canvas.width;
    var height = canvas.height;
    var centerOfScaling = new paper.Point(width / 2, height / 2);
    trianglePositions = trianglePositions.map(function (tp)
    {
      return centerOfScaling.add(tp.subtract(centerOfScaling).multiply(scale));
    });

    var halfEdgeSize = SIZE / 2;
    trianglePositions = trianglePositions.filter(function (tp)
    {
      if (
        tp.y > height ||
        tp.y < 0 ||
        tp.x - halfEdgeSize > width ||
        tp.x + halfEdgeSize < 0) {
        console.info('Pruning trianlge pos', tp.x, tp.y);
      }
      return !(
        tp.y > height ||
        tp.y < 0 ||
        tp.x - halfEdgeSize > width ||
        tp.x + halfEdgeSize < 0);
    });

    if (trianglePositions.length === 0) {
      throw 'end';
    }

    console.info('Drawing', trianglePositions.length, 'triangles of size', SIZE);
    context.fillStyle = 'black';
    trianglePositions.forEach(function (tp) {
      GeomUtils.pathTriangle(context, tp, SIZE);
      context.fill();
    });
  };

};


document.addEventListener('DOMContentLoaded', main, false);
