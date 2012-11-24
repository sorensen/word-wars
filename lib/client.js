
/*!
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , Proxy = require('./proxy')
  , Player = require('./player')
  , bcrypt = require('bcrypt')
  , uuid = require('node-uuid')
  , concat = Array.prototype.concat
  , slice = Array.prototype.slice
  , toString = Object.prototype.toString
  , noop = function(){}

/**
 * Client constructor.
 *
 * @param {Object} redis connection object
 * @param {Object} socket.io connection
 * @inherits EventEmitter
 * @event `loaded`: Emitted after attributes have been set from redis
 * @event `saved`: Emitted after attributes have been saved to redis
 */

function Client(db, socket) {
  this.db = db
  this.socket = socket
  this.session = socket.handshake.session
  this.sid = this.session.id
  this.attributes = {
    name: 'anonymous'
  }
  this.floodCount = 0

  // Player instance to be used for games
  this.player = new Player({
    id: this.sid
  }, this)

  // Client to server socket events
  this.proxies = {
    getSession: 'getSession'
  , setName: 'setName'
  , getRooms: 'getRooms'
  , leave: 'leave'
  , sit: 'sit'
  , playerReady: 'ready'
  , stand: 'stand'
  , sendWord: 'receiveWord'
  , login: 'authenticate'
  , createAccount: 'create'
  }
  socket.on('sit', function() {
    console.log('direct sit')
  })
  // Bind all socket events to a method of the same name
  Proxy.setup(this, this.proxies, this.socket)
}

/**
 * Check if attributes are valid for saving
 *
 * @param {Object} client attributes
 * @param {Function} callback
 */

Client.isValid = function(attr, next) {
  next || (next = noop)
  if (!attr.username) return next('Username required')
  if (!attr.hash && !attr.password) return next('Password required')
  if (!attr.id) {
    this.db.EXISTS('users: ', attr.username, function(err, exists) {
      if (err) return next(err)
      if (exists) return next('Username taken')
      next()
    })
  }
  return this
}

/**
 * Retrieve a stored client and authenticate
 *
 * @param {String} username
 * @param {String} password
 * @param {Function} callback
 */

Client.authenticate = function(username, password, next) {
  this.db.HGETALL('users:' + username, function(err, data) {
    var client = new Client(data)
    client.authenticate(password, function(err) {
      if (err) return next && next(err)
      next && next(client)
    })
  })
  return this
}

/*!
 * Inherit from EventEmitter.
 */

Client.prototype.__proto__ = EventEmitter.prototype

/**
 * Convert to plain javascript object
 *
 * @return {Object} js object
 */

Client.prototype.toObject = function() {
  var data = this.attributes
  data.id = this.sid
  return data
}

/**
 * Convert to serialized string
 *
 * @return {String} json stringified
 */

Client.prototype.toRedis = function() {
  return JSON.stringify(this.toObject())
}

/**
 * Return all rooms client is currently in
 *
 * @return {Object} socket.io room and client object
 */

Client.prototype.getRooms = function() {
  return io.sockets.manager.roomClients[self.socket.id]
}

/**
 * Get a storable attribute
 *
 * @param {String} property name
 */

Client.prototype.get = function(prop) {
  return this.attributes[prop]
}

/**
 * Set a storable attribute
 *
 * @param {String|Object} property name or mapping
 * @param {Any} property value
 */

Client.prototype.set = function(prop, val) {
  if (toString.call(prop) === '[object Object]') {
    for (var name in prop) {
      this.attributes[name] = prop[name]
    }
  }
  this.attributes[prop] = val
  return this
}

/**
 * Load attributes from redis
 *
 * @param {Function} callback
 */

Client.prototype.load = function(next) {
  var self = this
  this.db.GET('sess:' + this.sid, function(err, sess) {
    self.attributes = JSON.parse(sess)
    self.emit('loaded')
    next && next()
  })
  return this
}

/**
 * Set the client name
 *
 * @param {String} name
 * @param {Function} callback
 */

Client.prototype.setName = function(name, next) {
  this.set('name', name)
  this.save(function() {
    next && next()
  })
  return this
}

/**
 * Check if instance is valid
 *
 * @param {Function} callback
 */

Client.prototype.isValid = function(next) {
  return Client.isValid(this.attributes, next)
}

/**
 * Save attributes to redis
 *
 * @param {Function} callback
 */

Client.prototype.save = function(next) {
  var self = this
    , len = this.username ? 2 : 1
  
  function callback(err) {
    if (!--len) {
      self.emit('saved')
      next && next()
    }
  }
  this.db.SET('sess:' + this.sid, this.toRedis(), callback)
  if (this.username) {
    this.db.HMSET('users:' + this.username, this.toObject(), callback)
  }
  return this
}

/**
 * Create / save the client object, persisting as a user
 *
 * @param {Object} attributes
 * @param {Function} callback
 */

Client.prototype.create = function(attr, next) {
  var self = this

  Client.isValid(attr, function(err) {
    if (err) return next && next(err)

    this.id = uuid.v4()
    this.setPassword(attr.password, function() {
      delete attr.password
      self.attributes = attr
      this.save(function() {
        next && next()
      })
    })
  })
  return this
}

/**
 * Get session information for client
 *
 * @param {Function} callback
 */

Client.prototype.getSession = function(next) {
  var self = this
  this.load(function() {
    next && next(null, self.toObject())
  })
  return this
}

/**
 * Hash and set a password using bcrypt
 *
 * @param {String} password
 * @param {Function} callback
 */

Client.prototype.setPassword = function(password, next) {
  var self = this
  bcrypt.genSalt(10, function(err, salt) {
    if (err) return next && next(err)
    bcrypt.hash(password, salt, function(err, hash) {
      if (err) return next && next(err)
      self.hash = hash
      next && next()
    })
  })
  return this
}

/**
 * Authenticate the current client by password
 *
 * @param {String} password
 * @param {Function} callback
 */

Client.prototype.authenticate = function(password, next) {
  var self = this
  if (!password || !this.hash) {
    return next && next('Missing parameters')
  }
  bcrypt.compare(password, this.hash, function(err, valid) {
    if (err) return next && next(err)
    if (valid) return next && next(null, self)
    next('Invalid password')
  })
  return this
}

/**
 * Ready for game to start
 *
 * @param {String} room id
 * @param {Function} callback
 */

Client.prototype.ready = function(next) {
  var player = this.player
  next || (next = noop)
  if (!this.room || !this.room.isSitting(player)) {
    next('Not sitting in room')
    return this
  }
  this.room.ready(player, next)
  return this
}

/**
 * Leave current room
 *
 * @param {Function} callback
 */

Client.prototype.leave = function(next) {
  var self = this
  if (!this.room) {
    return next && next('Not in a room')
  }
  this.room.leave(this.player, function() {
    self.socket.leave(self.room.id)
    next && next()
  })
  return this
}

/**
 * Join a room
 *
 * @param {Room} room instance
 */

Client.prototype.join = function(room) {
  console.log('client join: ', room.id)
  this.room = room
  this.socket.join(room.id)
  return this
}

/**
 * Sit in room
 *
 * @param {Function} callback
 */

Client.prototype.sit = function(next) {
  console.log('client sit')
  if (!this.room) {
    return next && next('Not in a room')
  }
  this.room.sit(this.player, next)
  return this
}

/**
 * Stand from seat
 *
 * @param {Function} callback
 */

Client.prototype.stand = function(next) {
  if (!this.room) {
    return next && next('Not in a room')
  }
  this.room.stand(this.player, next)
  return this
}

/**
 * Receive a word for attacking or blocking
 *
 * @param {String} word
 * @param {Function} callback
 */

Client.prototype.receiveWord = function(word, next) {
  if (!this.room) {
    return next && next('Not in a room')
  }
  this.room.receiveWord(this.player, word, next)
  return this
}

/**
 * Check if client is flooding messages
 *
 * @return {Number} count
 */

Client.prototype.isFlooded = function() {
  return this.floodCount > 20
}

/**
 * Increment the flood counter, remove after delay
 */

Client.prototype.floodTick = function() {
  var self = this
  this.floodCount += 1
  if (this.isFlooded()) {
    // Penalize for flooding
    setTimeout(function() {
      self.floodCount = 0
    }, this.floodCount * 1000)
  } else {
    setTimeout(function() {
      self.floodCount = Math.max(0, self.floodCount - 1)
    }, 500)
  }
  return this
}

/*!
 * Module exports.
 */

 module.exports = Client
