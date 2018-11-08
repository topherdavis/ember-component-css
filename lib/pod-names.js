/* eslint-env node */
'use strict';

var Plugin = require('broccoli-plugin');
var walkSync = require('walk-sync');
var fs = require('fs');
var FSTree = require('fs-tree-diff');
var Promise = require('rsvp').Promise;
var path = require('path');
var componentNames = require('./component-names.js');

module.exports = PodNames;

PodNames.prototype = Object.create(Plugin.prototype);
PodNames.prototype.constructor = PodNames;
function PodNames(inputNode, options) {
  options = options || {};
  Plugin.call(this, [inputNode], {
    annotation: options.annotation,
    persistentOutput: true
  });

  this.currentTree = new FSTree();
  this.podNameJson = {};
  this.classicStyleDir = options.classicStyleDir;
  this.terseClassNames = options.terseClassNames;
}

PodNames.prototype.build = function() {
  var srcDir = this.inputPaths[0];

  var entries = walkSync.entries(srcDir);
  var nextTree = new FSTree.fromEntries(entries, { sortAndExpand: true });
  var currentTree = this.currentTree;

  this.currentTree = nextTree;
  var patches = currentTree.calculatePatch(nextTree);

  return Promise.resolve().then(this.writePodStyleName.bind(this, patches));
};

PodNames.prototype.writePodStyleName = function(patches) {
  for (var i = 0; i < patches.length; i++) {
    switch (patches[i][0]) {
      case 'create':
        this.addClass(patches[i][1]);
        break;
      case 'unlink':
        this.removeClass(patches[i][1]);
        break;
    }
  }

  var currentPodNames = {};
  var outputFile = path.join(this.outputPath, 'pod-names.js');
  // When you have more than one ember-component-css instance (eg. multiple engines/addons),
  // the output folder is not the same for each one of them.
  // So we need to create one that will act as single source of truth for each pod-names.js files
  //var mergedPath = this.outputPath.replace(/output_path-([a-zA-Z0-9]+).tmp/, 'output_path.tmp');
  var mergedPath  = this.outputPath.replace(/out-([a-zA-Z0-9]+)/, 'output_path-tmp');
  var mergedFile = path.join(mergedPath, 'pod-names.js');

  if (!fs.existsSync(mergedPath)) {
    fs.mkdirSync(mergedPath);
  }

  if (fs.existsSync(outputFile)) {
    var outputContents = fs.readFileSync(outputFile).toString();
    currentPodNames = JSON.parse(outputContents.substr(outputContents.indexOf('{')));
  }

  if (fs.existsSync(mergedFile)) {
    var mergedContents = fs.readFileSync(mergedFile).toString();
    currentPodNames = Object.assign(currentPodNames, JSON.parse(mergedContents.substr(mergedContents.indexOf('{'))) );
  }

  var newPodNames = Object.assign(currentPodNames, this.podNameJson);
  var output = 'export default ' + JSON.stringify(newPodNames);
  fs.writeFileSync(mergedFile, output);
  return fs.writeFileSync(path.join(this.outputPath, 'pod-names.js'), output);
}

PodNames.prototype.addClass = function(stylePath) {
  var componentPath = componentNames.path(stylePath, this.classicStyleDir),
      componentClass = componentNames.class(stylePath, this.classicStyleDir, this.terseClassNames);
  this.podNameJson[componentPath] = componentClass;
}

PodNames.prototype.removeClass = function(stylePath) {
  var componentPath = componentNames.path(stylePath, this.classicStyleDir);
  delete this.podNameJson[componentPath];
}
