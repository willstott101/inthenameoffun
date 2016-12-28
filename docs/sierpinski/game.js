var RENDER_SCALE = 1;

var MIN_FRACTAL_SCALE = 16;

var INITIAL_SCALE = 200;

var INITIAL_SCALE_RATE = 0.8;
var SCALE_ACCELERATION = 0.1;

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

  // Build template triangle on default layer.
  GeomUtils.getTemplateTriangle();

  var triangleLayer = new paper.Layer();
  triangleLayer.activate();

  var firstTri = GeomUtils.addTriangleTo(triangleLayer);
  firstTri.position = paper.view.center;
  firstTri.scale(INITIAL_SCALE);

  // GeomUtils.splitTriangles(
  //       triangleLayer.children,
  //       MIN_FRACTAL_SCALE);

  paper.view.onFrame = function (evt) {
    var paper = getPaper();

    // triangleLayer.scale(1 + (evt.time * SCALE_ACCELERATION * INITIAL_SCALE_RATE * evt.delta));
    // console.debug(triangleLayer.scaling.length);
    triangleLayer.children.forEach(function (triangle) {
      triangle.scale(1 + (evt.time * SCALE_ACCELERATION * INITIAL_SCALE_RATE * evt.delta), paper.view.center);
    });

    while(
      GeomUtils.splitTriangles(
        triangleLayer.children,
        MIN_FRACTAL_SCALE)
    ) {};

    var bounds = paper.view.bounds;
    triangleLayer.children.forEach(function (triangle) {
      triangle.position
      if (!bounds.intersects(triangle.bounds))
        triangle.remove();
    });
  };

};


document.addEventListener('DOMContentLoaded', main, false);
