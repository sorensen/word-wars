
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
    this.$el = $('#lobby-mode')
    this.$gameList = $('#game-list')

    $win.unload(function() {
      self.game && self.game.quit()
    })
    this.$home.click(function() { self.home() })

    this.$el.on('click', '.join', function(e) {
      var $button = $(this)
        , $parent = $button.parent()
        , id = $parent.data('id')

      self.join(id, $parent)
    })

    this.$el.on('click', '.join-room', function (e) {
      self.join(false)
    })
    this.$el.on('click', '.create-room', function (e) {
      //self.join(false)
    })
    this.socket = socket
    this.socket.on('connect', function() { 
      self.connect() 
    })
  }
  // Home screen
  Lobby.prototype.home = function() {
    this.leave()
  }
  // Socket connection handler
  Lobby.prototype.connect = function() {
    var self = this
    this.Sessions = new Sessions().display()
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
      self.$gameList.empty()
      rooms.forEach(function (room) {
        self.render(room)
      })
    })  
  }
  Lobby.prototype.games = function() {
    return this
  }
  // Join a game
  Lobby.prototype.join = function(id, $el) {
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
    var watchers = room.clients.length - room.players.length
    watchers = watchers >= 0 ? watchers : 0
    
    var $html = $(views.roomBox({ 
      room : room.id
    , players : room.players
    , watchers : watchers
    , words : '80'
    }))
    $html.data(room)
    this.$gameList.append($html)
    return this
  }
  Lobby.prototype.refresh = function() {
    return this
  }

  $(function() {
    window.conn  = io.connect()
    window.lobby = new Lobby(window.conn)
  })

}).call(this)
