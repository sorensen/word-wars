
/*!
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , async = require('async')
  , dictionary = require('./dictionary')
  , Proxy = require('./proxy')
  , Scores = require('./scores')
  , io
  , db
  , User = require('../models/user')
  , Room = require('./room')
  , concat = Array.prototype.concat
  , slice = Array.prototype.slice

/**
 * Engine constructor
 *
 * @param {Object} redis connection object
 * @param {Object} socket.io server
 * @inherits EventEmitter
 * @event `ready`: Emitted after initial data is loaded
 */

function Engine() {
  var self = this

  User = User(db)
  Room = Room(db, io)

  this.db = db
  this.io = io
  this.users = {}
  this.sockets = {}
  this.rooms = {}
  this.socketRooms = this.io.sockets.manager.rooms
  this.proxies = {
    disconnect: 'disconnect'
  , auto: 'auto'
  , create: 'create'
  , play: 'play'
  , watch: 'watch'
  , message: 'message'
  }
  this.io.sockets.on('connection', this.userSetup.bind(this))

  this._loadAllRooms(function() {
    self.emit('ready')
  })
}

/*!
 * Inherit from EventEmitter.
 */

Engine.prototype.__proto__ = EventEmitter.prototype

/**
 * Broadcast to all connected users in server
 *
 * @param {String} event name
 * @param {...} additional args to be sent
 */

Engine.prototype.broadcast = function() {
  var socks = this.io.sockets
  socks.emit.apply(socks, arguments)
  return this
}

/**
 * Map object graph of instances to pure javascript objects
 *
 * @param {Object} mapping
 * @param {Boolean} convert to array
 * @return {Object|Array} mapped objects
 * @api private
 */

Engine.prototype._mapToObjects = function(objects, toArray) {
  var data = toArray ? [] : {}
  for (var key in objects) {
    if (toArray) {
      data.push(objects[key].toObject())
    } else {
      data[key] = objects[key].toObject()
    }
  }
  return data
}

/**
 * Create new player and attach events
 *
 * @param {Object} user socket.io connection
 */

Engine.prototype.userSetup = function(socket) {
  var sid = socket.handshake.session.id
    , self = this
    , user = this.users[sid]

  this.sockets[sid] = socket
  if (!user) {
    this.users[sid] = user = new User({}, sid)
  }
  user.getSession(function() {
    Proxy.setup(self, self.proxies, socket, user)
    self.bootstrap(user)
  })
  return this
}

/**
 * User disconnect, remove all references
 *
 * @param {User} user instance
 */

Engine.prototype.disconnect = function(user) {
  var sid = user.sid
  delete this.users[sid]
  return this
}

/**
 * User joined a room, create the room if needed
 *
 * @param {User} user instance
 * @param {String} room id
 * @param {Boolean} auto sit
 * @param {Function} callback
 * @api private
 */

Engine.prototype._join = function(user, id, sit, next) {
  var room = this.rooms[id]
    , socket = this.sockets[user.sid]

  if (!room || !id) {
    return next && next('Room could not be found')
  }
  socket.join(room.id)
  room.join(user, function(err) {
    // if (!sit) 
    return next && next(null, room.toObject())
    
    // @TODO
    // Currently the user sends another command to sit...
    room.sit(user, function() {
      // next && next(null, room.toObject())
    })
  })
  return this
}

/**
 * User attempt to auto join an open room
 * 
 * @param {User} user instance
 * @param {Function} callback
 */

Engine.prototype.auto = function(user, ignore, next) {
  for (var id in this.rooms) {
    var room = this.rooms[id]
      , len = Object.keys(room.players).length

    // Check for playing room and open seats
    if (room.playing || room.isPrivate() || len > 1) {
      continue
    }
    return this._join(user, room.id, true, next)
  }
  // Create a room if no open seats found
  return this.create(user, false, next)
}

/**
 * Create a new room
 * 
 * @param {User} user instance
 * @param {Boolean} private room
 * @param {Function} callback
 */

Engine.prototype.create = function(user, isPrivate, next) {
  var room = new Room(io, null, {isPrivate: isPrivate})
    , self = this

  this.rooms[room.id] = room
  return this._join(user, room.id, true, next)
}

/**
 * Join a room to play
 * 
 * @param {User} user instance
 * @param {String} room id
 * @param {Function} callback
 */

Engine.prototype.play = function(user, id, next) {
  return this._join(user, id, true, next)
}

/**
 * Watch a game by joining a room
 * 
 * @param {User} user instance
 * @param {String} room id
 * @param {Function} callback
 */

Engine.prototype.watch = function(user, id, next) {
  return this._join(user, id, false, next)
}

/**
 * Load all active players
 *
 * @param {Function} callback
 */

Engine.prototype.loadActiveUsers = function(next) {
  next && next(this.users)
  return this
}

/**
 * Get active connections in a room
 *
 * @param {String} room id
 */

Engine.prototype.getUsers = function(roomId) {
  return this.socketRooms['/' + roomId]
}

/**
 * Load all active rooms
 *
 * @param {Function} callback
 * @api private
 */

Engine.prototype._loadAllRooms = function(next) {
  var self = this
    , rooms = Object.keys(this.socketRooms)
    , len = rooms.length

  function callback() {
    --len || next(self.rooms)
  }
  rooms.forEach(function(id) {
    if (!id || id === '') {
      return callback()
    }
    self.rooms[id] = new Room(self.db, self.io, id).load(callback)
  })
}

/**
 * Bootstrap the user with initial data
 *
 * @param {Player} player object to send to
 */

Engine.prototype.bootstrap = function(user) {
  var self = this
    , socket = this.sockets[user.sid]

  socket.emit('session', user.toObject())

  this.loadActiveUsers(function(users) {
    socket.emit('users', self._mapToObjects(users))
  })
  this._loadAllRooms(function(rooms) {
    socket.emit('rooms', self._mapToObjects(rooms, true))
  })
  return this
}

/**
 * Send current public room information to all connected users
 *
 * @param {Room} single room instance to send (optional)
 */

Engine.prototype.sendRooms = function(room) {
  var data = []
  if (room && !room.isPrivate()) {
    return this.broadcast('rooms', room.toObject())
  }
  for (var id in this.rooms) {
    var room = this.rooms[id]
    if (room.isPrivate()) {
      continue
    }
    data.push(room.toObject())
  }
  return this.broadcast('rooms', data)
}

/**
 * User has sent a message
 *
 * @param {User} sender
 * @param {String} message
 */

Engine.prototype.message = function(user, msg) {
  if (!user.isFlooded()) {
    this.broadcast('message', user.toObject(), msg) 
    user.floodTick()
  }
  return this
}

/*!
 * Module exports.
 */

module.exports = function(con, socket) {
  if (!con) {
    throw new Error('Redis DB connection required')
  }
  if (!socket) {
    throw new Error('Socket.io manager required')
  }
  db || (db = con)
  io || (io = socket)
  return Engine
}
