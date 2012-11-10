var home = {}
  , app
  , db

module.exports = function(app) {
  db = app.settings.db

  app.get('/', home.index)
}

home.index = function index(req, res, next) {
  res.render('index.html')
}
