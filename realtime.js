var app, io, db

module.exports = function (app) {
  io = app.settings.io
  db = app.settings.db
  io.sockets.on('connection', ioMain)
}

function ioMain(socket) {
  socket.on('test', function (data) {
    console.log(data)
  })
}
