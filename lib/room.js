
/*!
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , Computer = require('./computer')
  , Word = require('./word')
  , utils = require('./utils')
  , maxWords = 10
  , db
  , io
  , User = require('../models/user')(db)

/**
 * Room constructor
 *
 * @param {Object} redis connection object
 * @param {Object} room id
 * @inherits EventEmitter
 */

function Room(io, id, options) {
  this.io = io
  this.options = options || {}
  this.id = id
  
  this.players = {}
  this.watchers = {}
  this.playedWords = {}
  this.currentWords = {}
  this.playing = false
  this.computer = new Computer(this)

  if (!id) {
    this.id = this.idGenerator(this.options.isPrivate)
  }
}

/*!
 * Inherit from EventEmitter.
 */

Room.prototype.__proto__ = EventEmitter.prototype

/**
 * Generate an ID
 *
 * @param {Boolean} private room
 * @return {String} id
 */

Room.prototype.idGenerator = function(isPrivate) {
  var id = ('0000' + (Math.random() * Math.pow(36, 4) << 0).toString(36)).substr(-4)
  isPrivate && (id += '_private')
  return id
}

/**
 * Determine if room is private
 *
 * @return {Boolean} private room
 */

Room.prototype.isPrivate = function() {
  return this.options.isPrivate || !!~this.id.indexOf('_private')
}

/**
 * Broadcast to all connected users in room
 *
 * @param {String} event name
 * @param {...} additional args to be sent
 */

Room.prototype.broadcast = function() {
  var chan = io.sockets.in(this.id)
  chan.emit.apply(chan, arguments)
  return this
}

/**
 * Map object graph of instances to pure javascript objects
 *
 * @param {Object} mapping
 * @api private
 */

Room.prototype._mapToObjects = function(objects) {
  var data = {}
  for (var key in objects) {
    data[key] = objects[key].toObject()
  }
  return data
}

/**
 * Convert to plain javascript object
 *
 * @return {Object} js object
 */

Room.prototype.toObject = function() {
  return {
    id: this.id
  , players: this._mapToObjects(this.players)
  , watchers: this._mapToObjects(this.watchers)
  , playedWords: this._mapToObjects(this.playedWords)
  , currentWords: this._mapToObjects(this.currentWords)
  , playing: this.playing
  , isPrivate: this.isPrivate()
  }
}

/**
 * Load current game words
 *
 * @param {Function} callback
 */

Room.prototype.loadCurrentWords = function(next) {
  var self = this
  this.db.SMEMBERS(this.id + ':currentwords', function(err, resp) {
    if (err || !resp) return next && next()
    next && next(Word.parse(resp, true))
  })
  return this
}

/**
 * Remove `ready` from all sitting players
 *
 * @param {Function} callback
 */

Room.prototype.resetReady = function(next) {
  var self = this
    , data = {}

  for (var id in this.players) {
    this.players[id].ready = false
  }
  return this.saveCurrentPlayers(function() {
    self.broadcast('unready')
    next && next()
  })
}

/**
 * Join the room and setup player events
 * 
 * @param {User} joining player
 * @param {Function} callback
 */

Room.prototype.join = function(user, next) {
  console.log('join: ', user)
  var self = this
  if (!this.watchers[user.id]) {
    this.watchers[user.id] = user
    user.room = this
    
    user.on('quit', function() {
      self.leave(user)
    })
    this.broadcast('joined', user.toObject())
  }
  next && next()
  return this
}

/**
 * Find open seats in game
 * 
 * @return {String|null} open seat name
 */

Room.prototype.getOpenSeat = function() {
  var taken = []
  for (var id in this.players) {
    var player = this.players[id]
    taken.push(player.get('seat'))
  }
  if (!taken.length) {
    return 'red'
  }
  if (taken.length === 1) {
    return taken.pop() === 'red' ? 'blue' : 'red'
  }
  return null
}

/**
 * Sit in game if able
 * 
 * @param {User} sitting player
 * @param {Function} callback
 */

Room.prototype.sit = function(user, next) {
  var seat = this.getOpenSeat()
  if (!seat) {
    return next && next('No seats available')
  }
  this.players[user.id] = user
  user.set('seat', seat)
  this.broadcast('sat', user.id, seat)
  next && next()
  return this
}

/**
 * Stand from the game if sitting
 * 
 * @param {User} standing player
 * @param {Function} callback
 */

Room.prototype.stand = function(user, next) {
  var self = this
    , pid = user.id
    , sitting = this.isSitting(user)

  function callback() {
    self.resetReady(function() {
      delete self.players[pid]
      self.broadcast('stood', pid)
      next && next()
    })
  }
  user
    .set('ready', false)
    .set('seat', null)

  if (this.playing && sitting) {
    return this.over(null, callback)
  }
  callback()
  return this
}

/**
 * Leave the room
 * 
 * @param {User} leaving player
 * @param {Function} callback
 */

Room.prototype.leave = function(user, next) {
  var self = this
    , pid = user.id

  function callback() {
    delete self.players[pid]
    delete self.watchers[pid]
    self.broadcast('left', pid)
    next && next()
  }
  if (this.isSitting(user)) {
    return this.stand(user, function() {
      callback()
    })
  }
  callback()
  return this
}

/**
 * Check if player is sitting in room
 * 
 * @param {User} player to check against
 */

Room.prototype.isSitting = function(user) {
  return this.players && this.players[user.id]
}

/**
 * Find a players opponent
 * 
 * @param {User} sitting player
 */

Room.prototype.getOpponent = function(user) {
  for (var id in this.players) {
    if (id !== user.id) {
      return this.players[id]
    }
  }
  return null
}

/**
 * Set a player as ready
 * 
 * @param {User} ready player
 * @param {Function} callback
 */

Room.prototype.ready = function(user, next) {
  var self = this
    , opponent

  if (!this.isSitting(user)) {
    return next && next('Player is not sitting in this room')
  }
  user.set('ready', true)
  this.saveCurrentPlayers(function() {
    next && next()
    self.broadcast('ready', user.id)
    opponent = self.getOpponent(user)
    if (opponent && opponent.get('ready')) {
      self.startGame()
    }
  })
  return this
}

/**
 * Receive word
 *
 * @param {User} user connection object
 * @param {String} word
 * @param {Function} callback
 */

Room.prototype.receiveWord = function(user, word, next) {
  var self = this
    , users = this.players
    , opponent = this.getOpponent(user)
    , word = new Word(user.id, word)

  if (!users) {
    return next && next('No players in this room')
  }
  if (!word.isValid()) {
    return next && next('Invalid word')
  }
  user.playedWords += 1
  // Check for blocking word
  this.db.SREM(this.id + ':currentwords', word.toRedis(), function(err, count) {
    if (err) return next && next('Error checking word')
    if (count > 0) return self.block(user, word, next)
    self.attack(word, user, opponent, next)
  })
  return this
}

/**
 * A player has attacked an oppponent
 *
 * @param {Word} word instance
 * @param {User} attacker
 * @param {User} defender
 * @param {Function} callback
 * @param {Boolean} computer generated attack
 */

Room.prototype.attack = function(word, attacker, defender, next, auto) {
  var self = this
    , len

  word.pid = defender.id

  this.loadCurrentWords(function(words) {
    len = words[defender.id] ? words[defender.id].length : 0
    if (auto && len >= 5) {
      return next && next()
    }
    self.db.SADD(self.id + ':playedword', word.toRedis(), function(err, count) {
      if (err) return next && next('Error checking word')
      if (count === 0) return next && next('Word was already played')
      len += 1
      self.db.SADD(self.id + ':currentwords', word.toRedis(), function(err) {
        // Check for win condition
        if (len > maxWords) {
          return self.gameOver(attacker, next)
        }
        self.broadcast('attack', word.word, attacker.id)
        next && next(null)
      })
    })
  })
  return this
}

/**
 * Player has blocked a word
 *
 * @param {Plyaer} blocking player
 * @param {Word} word instance
 * @param {Function} callback
 */

Room.prototype.block = function(user, word, next) {
  this.broadcast('block', word.word, user.id)
  next && next(null)
  return this
}

/**
 * Clear all room data
 *
 * @param {Function} callback
 */

Room.prototype.clear = function(next) {
  this.computer.stop()
  this.players = {}
  this.watchers = {}
  this.playedWords = {}
  this.currentWords = {}
  this.playing = false
  this.db
    .MULTI()
    .DEL(this.id + ':currentwords')
    .DEL(this.id + ':playedwords')
    .EXEC(function() {
      next && next()
    })
  return this
}

Room.prototype.calculateWPM = function(next) {
  if (!this.startTime) {
    return this
  }
  var time = (utils.timestamp() - this.startTime) / MINUTE
    , len = Object.keys(this.players).length

  function callback() {
    --len || (next && next())
  }
  for (var id in this.players) {
    var player = this.players[id]
      , wpm = Math.round(player.playedWords / time)

  }
  return this
}

/**
 * Start the game
 */

Room.prototype.startGame = function() {
  var self = this
  this.broadcast('start')
  this.startTime = utils.timestamp()
  this.computerTick = setTimeout(function() {
    self.computer.start()
    self.computerTick = null
  }, 4 * 1000)
  return this
}

/**
 * The game has ended
 *
 * @param {User} winning player
 * @param {Function} callback
 */

Room.prototype.gameOver = function(winner, next) {
  this.computerTick && clearTimeout(this.computerTick)
  this.computer.stop()
  this.calculateWPM()
  this.startTime = null
  winner
    ? this.broadcast('won', winner.id)
    : this.broadcast('over')
  
  next && next()
  return this
}

/*!
 * Module exports.
 */

module.exports = function(con, socket) {
  db || (db = con)
  io || (io = socket)
  return Room
}
