var RENDER_SCALE = 1;

var MAX_FRACTAL_SIZE = 48;
var INITIAL_SIZE = 200;

var INITIAL_SCALE_RATE = 15;
var SCALE_ACCELERATION = 1.8;


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


function Line(point1, point2) {
  this.point1 = point1;
  this.point2 = point2;
}

Line.prototype._distanceSq = function (v, w) {
  return Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
};

// Thanks https://stackoverflow.com/a/1501725/4021086
Line.prototype.distanceToPointSquared = function (point) {
  var v = this.point1;
  var w = this.point2;
  var p = point;
  var l2 = this._distanceSq(v, w);
  if (l2 == 0) return this._distanceSq(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return this._distanceSq(p, { x: v.x + t * (w.x - v.x),
                               y: v.y + t * (w.y - v.y) });
};

Line.prototype.distanceToPoint = function (point) {
  return Math.sqrt(this.distToPointSquared(point));
};

Line.prototype.getDx = function () {
  return this.point2.x - this.point1.x;
};

Line.prototype.getDy = function () {
  return this.point2.y - this.point1.y;
};

Line.prototype.getC = function () {
  var p1 = this.point1;
  return p1.y - (p1.x * this.getM());
};

Line.prototype.getM = function () {
  return this.getDy() / this.getDx();
};

Line.prototype.getKey = function () {
  return this.getM().toFixed(4) + '::' + this.getC().toFixed(1);
};

Line.prototype.start = function () {
  return new paper.Point(0, this.getC())
};

Line.prototype.vector = function () {
  return new paper.Point(1, this.getM())
};

Line.prototype.path = function (canvas, ctx) {
  ctx.beginPath();
  var c = this.getC();
  ctx.moveTo(0, c);
  var width = canvas.width;
  ctx.lineTo(width, (this.getM() * width) + c);
};

Line.prototype.dots = function (ctx) {
  var v = this.point1;
  var w = this.point2;
  ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.fillRect(v.x - 5, v.y - 5, 10, 10);

  ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
  ctx.fillRect(w.x - 5, w.y - 5, 10, 10);
};


function Sierpinski(paperScope) {
  var paper = this._paper = paperScope;

  this.version = 1;

  this.canvas = paper.view.element;
  this.context = paper.view._context;

  this.scoreEl = document.getElementById('game-score');
  this.hiscoreEl = document.getElementById('game-hiscore');
  this.msgEl = document.getElementById('game-msg');

  document.addEventListener('mousedown', this.onMouseDown.bind(this));

  paper.view.onFrame = this.onFrame.bind(this);
  paper.view.onMouseMove = this.onMouseMove.bind(this);

  this.reset();
}

Sierpinski.prototype.reset = function() {
  this.state = {
    score: 0,
    finished: false,
    start_time: (new Date()).getTime() / 1000,
    size: INITIAL_SIZE,
  };

  this.updateHighScore();
  this.setScore(0);

  var paper = this.getPaper();

  this.state.triangles = [paper.view.center.add(0,(- GeomUtils.triHeight * this.state.size / 2) + 1)];

  this.state.mouse_pos = new paper.Point(paper.view.center);

  this.setMsg(false);
};

Sierpinski.prototype.finish = function() {
  this.state.finished = true;
  this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

  this.setMsg(true);

  this.saveHighScore();
};

Sierpinski.prototype.getPaper = function() {
  this._paper.activate();
  return window.paper;
};

Sierpinski.prototype.setScore = function(score) {
  this.state.score = score;
  this.renderScore();
};

Sierpinski.prototype.renderScore = _.throttle(function() {
  this.scoreEl.innerHTML = numberWithCommas(Math.round(this.state.score));
}, 80);

Sierpinski.prototype.updateHighScore = function() {
  var hs = localStorage['highscore_v' + this.version];
  if (hs)
    this.hiscoreEl.innerHTML = numberWithCommas(parseInt(hs));
};

Sierpinski.prototype.saveHighScore = function() {
  var score = localStorage['highscore_v' + this.version];

  if (!score || parseInt(score) < this.state.score)
    localStorage['highscore_v' + this.version] = this.state.score;
};

Sierpinski.prototype.onMouseDown = function() {
  if (this.state.finished)
    // TODO: newGame was called
    this.reset();
};

Sierpinski.prototype.onMouseMove = function(evt) {
  this.state.mouse_pos = evt.point;
};

Sierpinski.prototype.setMsg = function(msg) {
  if (msg)
  {
    if (msg !== true)
      this.msgEl.innerHTML = msg;
    this.msgEl.classList.remove('hidden');
  }
  else
    this.msgEl.classList.add('hidden');
};

Sierpinski.prototype.onFrame = function(evt) {
  if (this.state.finished)
    return;

  this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

  var time = ((new Date()).getTime() / 1000) - this.state.start_time;

  this.setScore(time * 1000);

  this._doZoom(evt, time);

  this._realignTriangles();

  this._cullTriangles();

  this._renderTriangles();

  // var edges = this._findEdges();
  // this._drawEdges(edges);

  if (this.state.triangles.length === 0)
  {
    this.finish();
    return;
  }

};

Sierpinski.prototype._doZoom = function(evt, time) {
  var increase = (INITIAL_SCALE_RATE + (time * SCALE_ACCELERATION)) * evt.delta;
  if (increase > 0)
    scale = (increase / this.state.size) + 1;
  else
    scale = 1;
  this.state.size += increase;

  // Original:
    // zoomRate = 0.00001;
    // size *= 1 + zoomRate*dt
    // zoomRate += (5e-8) * dt;

  while (this.state.size > MAX_FRACTAL_SIZE) {
    console.debug('DOING SPLIT');
    this.state.size /= 2;
    this.state.triangles = GeomUtils.splitTrianglePositions(this.state.triangles, this.state.size);
  }

  // Move the triangles out to adjust for the scaling.
  var centerOfScaling = this.state.mouse_pos;
  this.state.triangles = this.state.triangles.map(function (tp)
  {
    return centerOfScaling.add(tp.subtract(centerOfScaling).multiply(scale));
  });
};

Sierpinski.prototype._realignTriangles = function() {
  var halfEdgeSize = this.state.size / 2;
  var triHeight = GeomUtils.triHeight * this.state.size;

  // QDH: Avoid compound error in triangle list by aligning with the first one.
  var firstTriangleX = this.state.triangles[0].x;
  var firstTriangleY = this.state.triangles[0].y;
  this.state.triangles.forEach(function (tp)
  {
    var x = tp.x - firstTriangleX;
    x = (Math.round(x / halfEdgeSize) * halfEdgeSize);
    tp.x = x + firstTriangleX;
    var y = tp.y - firstTriangleY;
    y = (Math.round(y / triHeight) * triHeight);
    tp.y = y + firstTriangleY;
  });
};

Sierpinski.prototype._cullTriangles = function() {
  var bounds = this.getPaper().view.bounds;
  var width = bounds.width;
  var height = bounds.height;
  var halfEdgeSize = this.state.size / 2;

  // Filter the triangles which are off the screen.
  var triangleHeight = GeomUtils.rightEdge.y * this.state.size;
  this.state.triangles = this.state.triangles.filter(function (tp)
  {
    return !(
      tp.y > height ||
      tp.y < - triangleHeight ||
      tp.x - halfEdgeSize > width ||
      tp.x + halfEdgeSize < 0);
  });
};

Sierpinski.prototype._renderTriangles = function() {
  // Draw the remaining triangles to the canvas.
  this.context.fillStyle = 'black';
  this.state.triangles.forEach(function (tp) {
    GeomUtils.pathTriangle(this.context, tp, this.state.size);
    this.context.fill();
  }, this);
};

Sierpinski.prototype._findEdges = function() {
  var edges = {};
  var rightEdge = GeomUtils.rightEdge.multiply(this.state.size);
  var downLeft = GeomUtils.downLeft.multiply(this.state.size);
  this.state.triangles.forEach(function (tp) {
    var br = tp.add(rightEdge);
    var bl = tp.add(downLeft);
    var bottom = new Line(bl, br);
    var left = new Line(tp, bl);
    var right = new Line(tp, br);
    var k = bottom.getKey();
    if (!edges.hasOwnProperty(k))
      edges[k] = bottom;
    k = left.getKey();
    if (!edges.hasOwnProperty(k))
     edges[k] = left;
    k = right.getKey();
    if (!edges.hasOwnProperty(k))
     edges[k] = right;
   console.debug(right.getM(), left.getM());
  }, this);
  return edges;
};

Sierpinski.prototype._drawEdges = function(edges) {
  var canvas = this.canvas;
  var ctx = this.context;
  ctx.strokeStyle = "pink";
  _.forOwn(edges, function(line, key) {
    line.path(canvas, ctx);
    line.dots(ctx);
    ctx.stroke();
  });
  console.debug('triangles', this.state.triangles.length, 'lines', _.size(edges));
};



var main = function () {
  var paper = new window.paper.PaperScope();
  paper.setup('game-canvas');

  window.Game = new Sierpinski(paper);
};

document.addEventListener('DOMContentLoaded', main, false);
