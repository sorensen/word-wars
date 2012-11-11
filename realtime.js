
var dictionary = require('./dictionary')
  , async      = require('async')
  , app, io, db

module.exports = function (app) {
  io = app.settings.io
  db = app.settings.db
  io.sockets.on('connection', ioMain)
}

function ioMain(socket) {
  var session = socket.handshake.session

  socket.on('getRooms', function (cb) {
    getRooms(function (err, rooms) {
      console.log(rooms)
      cb(rooms)
    })
  })

  socket.on('join', function (room, cb) {
    if (room) {
      socket.join(room)
      db.sadd('currentrooms', room)
      return io.sockets.in(room).emit('join', socket.id)
    }

    getRooms(function (err, rooms) {
      var joinableRooms = rooms.filter(function (room) {
        return room.players.length < 2
      })

      if (joinableRooms.length === 0) {
        room = ("0000" + (Math.random()*Math.pow(36,4) << 0).toString(36)).substr(-4)
        socket.join(room)
        db.sadd('currentrooms', room)
        return cb(null, room)
      }

      room = rooms[Math.floor(Math.random()*rooms.length)]
      socket.join(room.id)
      return io.sockets.in(room.id).emit('join', socket.id)
    })
  })

  socket.on('leave', function (room, cb) {
    console.log('LEAVE', room)
    socket.leave(room)
    stand(room, socket)
  })

  socket.on('sit', function (room, cb) {
    var key = [room, 'currentplayers'].join(':')
      , first = false

    db.scard(key, gotSitting)

    function gotSitting(err, length) {
      if (length >= 2) return cb('There are no seats left')

      if (length === 0) first = true

      db.sadd(key, socket.id, addedSitter)
    }

    function addedSitter(err, res) {
      if (res === 0) return cb('You are already sitting')

      io.sockets.in(room).emit('sat', socket.id, first ? 'red' : 'blue')
      // if (!first) startGame(room)
      cb()
    }
  })

  socket.on('playerReady', function (room, cb) {

  })

  socket.on('stand', function (room, cb) {
    stand(room, socket, cb)
  })

  socket.on('attack', function (word, cb) {
    var rooms = io.sockets.manager.roomClients[socket.id]
      , room = Object.keys(rooms)[1]

    if (!room) {
      return cb('Not in a room')
    }

    room = room.slice(1)

    var others = io.sockets.clients(room)

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


      var othersArray = others.map(function (client) {
        return client.id + word
      })
      var multi = db.multi()
      multi.sadd([room, 'currentwords'].join(':'), othersArray)
      multi.exec(function (err) {
        console.log('checkAllWords: ', err, word, socket.id)
        io.sockets.in(room).emit('attack', word, socket.id)
      })

      cb(null)
    }

  })

  socket.on('disconnect', function () {
    var rooms = io.sockets.manager.roomClients[socket.id]

    Object.keys(rooms).forEach(function (room) {
      if (room === '') return

      stand(room, socket)
    })

  })

}

function getRooms(cb) {
  var rooms = Object.keys(io.sockets.manager.rooms).filter(function (room) {
    return room && room !== ''
  })

  async.map(rooms, iterate, cb)

  function iterate(room, callback) {
    console.log(room)
    room = room.slice(1)

    var roomObj = {
        id: room
      , clients: io.sockets.manager.rooms['/' + room]
    }
    
    db.smembers([room, 'currentplayers'].join(':'), gotPlayers)

    function gotPlayers(err, players) {
      roomObj.players = players
      
      callback(null, roomObj)
    }
  }
}

function stand(room, socket, cb) {
  var key = [room, 'currentplayers'].join(':')

  db.srem(key, socket.id, removedSitting)

  function removedSitting(err, res) {
    if (res === 0) return cb && cb('Not sitting in that room')

    io.sockets.in(room).emit('stood', socket.id)
    clearRoom(room, socket)
    cb && cb()
  }
}

function startGame(room) {
  io.sockets.in(room).emit('start')
}

function endGame(room) {
  io.sockets.in(room).emit('over')
}

function clearRoom(room) {
  var multi = db.multi()
  multi.del([room, 'currentwords'].join(':'))
  multi.del([room, 'playedwords'].join(':'))
  multi.exec(function () {
    endGame(room)
  })
}
