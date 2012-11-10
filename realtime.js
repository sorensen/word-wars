var dictionary = require('./dictionary')
  , app, io, db

module.exports = function (app) {
  io = app.settings.io
  db = app.settings.db
  io.sockets.on('connection', ioMain)
}

function ioMain(socket) {
  var session = socket.handshake.session

  socket.on('join', function (room) {
    socket.join(room)
  })

  socket.on('leave', function (room) {
    socket.leave(room)
  })

  socket.on('attack', function (word, cb) {
    var rooms = io.sockets.manager.roomClients[socket.id]
      , others = io.sockets.clients('test')
      , room = Object.keys(rooms)[1]

    if (!room) {
      return cb('Not in a room')
    }

    room.slice(1)

    others = others.filter(function (client) {
      return client.id !== socket.id
    })

    word = word.toUpperCase()

    if (dictionary[word] !== 0) {
      return cb('Invalid word')
    }

    db.srem([room, socket.id, 'currentwords'].join(':'), word, checkPlayerWords)

    function checkPlayerWords(err, res) {
      if (err) return cb('Error checking word')

      if (res === 1) {
        io.sockets.in(room).emit('block', word, socket.id)
        return cb(null)
      }

      db.sadd([room, 'playedwords'].join(':'), word, checkAllWords)
    }

    function checkAllWords(err, res) {
      if (err) return cb('Error checking word')

      if (res === 0) {
        return cb('Word was already played')
      }


      var multi = db.multi()
      others.forEach(function (client) {
        multi.sadd([room, client.id, 'currentwords'].join(':'), word)
      })
      multi.exec(function (err) {
        io.sockets.in(room).emit('attack', word, socket.id)
      })

      cb(null)
    }

  })
}
