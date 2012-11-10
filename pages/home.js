var home = {}
  , app
  , db

module.exports = function(app) {
  db = app.settings.db
  return home
}

home.index = function index(req, res, next) {
  res.render('index.html')
}
