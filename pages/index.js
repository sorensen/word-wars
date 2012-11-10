var fs = require('fs')

var pages = {}

module.exports = function(app) {
  fs.readdirSync('./pages').forEach(function (file) {
    file = file.slice(0, file.length - 3)
    if (file === 'index') return false
    pages[file] = require('./' + file)(app)
  })

  return pages
}
