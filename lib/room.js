
/*!
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , Computer = require('./computer')
  , Client = require('./client')
  , Player = require('./player')
  , utils = require('./utils')
  , maxWords = 10

/**
 * Room constructor
 *
 * @param {Object} redis connection object
 * @param {Object} room id
 * @inherits EventEmitter
 */

function Room(db, io, id, options) {
  this.db = db
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
    this.id = this.idGenerator(options.isPrivate)
  }
}

/*!
 * Inherit from EventEmitter.
 */

Room.prototype.__proto__ = EventEmitter.prototype

/**
 * Generate an ID
 *
 * @return {String} id
 */

Room.prototype.idGenerator = function() {
  var id ('0000' + (Math.random() * Math.pow(36, 4) << 0).toString(36)).substr(-4)
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
 * Broadcast to all connected clients in room
 *
 * @param {String} event name
 * @param {...} additional args to be sent
 */

Room.prototype.broadcast = function() {
  var chan = this.io.sockets.in(this.id)
  chan.emit.apply(chan, arguments)
  return this
}

/**
 * Convert to plain javascript object
 *
 * @return {Object} js object
 */

Room.prototype.toObject = function() {
  return {
    id: this.id
  , players: this.players
  , watchers: this.watchers
  , playedWords: this.playedWords
  , currentWords: this.currentWords
  , playing: this.playing
  , isPrivate: this.isPrivate()
  }
}

/**
 * Load room information from redis
 *
 * @param {Function} callback
 */

Room.prototype.load = function(next) {
  var self = this
  this.loadCurrentPlayers(function() {
    self.loadCurrentWords(function() {
      self.loadPlayedWords(function() {
        next && next()
      })
    })
  })
  return this
}

/**
 * 
 * 
 * @param {Function} callback
 */

Room.prototype.loadCurrentPlayers = function(next) {
  var self = this
  this.db.HGETALL(this.id + ':currentplayers', function(err, resp) {
    if (err) return next && next('Error loading current players')
    if (!resp) return next && next({})

    self.players = Player.parse(resp)
    next && next(self.players)
  })
  return this
}

/**
 * 
 * 
 * @param {Function} callback
 */

Room.prototype.saveCurrentPlayers = function(next) {
  var data = {}
  for (var id in this.players) {
    data[id] = this.players[id].toString()
  }
  this.db.HMSET(this.id + ':currentplayers', data, function(err) {
    next && next()
  })
  return this
}

/**
 * Load and parse words from redis
 *
 * @param {String} key name
 * @param {Function} callback
 * @api private
 */

Room.prototype._loadWords = function(key, next) {
  var self = this
  this.db.SMEMBERS(this.id + ':' + key, function(err, resp) {
    if (err || !resp) return next && next()
    next && next(Word.parse(resp, true))
  })
  return this
}

/**
 * Load current game words
 *
 * @param {Function} callback
 */

Room.prototype.loadCurrentWords = function(next) {
  return this._loadWords('currentwords', next)
}

/**
 * Load all played game words
 *
 * @param {Function} callback
 */

Room.prototype.loadPlayedWords = function() {
  return this._loadWords('playedwords', next)
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
 * 
 * 
 * @param {Player} joining player
 * @param {Function} callback
 */

Room.prototype.join = function(player, next) {
  var self = this
  if (!this.watchers[player.id]) {
    this.watchers[player.id] = player
    player.room = this
    
    player.on('quit', function() {
      self.leave(player)
    })
  }
  next && next()
  return this
}

/**
 * 
 * 
 * @return {String|null} open seat name
 */

Room.prototype.getOpenSeat = function() {
  var taken = []
  for (var id in this.players) {
    var player = this.players[id]
    take.push(player.get('seat'))
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
 * 
 * 
 * @param {Player} sitting player
 * @param {Function} callback
 */

Room.prototype.sit = function(player, next) {
  var seat = this.getOpenSeat()
  if (!seat) {
    return next && next('No seats available')
  }
  this.players[player.id] = player
  player.set('seat', seat)
  next && next()
  return this
}

/**
 * 
 * 
 * @param {Player} standing player
 * @param {Function} callback
 */

Room.prototype.stand = function(player, next) {
  var self = this
    , pid = player.id
    , sitting = this.isSitting(player)

  function callback() {
    self.resetReady(function() {
      delete this.players[pid]
      this.broadcast('stood', pid)
      next && next()
    })
  }
  player
    .seat('ready', false)
    .set('seat', null)

  if (this.playing && sitting) {
    return this.over(null, callback)
  }
  callback()
  return this
}

/**
 * 
 * 
 * @param {Player} leaving player
 * @param {Function} callback
 */

Room.prototype.leave = function(player, next) {
  var pid = player.id

  function callback() {
    delete this.players[pid]
    delete this.watchers[pid]
    this.broadcast('left', pid)
    next && next()
  }
  if (this.isSitting(player) {
    return this.stand(player, function() {
      callback()
    })
  })
  callback()
  return this
}

/**
 * 
 * 
 * @param {Player} player to check against
 */

Room.prototype.isSitting = function(player) {
  return this.players && this.players[player.id]
}

/**
 * 
 * 
 * @param {Player} sitting player
 */

Room.prototype.getOpponent = function(player) {
  for (var id in this.players) {
    if (id !== player.id) {
      return this.players[id]
    }
  }
  return null
}

/**
 * 
 * 
 * @param {Player} ready player
 * @param {Function} callback
 */

Room.prototype.ready = function(player, next) {
  var self = this
    , opponent

  if (!this.isSitting(player)) {
    return next && next('Player is not sitting in this room')
  }
  player.set('ready', true)
  this.saveCurrentPlayers(function() {
    self.broadcast('ready', player.id)
    next && next()

    opponent = self.getOpponent(player)
    if (opponent.get('ready')) {
      self.startGame()
    }
  })
  return this
}

/**
 * Receive word
 *
 * @param {Client} client connection object
 * @param {String} word
 * @param {Function} callback
 */

Room.prototype.receiveWord = function(player, word, next) {
  var self = this
    , players = this.players
    , opponent = this.getOpponent(player)
    , word = new Word(word.toUpperCase(), sid)

  if (!players) {
    return next && next('No players in this room')
  }
  if (!word.isValid()) {
    return next && next('Invalid word')
  }
  // Check for blocking word
  this.db.SREM(this.id + ':currentwords', word.toString(), function(err, count) {
    if (err) return next && next('Error checking word')
    if (count > 0) return self.block(player, word, next)
    self.attack(word, player, opponent, next)
  })
  return this
}

/**
 * A player has attacked an oppponent
 *
 * @param {Word} word instance
 * @param {Player} attacker
 * @param {Player} defender
 * @param {Function} callback
 * @param {Boolean} computer generated attack
 */

Room.prototype.attack = function(word, attacker, defender, next, auto) {
  var self = this
    , len

  word.pid = defender.id

  this.getCurrentWords(function(words) {
    len = words[defender] ? words[defender].length : 0
    if (auto && len >= 5) {
      return next && next()
    }
    self.db.SADD(self.id + ':playedword', word.toString(), function(err, count) {
      if (err) return next && next('Error checking word')
      if (count === 0) return next && next('Word was already played')
      len += 1
      self.db.SADD(self.id + ':currentwords', word.toString(), function(err) {
        // Check for win condition
        if (len > maxWords) {
          return self.gameOver(attacker, next)
        }
        self.broadcast('attack', word.word, attacker)
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

Room.prototype.block = function(player, word, next) {
  this.broadcast('block', word.word, player.id)
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

/**
 * Start the game
 */

Room.prototype.startGame = function() {
  var self = this
  this.broadcast('start')
  this.computerTick = setTimeout(function() {
    self.computer.start()
    self.computerTick = null
  }, 4 * 1000)
  return this
}

/**
 * The game has ended
 *
 * @param {Player} winning player
 * @param {Function} callback
 */

Room.prototype.gameOver = function(winner, next) {
  this.computerTick && clearTimeout(this.computerTick)
  this.computer.stop()
  winner
    ? this.broadcast('won', winner.id)
    : this.broadcast('over')
  
  next && next()
  return this
}

/*!
 * Module exports.
 */

module.exports = Room
