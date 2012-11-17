
/*!
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , async = require('async')
  , dictionary = require('./dictionary')
  , Player = require('./player')
  , Room = require('./room')
  , Proxy = require('./proxy')
  , Scores = require('./scores')
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

function Engine(db, io) {
  var self = this

  this.db = db
  this.io = io
  this.clients = {}
  this.rooms = {}

  this.proxies = {
    disconnect: 'disconnect'
  , join: 'join'
  }
  this.io.sockets.on('connection', this.clientSetup.bind(this))

  this._loadAllRooms(function() {
    self.emit('ready')
  })
}

/*!
 * Inherit from EventEmitter.
 */

Engine.prototype.__proto__ = EventEmitter.prototype

/**
 * Broadcast to all connected clients in server
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
 * Create new player and attach events
 *
 * @param {Object} client socket.io connection
 */

Engine.prototype.clientSetup = function(socket) {
  var sid = socket.handshake.session.id
    , self = this

  if (!this.clients[sid]) {
    this.clients[sid] = new Client(this.db, socket)
  }
  Proxy.setup(this, this.proxies, socket, this.clients[sid])
  this.bootstrap(this.clients[sid])
  return this
}

/**
 * Client disconnect, remove all references to the client
 *
 * @param {Player} client player instance
 */

Engine.prototype.disconnect = function(client) {
  var sid = client.sid
  db.HDEL('players', client.player.id, function() {
  })
  delete self.clients[sid]
  return this
}

/**
 * Client joined a room, create the room if needed
 *
 * @param {Player} client player instance
 * @param {String} room id
 * @param {Boolean} auto sit
 * @param {Function} callback
 */

Engine.prototype.join = function(client, id, sit, next) {
  var room = this.rooms[id]
    , player = client.player

  if (!room) {
    return next && next('Room could not be found')
  }
  client.join(room)
  room.join(player, function() {
    if (!sit) {
      return next && next()
    }
    room.sit(player, function() {
      next && next()
    })
  })
  return this
}

/**
 * Client attempt to auto join an open room
 * 
 * @param {Client} client instance
 * @param {Function} callback
 */

Engine.prototype.auto = function(client, next) {
  for (var id in this.rooms) {
    var room = this.rooms[id]
      , len = Object.keys(room.players).length

    // Check for playing room and open seats
    if (room.playing || room.isPrivate() || len > 1) {
      continue
    }
    room.join(player, function() {
      room.sit(player, function() {
        next && next(room.toObject())
      })
    })
    return this
  }
  // Create a room if no open seats found
  return this.create(client, false, next)
}

/**
 * Create a new room
 * 
 * @param {Client} client instance
 * @param {Boolean} private room
 * @param {Function} callback
 */

Engine.prototype.create = function(client, isPrivate, next) {
  var room = new Room(this.db, this.io, { isPrivate: isPrivate })
    , player = client.player

  this.rooms[room.id] = room

  room.join(player, function() {
    room.sit(player, function() {
      next && next(room.toObject())
    })
  })
  return this
}

/**
 * Join a room to play
 * 
 * @param {Client} client instance
 * @param {String} room id
 * @param {Function} callback
 */

Engine.prototype.play = function(client, id, next) {
  return this.join(client, id, true, next)
}

/**
 * Watch a game by joining a room
 * 
 * @param {Client} client instance
 * @param {String} room id
 * @param {Function} callback
 */

Engine.prototype.watch = function(client, id, next) {
  return this.join(client, id, false, next)
}

/**
 * Load all active players
 *
 * @param {Function} callback
 */

Engine.prototype.loadAllPlayers = function(next) {
  this.db.HGETALL('players', function(err, players) {
    next && next(players)
  })
  return this
}

/**
 * Get active connections in a room
 *
 * @param {String} room id
 */

Engine.prototype.getClients = function(roomId) {
  return io.sockets.manager.rooms['/' + roomId]
}

/**
 * Load all active rooms
 *
 * @param {Function} callback
 * @api private
 */

Engine.prototype._loadAllRooms = function(next) {
  var self = this
    , rooms = Object.keys(io.sockets.manager.rooms)
    , len = keys.length

  rooms.forEach(function(id) {
    self.rooms[id] = new Room(self.db, this.io, id).load(function() {
      --len || next()
    })
  })
}

/**
 * Bootstrap the client with initial data
 *
 * @param {Player} player object to send to
 */

Engine.prototype.bootstrap = function(client) {
  this.loadAllPlayers(function(players) {
    client.socket.emit('players', players)
  })
  this.loadAllRooms(function(rooms) {
    client.socket.emit('rooms', rooms)
  })
  return this
}

/**
 * Send current public room information to all connected clients
 */

Engine.prototype.updateLobby = function() {
  var data = []
  for (var id in this.rooms) {
    var room = this.rooms[id]
    if (room.isPrivate()) {
      continue
    }
    data.push(room.toObject())
  }
  return this.broadcast('updateLobby', data)
}

/*!
 * Module exports.
 */

module.exports = Engine
