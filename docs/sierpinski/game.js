var RENDER_SCALE = 1;

var MAX_FRACTAL_SIZE = 48;
var INITIAL_SIZE = 200;

var INITIAL_SCALE_RATE = 40;
var SCALE_ACCELERATION = 0.1;

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

// Thanks http://stackoverflow.com/a/2901298
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

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

  // Game variables
  var START_TIME, LAST_TIME, SIZE, TRIANGLES, MOUSE_POS;
  var scoreEl = document.getElementById('game-score');
  var updateScore = _.throttle(function (score) {
    scoreEl.innerHTML = numberWithCommas(Math.round(score));
  }, 80);

  var newGame = function () {
    START_TIME = (new Date()).getTime();
    LAST_TIME = null;

    SIZE = INITIAL_SIZE;

    TRIANGLES = [paper.view.center.add(0,- GeomUtils.triHeight * SIZE / 2)];

    MOUSE_POS = new paper.Point(paper.view.center);

    scoreEl.innerHTML = 0;
  };

  newGame();

  paper.view.onMouseMove = function (evt) {
    MOUSE_POS = evt.point;
  };

  paper.view.onFrame = function (evt) {
    var bounds = paper.view.bounds;
    var center = paper.view.center;
    var width = bounds.width;
    var height = bounds.height;

    context.clearRect(0, 0, canvas.width, canvas.height);

    updateScore(evt.time * 1000);

    var increase = evt.time * SCALE_ACCELERATION * INITIAL_SCALE_RATE * evt.delta;
    if (increase > 0)
      scale = (increase / SIZE) + 1;
    else
      scale = 1;
    SIZE += increase;

    while (SIZE > MAX_FRACTAL_SIZE) {
      console.debug('DOING SPLIT');
      SIZE /= 2;
      TRIANGLES = GeomUtils.splitTrianglePositions(TRIANGLES, SIZE);
    }

    // Move the triangles out to adjust for the scaling.
    var centerOfScaling = MOUSE_POS;
    TRIANGLES = TRIANGLES.map(function (tp)
    {
      return centerOfScaling.add(tp.subtract(centerOfScaling).multiply(scale));
    });

    var halfEdgeSize = SIZE / 2;
    var triHeight = GeomUtils.triHeight * SIZE;

    // QDH: Avoid compound error in TRIANGLES by aligning to a grid.
    var firstTriangleX = TRIANGLES[0].x;
    var firstTriangleY = TRIANGLES[0].y;
    TRIANGLES.forEach(function (tp)
    {
      var x = tp.x - firstTriangleX;
      x = (Math.round(x / halfEdgeSize) * halfEdgeSize);
      tp.x = x + firstTriangleX;
      var y = tp.y - firstTriangleY;
      y = (Math.round(y / triHeight) * triHeight);
      tp.y = y + firstTriangleY;
    });

    // Filter the triangles which are off the screen.
    var triangleHeight = GeomUtils.rightEdge.y * SIZE;
    TRIANGLES = TRIANGLES.filter(function (tp)
    {
      return !(
        tp.y > height ||
        tp.y < - triangleHeight ||
        tp.x - halfEdgeSize > width ||
        tp.x + halfEdgeSize < 0);
    });

    if (TRIANGLES.length === 0) {
      throw 'end';
    }

    // console.info('Drawing', TRIANGLES.length, 'triangles of size', SIZE);
    // Draw the remaining triangles to the canvas.
    context.fillStyle = 'black';
    TRIANGLES.forEach(function (tp) {
      GeomUtils.pathTriangle(context, tp, SIZE);
      context.fill();
    });
  };

};


document.addEventListener('DOMContentLoaded', main, false);
