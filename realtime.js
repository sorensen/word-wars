
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
      cb(rooms)
    })
  })

  socket.on('join', function (room, cb) {
    if (room) {
      getRoom(room, function (err, room) {
        socket.join(room.id)
        db.sadd('currentrooms', room.id)
        io.sockets.in(room.id).emit('join', socket.id)
        cb(null, room)
      })
      return
    }

    getRooms(function (err, rooms) {
      var joinableRooms = rooms.filter(function (room) {
        return room.players.length < 2
      })

      if (joinableRooms.length === 0) {
        room = ("0000" + (Math.random()*Math.pow(36,4) << 0).toString(36)).substr(-4)
        socket.join(room)
        db.sadd('currentrooms', room)
        return cb(null, {
            id: room
          , clients: [socket.id]
          , players: []
          , playedWords: []
        })
      }

      room = rooms[Math.floor(Math.random()*rooms.length)]
      socket.join(room.id)
      io.sockets.in(room.id).emit('join', socket.id)
      return cb(null, room)
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
      , color

    db.hlen(key, gotSitting)

    function gotSitting(err, length) {
      if (length >= 2) return cb('There are no seats left')

      if (length === 0) first = true

      color = first ? 'red' : 'blue'

      db.hset(key, socket.id, 'false:' + color, addedSitter)
    }

    function addedSitter(err, res) {
      if (res === 0) return cb('You are already sitting')

      io.sockets.in(room).emit('sat', socket.id, color)
      cb()
    }
  })

  socket.on('playerReady', function (room, cb) {
    var key = [room, 'currentplayers'].join(':')

    db.hgetall(key, getPlayers)

    function getPlayers(err, players) {
      if (!players || !players[socket.id]) return cb('Not sitting in room')

      var playersReady = false
        , player = players[socket.id].split(':')
        , playerKeys = Object.keys(players)
        , length = playerKeys.length
        , otherPlayer
        , otherKey

      playerKeys.forEach(function (key) {
        if (key !== socket.id) {
          otherPlayer = players[key].split(':')
          otherKey = key
        }
      })

      if (length === 2 && otherPlayer && otherPlayer[0] === 'true') {
        startGame(room)
        otherPlayer[0] = false
        return db.hset(key, otherKey, otherPlayer.join(':'), setReady)
      }

      player[0] = true
      db.hset(key, socket.id, player.join(':'), setReady)
    }

    function setReady(err) {
      io.sockets.in(room).emit('ready', socket.id)
      cb()
    }
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

    var key = [room, 'currentplayers'].join(':')
      , otherPlayer

    db.hkeys(key, gotPlayers)

    function gotPlayers(err, players) {
      if (!players) return cb('No players in this room')

      players.forEach(function (player) {
        if (player !== socket.id) otherPlayer = player
      })

      word = word.toUpperCase()

      if (dictionary[word] !== 0) {
        return cb('Invalid word')
      }

      db.srem([room, 'currentwords'].join(':'), socket.id + ':' + word, checkPlayerWords)

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

        var key = [room, 'currentwords'].join(':')
        db.multi()
          .sadd(key, otherPlayer + ':' + word)
          .smembers(key, gotCount)
          .exec()
      }

      function gotCount(err, words) {
        var length = 0
        words.forEach(function (word) {
          word = word.split(':')
          if (word[0] !== socket.id) length += 1
        })

        if (length > 10) {
          io.sockets.in(room).emit('won', socket.id)
          clearRoom(room)
        } else {
          io.sockets.in(room).emit('attack', word, socket.id)
        }
        cb(null)
      }
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

function winLose(room) {
}

function getRoom(room, cb) {
  var clients = io.sockets.manager.rooms['/' + room]
  var roomObj = {
      id: room
    , clients: clients ? clients : []
  }

  db.hgetall([room, 'currentplayers'].join(':'), gotPlayers)

  function gotPlayers(err, playersObj) {
    var players = []
    if (playersObj) {
      players = Object.keys(playersObj).map(function (key) {
        var data = playersObj[key].split(':')
        return {
            id: key
          , seat: data[1]
          , ready: data[0] === 'true' ? true : false
        }
      })
    }

    roomObj.players = players
    
    db.smembers([room, 'playedwords'].join(':'), gotPlayedWords)
  }

  function gotPlayedWords(err, words) {
    roomObj.playedWords = words ? words : []

    cb(null, roomObj)
  }
}

function getRooms(cb) {
  var rooms = Object.keys(io.sockets.manager.rooms).filter(function (room) {
    return room && room !== ''
  })

  async.map(rooms, iterate, cb)

  function iterate(room, callback) {
    room = room.slice(1)

    var roomObj = {
        id: room
      , clients: io.sockets.manager.rooms['/' + room]
      , playedWords: []
    }
    
    db.hgetall([room, 'currentplayers'].join(':'), gotPlayers)

    function gotPlayers(err, playersObj) {
      var players = []
      if (playersObj) {
        players = Object.keys(playersObj).map(function (key) {
          var data = playersObj[key].split(':')
          return {
              id: key
            , seat: data[1]
            , ready: data[0] === 'true' ? true : false
          }
        })
      }

      roomObj.players = players
      
      callback(null, roomObj)
    }
  }
}

function stand(room, socket, cb) {
  var key = [room, 'currentplayers'].join(':')

  db.hdel(key, socket.id, removedSitting)

  function removedSitting(err, res) {
    if (res === 0) return cb && cb('Not sitting in that room')

    io.sockets.in(room).emit('stood', socket.id)
    clearRoom(room, socket)
    cb && cb()
  }
}

function resetReady(room, cb) {
  var key = [room, 'currentplayers'].join(':')

  db.hgetall(key, getPlayers)

  function getPlayers(err, players) {
    Object.keys(players).forEach(function (key, i) {
      var player = players[key]
        , values = player.split(':')

      players[key] = false + ':' + values[1]
    })

    db.hmset(key, players, cb)
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
