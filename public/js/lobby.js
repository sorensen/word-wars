
;(function() {
  'use strict'

  var $doc = $(document)
    , $win = $(window)
    , $body = $('body')
    , getChar = String.fromCharCode
    , concat = Array.prototype.concat
    , speed = 5
    , current
    , ENTER = 13
    , DELETE = 8
    , imgPath = '/img/digits.png'


  // Game Lobby
  // ==========

  function Lobby(socket) {
    var self = this

    this.game = null

    // Cache selectors
    this.$wrapper = $('#wrapper')
    this.$home = $('#home')
    this.$el = $('.lobby-mode')
    this.$fullscreen = $('#fullscreen')

    $win.unload(function() {
      self.game && self.game.quit()
    })
    this.$home.click(function() { self.home() })

    this.$el.on('click', '.join', function(e) {
      var $button = $(this)
        , id = $button.parent().data('id')

      self.join(id)
    })

    $('.lobby').on('click', '.join-room', function (e) {
      self.join(false)
    })
    $('.lobby').on('click', '.create-room', function (e) {
      //self.join(false)
    })
    this.socket = socket
    this.socket.on('connect', function() { 
      self.connect() 
    })
    this.$fullscreen.click(function() { self.fullscreen() })
  }
  // Home screen
  Lobby.prototype.home = function() {
    this.leave()
  }
  // Socket connection handler
  Lobby.prototype.connect = function() {
    var self = this
    this.Sessions = window.Sessions.display()
    this.HighScores = window.HighScores.display()
    self.getRooms()
    this.socket.on('updateLobby', function () {
      self.HighScores.display()
      self.getRooms()
    })  
    return this
  }
  Lobby.prototype.getRooms = function() {
    var self = this
    this.socket.emit('getRooms', function (rooms) {
      console.log('getRooms: ', JSON.stringify(rooms, null, 2))
      // if (rooms.length === 0) return self
      self.$el.empty()
      rooms.forEach(function (room) {
        self.render(room)
      })
    })  
  }
  Lobby.prototype.games = function() {
    return this
  }
  // Join a game
  Lobby.prototype.join = function(id) {
    this.game = new Game(this.socket, id).connect()
    this.$wrapper
      .removeClass('lobby')
      .addClass('battle')
    return this
  }
  // Leave the game
  Lobby.prototype.leave = function() {
    this.game && this.game.quit()
    this.game = null
    this.$wrapper
      .removeClass('battle')
      .addClass('lobby')
    return this
  }
  Lobby.prototype.render = function(room) {
    var $room = this.$el.find('[data-id="' + room.id + '"]')
    var watchers = room.clients.length - room.players.length
    watchers = watchers >= 0 ? watchers : 0
    var $html = $(views.roomBox({ 
        room : room.id
      , players : room.players
      , watchers : watchers
      , words : '80'
    }))

    // If the room does not exist, create it
    // if (!$room || !$room.length) {
      this.$el.append($html)
    // } else {
      // $room.replaceWith($html)
      // this.update($room, $html)
    // }
  }
  Lobby.prototype.refresh = function() {
    return this
  }

  Lobby.prototype.fullscreen = function() {
    if (this.isFullscreen) {
      this.isFullscreen = false
      
      this.$fullscreen
        .removeClass('icon-resize-small')
        .addClass('icon-resize-full')
      
      this.$wrapper
        .removeClass('fullscreen')
    } else {
      this.isFullscreen = true
      
      this.$fullscreen
        .addClass('icon-resize-small')
        .removeClass('icon-resize-full')
      
      this.$wrapper
        .addClass('fullscreen')
    }
    return this
  }

  $(function() {
    window.conn  = io.connect()
    window.lobby = new Lobby(window.conn)
  })

}).call(this)
