
var dictionary = require('./dictionary')
  , async      = require('async')
  , app, io, db
  , redis = require('redis')

module.exports = function (app) {
  io = app.settings.io
  db = app.settings.db
  io.sockets.on('connection', ioMain)
}

var computer = {
    words : Object.keys(dictionary)
  , rooms : {}
  , length : 10
  , tick : function () {
      var me = this
        , rooms = Object.keys(me.rooms)

      var timeNow = new Date().getTime()

      rooms.forEach(function (room) {
        var started = me.rooms[room].started
        var thisTime = me.rooms[room].nextTime
        var nextAttackWave = 1000 * (5 - (timeNow - started) / 30000)
        var key = [room, 'currentplayers'].join(':')
        if (nextAttackWave < 1000) {
          nextAttackWave = 1000
        }
        var nextTime = new Date().getTime() + nextAttackWave
        if (new Date().getTime() > thisTime) {
          db.hkeys(key, gotUsers)
        }
        function gotUsers(err, users) {
          setTimeout(function () { 
            if (!me.rooms[room]) return
            autoAttack(room, me.word(), users[0], users[1])
            autoAttack(room, me.word(), users[1], users[0])
            me.rooms[room].nextTime = nextTime
          }, me.rooms[room].nextTime * 1000)
        }
      })
      function autoAttack(room, word, attacker, defender) {
        attack(room, word, attacker, defender, function (err) {
          if (err) autoAttack(room, word, attacker, defender)
        }, true)
      }
  }
  , beginAutoAttack : function (id) { 
      this.rooms[id] = { 
          started : new Date().getTime() 
        , nextTime : new Date().getTime() + 5 * 1000
      }
  } 
  , stopAutoAttack : function (id) { 
      delete this.rooms[id]
  }
  , word : function () {
      var randomWord = this.words[getRandomInt(0, this.words.length)]
      if (randomWord.length > this.length) 
        return this.word()
      else
        return randomWord
  }
}

setInterval(function () {
  computer.tick()
}, 500)

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ioMain(socket) {
  var session = socket.handshake.session

  socket.on('getSession', function (cb) {
    db.get('sess:' + session.id, function (err, sess) {
      sess = JSON.parse(sess)
      var user = {
        name : sess.name || 'anonymous'
      }
      cb(null, user)

      db.hset('players', socket.id, user.name, function(err) {
        sendPlayers()
      })
    })
  })

  socket.on('getPlayers', function(cb) {
    db.hgetall('players', function(err, players) {
      cb(players)
    })
  })

  function sendPlayers() {
    db.hgetall('players', function(err, players) {
      io.sockets.emit('players', players)
    })
  }

  socket.on('getScores', function (cb) {
    db.ZREVRANGEBYSCORE('highestScores', '+inf', '-inf', 'WITHSCORES LIMIT 0 10', function (err, replies) { 
      cb(replies)
    })
  })

  socket.on('setScore', function (name, score, cb) {
    db.zadd('highestScores', score, name, cb)
  })

  socket.on('setName', function (name, cb) {
    db.get('sess:' + session.id, function (err, user) {
      user = JSON.parse(user)
      user.name = name
      db.set('sess:' + session.id, JSON.stringify(user), function (err) {
        cb()
      })
      db.hset('players', socket.id, user.name, function(err) {
        sendPlayers()
      })
    })
  })

  socket.on('getRooms', function (cb) {
    getRooms(function (err, rooms) {
      cb(rooms)
    })
  })

  socket.on('join', function (room, priv, cb) {
    if (room) {
      getRoom(room, function (err, room) {
        socket.join(room.id)
        db.sadd('currentrooms', room.id)
        io.sockets.in(room.id).emit('join', socket.id)
        updateLobby()
        cb(null, room)
      })
      return
    }

    getRooms(function (err, rooms) {
      var joinableRooms = rooms.filter(function (room) {
        return room.players.length < 2
      })

      if (priv || joinableRooms.length === 0) {
        room = ("0000" + (Math.random()*Math.pow(36,4) << 0).toString(36)).substr(-4)
        if (priv) room += '_private'
        socket.join(room)
        updateLobby()
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
      updateLobby()
      return cb(null, room)
    })
  })

  socket.on('leave', function (room, cb) {
    socket.leave(room)
    stand(room, socket)
  })

  socket.on('sit', function (room, cb) {
    var key = [room, 'currentplayers'].join(':')
      , color = 'red'

    db.hgetall(key, gotSitting)

    function gotSitting(err, players) {
      if (players) {
        var playerKeys = Object.keys(players)
          , length = playerKeys.length
          , playerColor

        if (players[socket.id]) return cb('You are already sitting')

        if (length >= 2) return cb('There are no seats left')

        playerColor = players[playerKeys[0]].split(':')[1]

        color = playerColor === 'red' ? 'blue' : 'red'
      }

      db.hset(key, socket.id, 'false:' + color, addedSitter)
    }

    function addedSitter(err, res) {
      if (res === 0) return cb('You are already sitting')
      io.sockets.in(room).emit('sat', socket.id, color)
      updateLobby()
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

    db.hkeys(key, gotPlayers2)

    function gotPlayers2(err, players) {
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

        attack(room, word, socket.id, otherPlayer, cb)
      }

    }
  })

  socket.on('disconnect', function () {
    var rooms = io.sockets.manager.roomClients[socket.id]
    Object.keys(rooms).forEach(function (room) {
      if (room === '') return
      stand(room, socket)
    })
    db.hdel('players', socket.id)
  })
}

function attack(room, word, attacker, defender, cb, auto) {
  var key = [room, 'currentwords'].join(':')
    , length = 0
  db.smembers(key, gotCount)

  function gotCount(err, words) {
    words || (words = [])
    words.forEach(function (word) {
      word = word.split(':')
      if (word[0] !== attacker) length += 1
    })

    if (auto && length >= 8) return cb()

    db.sadd([room, 'playedwords'].join(':'), word, checkAllWords)
  }

  function checkAllWords(err, res) {
    if (err) return cb('Error checking word')

    if (res === 0) {
      return cb('Word was already played')
    }

    length += 1

    db.sadd(key, defender + ':' + word, addedWord)
  }

  function addedWord(err) {
    if (length > 10) {
      io.sockets.in(room).emit('won', attacker)
      clearRoom(room)
    } else {
      io.sockets.in(room).emit('attack', word, attacker)
    }
    cb(null)
  }
}

function getRoom(room, cb) {
  var clients = io.sockets.manager.rooms['/' + room]
  var roomObj = {
      id: room
    , clients: clients ? clients : []
    , players: []
    , playedWords: []
    , playing: false
  }

  if (!clients || clients.length === 0) {
    cb(null, roomObj)
  }

  db.multi()
    .hgetall([room, 'currentplayers'].join(':'))
    .smembers([room, 'currentwords'].join(':'))
    .exec(gotData)

  function gotData(err, data) {
    var players = []
      , playersObj = data[0]
      , words = data[1]
      , wordMap = {}

    if (words) {
      roomObj.playing = true
      words.forEach(function (word) {
        word = word.split(':')
        if (!wordMap[word[0]]) wordMap[word[0]] = []
        wordMap[word[0]].push(word[1])
      })
    }

    if (playersObj) {
      players = Object.keys(playersObj).map(function (key) {
        var data = playersObj[key]
        if (!data) {
          return {}
        }
        data = data.split(':')
        return {
            id: key
          , seat: data[1]
          , ready: data[0] === 'true' ? true : false
          , currentWords: wordMap[key] || []
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

function updateLobby () {
  getRooms(function (err, rooms) {
    io.sockets.emit('updateLobby', rooms)
  })
}

function getRooms(cb) {
  var rooms = Object.keys(io.sockets.manager.rooms).filter(function (room) {
    if (!room || room === '') return false

    if (room.slice(1).indexOf('_private') > -1) return false

    return true
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
  setTimeout(function () {
    computer.beginAutoAttack(room)
  }, 4 * 1000)
}

function endGame(room) {
  io.sockets.in(room).emit('over')
  computer.stopAutoAttack(room)
}

function clearRoom(room) {
  var multi = db.multi()
  multi.del([room, 'currentwords'].join(':'))
  multi.del([room, 'playedwords'].join(':'))
  multi.exec(function () {
    endGame(room)
    updateLobby()
  })
}

// Clear unused rooms from db
setInterval(function () {
  var multi = db.multi()

  db.smembers('currentrooms', gotRooms)

  function gotRooms(err, rooms) {
    async.forEach(rooms, iterate, done)
  }

  function iterate(room, cb) {
    var clients = io.sockets.manager.rooms['/' + room]
    if (!clients || clients.length === 0) {
      multi.del([room, 'currentwords'].join(':'))
      multi.del([room, 'playedwords'].join(':'))
      multi.del([room, 'currentplayers'].join(':'))
      multi.srem('currentrooms', room)
    }
    cb()
  }

  function done() {
    multi.exec()
  }
}, 10 * 60 * 1000)
