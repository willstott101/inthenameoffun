var RENDER_SCALE = 1;

var MAX_FRACTAL_SIZE = 48;
var INITIAL_SIZE = 200;

var INITIAL_SCALE_RATE = 5;
var SCALE_ACCELERATION = 2;

var GeomUtils = {
  // Defines some vectors which can be composed to traverse equilateral triangles.
  rightEdge: (new paper.Point(1, 0)).rotate(60, [0, 0]),
  downLeft: (new paper.Point(1, 0)).rotate(120, [0, 0]),

  pathTriangle: function (ctx, position, size) {
    ctx.beginPath();
    ctx.moveTo(position.x, position.y);
    var point = this.rightEdge.multiply(size).add(position);
    ctx.lineTo(point.x, point.y);
    ctx.lineTo(point.x - size, point.y);
    ctx.closePath();
  },

  splitTrianglePositions: function (trianglePositions, size) {
    var rightEdge = this.rightEdge.multiply(size);
    var downLeft = this.downLeft.multiply(size);
    return trianglePositions.reduce(function (tps, tp)
    {
      tps.push(tp, tp.add(rightEdge), tp.add(downLeft));
      return tps;
    }, []);
  }
};

GeomUtils.triHeight = GeomUtils.rightEdge.y;

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

  var trianglePositions = [paper.view.center.add(0,- GeomUtils.triHeight * SIZE / 2)];
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
    var bounds = paper.view.bounds;
    var center = paper.view.center;
    var width = bounds.width;
    var height = bounds.height;

    context.clearRect(0, 0, canvas.width, canvas.height);

    var increase = evt.time * SCALE_ACCELERATION * INITIAL_SCALE_RATE * evt.delta;
    if (increase > 0)
      scale = (increase / SIZE) + 1;
    else
      scale = 1;
    SIZE += increase;

    while (SIZE > MAX_FRACTAL_SIZE) {
      console.debug('DOING SPLIT');
      SIZE /= 2;
      trianglePositions = GeomUtils.splitTrianglePositions(trianglePositions, SIZE);
    }

    // Move the triangles out to adjust for the scaling.
    var centerOfScaling = center;
    trianglePositions = trianglePositions.map(function (tp)
    {
      return centerOfScaling.add(tp.subtract(centerOfScaling).multiply(scale));
    });

    var halfEdgeSize = SIZE / 2;

    // QDH: Avoid compound error in trianglePositions by aligning to a grid.
    var firstTriangleX = trianglePositions[0].x;
    trianglePositions.forEach(function (tp)
    {
      var x = tp.x - firstTriangleX;
      x = (Math.round(x / halfEdgeSize) * halfEdgeSize);
      tp.x = x + firstTriangleX;
    });

    // Filter the triangles which are off the screen.
    var triangleHeight = GeomUtils.rightEdge.y * SIZE;
    trianglePositions = trianglePositions.filter(function (tp)
    {
      return !(
        tp.y > height ||
        tp.y < - triangleHeight ||
        tp.x - halfEdgeSize > width ||
        tp.x + halfEdgeSize < 0);
    });

    if (trianglePositions.length === 0) {
      throw 'end';
    }

    // console.info('Drawing', trianglePositions.length, 'triangles of size', SIZE);
    // Draw the remaining triangles to the canvas.
    context.fillStyle = 'black';
    trianglePositions.forEach(function (tp) {
      GeomUtils.pathTriangle(context, tp, SIZE);
      context.fill();
    });
  };

};


document.addEventListener('DOMContentLoaded', main, false);
