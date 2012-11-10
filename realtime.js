module.exports = function (app) {
  var io = app.settings.io
    , db = app.settings.db

  io.sockets.on('connection', function (socket) {
    // Stuff here
  })
}
