
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
  , Client = require('./client')
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
  this.socketRooms = this.io.sockets.manager.rooms
  this.proxies = {
    disconnect: 'disconnect'
  , auto: 'auto'
  , create: 'create'
  , play: 'play'
  , watch: 'watch'
  , message: 'message'
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
 * @param {Object} client socket.io connection
 */

Engine.prototype.clientSetup = function(socket) {
  var sid = socket.handshake.session.id
    , self = this
    , client = this.clients[sid]

  if (!client) {
    this.clients[sid] = client = new Client(this.db, socket)
  }
  client.getSession(function() {
    Proxy.setup(self, self.proxies, socket, client)
    self.bootstrap(client)
  })
  return this
}

/**
 * Client disconnect, remove all references to the client
 *
 * @param {Player} client player instance
 */

Engine.prototype.disconnect = function(client) {
  var sid = client.sid
  // this.db.HDEL('players', client.player.id, function() {
  // })
  delete this.clients[sid]
  return this
}

/**
 * Client joined a room, create the room if needed
 *
 * @param {Player} client player instance
 * @param {String} room id
 * @param {Boolean} auto sit
 * @param {Function} callback
 * @api private
 */

Engine.prototype._join = function(client, id, sit, next) {
  var room = this.rooms[id]
    , player = client.player

  if (!room || !id) {
    return next && next('Room could not be found')
  }
  client.join(room)
  room.join(player, function(err) {
    // if (!sit) 
    return next && next(null, room.toObject())
    
    room.sit(player, function() {
      // next && next(null, room.toObject())
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

Engine.prototype.auto = function(client, ignore, next) {
  var player = client.player

  for (var id in this.rooms) {
    var room = this.rooms[id]
      , len = Object.keys(room.players).length

    // Check for playing room and open seats
    if (room.playing || room.isPrivate() || len > 1) {
      continue
    }
    client.join(room)
    room.join(player, function(err) {
      next && next(null, room.toObject())
      room.sit(player, function(err) {

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
  var room = new Room(this.db, this.io, null, { isPrivate: isPrivate })
    , player = client.player
    , self = this

  this.rooms[room.id] = room
  client.join(room)
  room.join(player, function(err) {
    next && next(null, room.toObject())
    room.sit(player, function(err) {
      self.sendRooms(room)
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
  return this._join(client, id, true, next)
}

/**
 * Watch a game by joining a room
 * 
 * @param {Client} client instance
 * @param {String} room id
 * @param {Function} callback
 */

Engine.prototype.watch = function(client, id, next) {
  return this._join(client, id, false, next)
}

/**
 * Load all active players
 *
 * @param {Function} callback
 */

Engine.prototype.loadAllPlayers = function(next) {
  var players = {}
  for (var id in this.clients) {
    var player = this.clients[id].player
    players[player.id] = player
  }
  return next && next(players)
  // this.db.HGETALL('players', function(err, players) {
  //   next && next(players)
  // })
  return this
}

/**
 * Get active connections in a room
 *
 * @param {String} room id
 */

Engine.prototype.getClients = function(roomId) {
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
 * Bootstrap the client with initial data
 *
 * @param {Player} player object to send to
 */

Engine.prototype.bootstrap = function(client) {
  var self = this
  client.socket.emit('session', client.toObject())

  this.loadAllPlayers(function(players) {
    client.socket.emit('players', self._mapToObjects(players))
  })
  this._loadAllRooms(function(rooms) {
    client.socket.emit('rooms', self._mapToObjects(rooms, true))
  })
  return this
}

/**
 * Send current public room information to all connected clients
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
 * Client has sent a message
 *
 * @param {Client} sender
 * @param {String} message
 */

Engine.prototype.message = function(client, msg) {
  if (!client.isFlooded()) {
    this.broadcast('message', client.player.toObject(), msg) 
    client.floodTick()
  }
  return this
}

/*!
 * Module exports.
 */

module.exports = Engine
