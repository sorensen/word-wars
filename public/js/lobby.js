
;(function() {
'use strict'

/*!
 * Module dependencies
 */

var root = this
  , $win = $(this)
  , toString = Object.prototype.toString
  , ENTER = 13

/**
 * Lobby constructor
 *
 * @param {Object} socket connection
 */

function Lobby(socket) {
  var self = this
  this.game = null
  this.socket = socket
  this.players = {}

  // Cache selectors
  this.$wrapper = $('#wrapper')
  this.$home = $('#home')
  this.$el = $('#lobby-mode')
  this.$gameList = $('#game-list')
  this.$playerList = $('#player-list')
  this.$chatInput = $('#chat-input input')
  this.$messageList = $('#chat-messages')
  this.$notification = $('#notification')

  $win.unload(function() { self.game && self.game.quit() })
  this.$home.click(function() { self.home() })

  this.$wrapper
    .on('click', '.watch', function() { self.watchRoom(this) })
    .on('click', '.play', function() { self.playRoom(this) })
    .on('click', '#auto-play', function() { self.autoPlay(this) })
    .on('click', '#create-private-room', function() { self.createPrivateRoom(this) })

  this.$chatInput
    .keypress(function(e) {
      var $el = $(this)
      if (e.which === ENTER) {
        self.sendMessage($el.val())
        $el.val('')
      }
    })

  this.proxies = {
    connect: 'connect'
  , players: 'updatePlayers'
  , rooms: 'updateRooms'
  , message: 'addMessage'
  }
  Proxy.setup(this, this.proxies, this.socket)
  $win.hashchange(function() {
    if (!self.game && window.location.hash && window.location.hash.length > 1) {
      self._join(window.location.hash.split('#')[1])
    }
  })
}

/**
 * Send event and data to the server
 */

Lobby.prototype.send = function() {
  console.log('lobby send: ', arguments)
  this.socket.emit.apply(this.socket, arguments)
  return this
}

/**
 * Return to home screen
 */

Lobby.prototype.home = function() {
  return this.leave()
}

/**
 * Socket connection handler
 */

Lobby.prototype.connect = function() {
  var self = this
  this.Sessions = new Sessions(this.socket).display()
  this.Scores = new Scores(this.socket).display()
  $win.hashchange()
  return this.getAllPlayers()
}

/**
 * Display notification message
 */

Lobby.prototype.notify = function(msg) {
  this.$notification
    .show()
    .html(msg)
    .delay(6000)
    .fadeOut(2000)
  return this
}

/**
 * Join a room 
 *
 * @param {String} room id
 * @param {Object} [options]
 * @api private
 */

Lobby.prototype._join = function(id, options) {
  var self = this
    , event = 'play'
    , flag = id

  options || (options = {})
  if (this.game) {
    return this.notify('You are already in a game')
  }
  !options.autoSit && (event = 'watch')
  options.autoPlay && (event = 'auto')

  if (options.create) {
    event = 'create'
    flag = options.isPrivate
  }
  this.send(event, flag, function(err, room) {
    if (err) return self.notify(err).home()
    
    options.room = room
    self.game = new Game(self.socket, room.id, self.Sessions.id, options).connect()
    self.game.lobby = this

    if (window.location.hash !== room.id) {
      window.location.hash = room.id
    }
    self.$wrapper
      .removeClass('lobby')
      .addClass('battle')
  })
  return this
}

/**
 * Auto join an open room or create a new one
 */

Lobby.prototype.autoPlay = function() {
  return this._join(null, {
    autoPlay: true
  })
}

/**
 * Create a private room
 */

Lobby.prototype.createPrivateRoom = function() {
  return this._join(null, {
    autoSit: true
  , create: true
  , isPrivate: true
  })
}

/**
 * Play in target room, automatically sit down in open seat
 *
 * @param {Object} dom element
 */

Lobby.prototype.playRoom = function(el) {
  var $button = $(el)
    , $parent = $button.parent().parent()
    , id = $parent.data('id')

  return this._join(id, {
    autoSit: true
  })
}

/**
 * Watch in target room
 *
 * @param {Object} dom element
 */

Lobby.prototype.watchRoom = function(el) {
  var $button = $(el)
    , $parent = $button.parent().parent()
    , id = $parent.data('id')

  return this._join(id)
}

/**
 * Update connected players hash
 *
 * @param {Object} player id name mapping
 */

Lobby.prototype.updatePlayers = function(players) {
  this.players = players
  return this.renderPlayers()
}

/**
 * Get active players from the server
 */

Lobby.prototype.getAllPlayers = function() {
  var self = this
  this.send('getPlayers', function(players) {
    self
      .updatePlayers(player)
      .getRooms()
  })
  return this
}

Lobby.prototype.renderPlayers = function() {
  var self = this
    , $el = this.$playerList

  $el.empty()
  for (var id in this.players) {
    var player = this.players[id]
    $el.prepend(''
      + '<div class="" id="player-' + player.id + '">' 
      + player.name 
      + '</div>'
    )
  }
  return this
}

/**
 * Get player
 *
 * @param {String} player id
 * @return {Object} player
 */

Lobby.prototype.getPlayer = function(pid) {
  return this.players[pid] || {}
}

/**
 * Get players with seats as key
 * 
 * @return {Object} seat player map
 */

Lobby.prototype.getPlayersBySeat = function(room) {
  var data = {}
  for (var id in room.players) {
    var player = room.players[id]
    data[player.seat] = player
  }
  return data
}

/**
 * Get player name
 *
 * @param {String} player id
 * @return {String} player name
 */

Lobby.prototype.getPlayerName = function(pid) {
  return this.getPlayer(pid).name || 'anonymous'
}

/**
 * Render all current rooms
 *
 * @param {Array|Object} room objects
 */

Lobby.prototype._renderAllRooms = function(rooms) {
  rooms || (rooms = [])
  // Check for single room instance
  if (toString.call(rooms) === '[object Object]') {
    return this.render(rooms)
  }
  // Array of rooms assumed
  this.$gameList.empty()
  for (var i = 0; i !== rooms.length; i++) {
    this.render(rooms[i])
  }
  return this
}

/**
 * Update the lobby with all rooms
 *
 * @param {Array} room objects
 */

Lobby.prototype.updateRooms = function(rooms) {
  return this._renderAllRooms(rooms)
}

/**
 * Get and render all available rooms
 */

Lobby.prototype.getRooms = function() {
  var self = this
  this.send('getRooms', function(rooms) {
    self._renderAllRooms(rooms)
  })
  return this
}

/**
 * Leave current game
 */

Lobby.prototype.leave = function() {
  window.location.hash = ''
  this.game && this.game.quit()
  this.game = null
  this.$wrapper
    .removeClass('battle')
    .addClass('lobby')
  return this
}

Lobby.prototype.objectToArray = function(objects) {
  var data = []
  for (var id in objects) {
    data.push(objects[id])
  }
  return data
}

/**
 * Render room 
 *
 * @param {Room} room instance
 */

Lobby.prototype.render = function(room) {
  var playerLen = Object.keys(room.players).length
    , watcherLen = Object.keys(room.watchers).length
    , watchers = Math.max(watcherLen - playerLen, 0)
    , $html

  $html = $(views.roomBox({ 
    room: room.id
  , players: this.getPlayersBySeat(room)
  , watchers: watchers
  , words: '80'
  }))
  if (playerLen >= 2) {
    $html.find('.play').attr('disabled', 'disabled')
  }
  this.$gameList.append($html)
  return this
}

/**
 * Render a message received from the server
 *
 * @param {Object} player
 * @param {String} message
 */

Lobby.prototype.addMessage = function(player, msg) {
  player || (player = {})
  this.$messageList.append(''
    + '<div data-player-id="' + player.id + '">'
    + '  <strong>' + player.name + '</strong>'
    + '  <span>' + msg + '</span>'
    + '</div>'
  )
  var pos = this.$messageList.height() + this.$messageList.scrollTop()
    , height = this.$messageList[0].scrollHeight

  if (pos + 300 >= height) {
    this.$messageList.stop().animate({
      scrollTop: height
    }, 200, 'easeInExpo')
  }
}

/**
 * Send a chat message
 *
 * @param {String} message
 */

Lobby.prototype.sendMessage = function(msg) {
  return this.send('message', msg)
}

/*!
 * Document ready
 */

$(function() {
  root.lobby = new Lobby(window.conn = io.connect())
})

}).call(this);
