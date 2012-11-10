var dictionary = require('./dictionary')
  , app, io, db

module.exports = function (app) {
  io = app.settings.io
  db = app.settings.db
  io.sockets.on('connection', ioMain)
}

function ioMain(socket) {
  var session = socket.handshake.session

  socket.on('join', function (room, cb) {
    var clients = io.sockets.clients(room)

    console.log('join; ', room, clients)
    if (clients.length === 2) return cb('Room is full')

    socket.join(room)
    io.sockets.in(room).emit('join', socket.id)
  })

  socket.on('leave', function (room) {
    socket.leave(room)
    clearRoom(room, socket)
  })

  socket.on('attack', function (word, cb) {
    var rooms = io.sockets.manager.roomClients[socket.id]
      , others = io.sockets.clients('test')
      , room = Object.keys(rooms)[1]

    console.log('attack: ', word, room)

    if (!room) {
      return cb('Not in a room')
    }

    room = room.slice(1)

    others = others.filter(function (client) {
      return client.id !== socket.id
    })

    word = word.toUpperCase()

    if (dictionary[word] !== 0) {
      return cb('Invalid word')
    }

    db.srem([room, 'currentwords'].join(':'), socket.id + word, checkPlayerWords)

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
        multi.sadd([room, 'currentwords'].join(':'), client.id + word)
      })
      multi.exec(function (err) {
        console.log('checkAllWords: ', err, word, socket.id)
        io.sockets.in(room).emit('attack', word, socket.id)
      })

      cb(null)
    }

  })

  socket.on('disconnect', function () {
    var rooms = io.sockets.manager.roomClients[socket.id]
      , room = Object.keys(rooms)[1]

    if (!room) {
      return false
    }

    room = room.slice(1)

    clearRoom(room, socket)
  })

}

function clearRoom(room, socket) {
  io.sockets.in(room).emit('leave', socket.id)
  var multi = db.multi()
  multi.del([room, 'currentwords'].join(':'))
  multi.del([room, 'playedwords'].join(':'))
  multi.exec()
}
