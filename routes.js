module.exports = function (app) {
  var pages = require('./pages')(app)

  app.get('/', pages.home.index)
}
