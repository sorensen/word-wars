
/*!
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , Proxy = require('./proxy')
  , Player = require('./player')
  , concat = Array.prototype.concat
  , slice = Array.prototype.slice

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
  // Internal data storage
  this.attributes = {
    name: 'anonymous'
  }
  this.player = new Player({
    id: this.sid
  }, this)

  // Client to server socket events
  this.proxies = {
    getSession: 'getSession'
  , setName: 'setName'
  , getScores: 'getScores'
  , setScore: 'setScore'
  , getRooms: 'getRooms'
  , join: 'join'
  , leave: 'leave'
  , sit: 'sit'
  , playerReady: 'ready'
  , stand: 'stand'
  , attack: 'receiveWord'
  }
  // Bind all socket events to a method of the same name
  Proxy.setup(this, this.proxies, socket)
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
  return this.attributes
}

/**
 * Convert to serialized string
 *
 * @return {String} json stringified
 */

Client.prototype.toString = function() {
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
 * @param {String} property name
 * @param {Any} property value
 */

Client.prototype.set = function(prop, val) {
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
 * Save attributes to redis
 *
 * @param {Function} callback
 */

Client.prototype.save = function(next) {
  var self = this
  this.db.SET('sess:' + this.sid, this.toString(), function(err) {
    self.emit('saved')
    next && next()
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
 * Ready for game to start
 *
 * @param {String} room id
 * @param {Function} callback
 */

Client.prototype.ready = function(id, next) {
  if (!this.room || !this.room.isSitting(this)) {
    return next && next('Not sitting in room')
  }
}

/**
 * Leave current room
 *
 * @param {Function} callback
 */

Client.prototype.leave = function(next) {
  var self = this
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
  this.room = room
  this.socket.join(room.id)
  return this
}

/*!
 * Module exports.
 */

 module.exports = Client
