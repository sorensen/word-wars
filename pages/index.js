var fs = require('fs')

module.exports = function(app) {
  fs.readdirSync('./pages').forEach(function (file) {
    file = file.slice(0, file.length - 3)
    if (file === 'index') return false
    require('./' + file)(app)
  })
}
