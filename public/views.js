var views = require('./viewsfolder')
  , EventEmitter = require('events').EventEmitter
  , ejs = require('ejs')

// map
for (var key in views) {
  views[key] = ejs.compile(views[key])
}

window.views = views
