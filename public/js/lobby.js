
;(function() {
  'use strict'

  window.players = {}

  window.getPlayerName = function(pid) {
    console.log('GET NAME: ', pid, '-', window.players[pid])
    return window.players[pid] || 'anonymous'
  }

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
        , $parent = $button.parent().parent()
        , id = $parent.data('id')

      self.join(id, $parent)
    })
    this.$el.on('click', '.play', function(e) {
      var $button = $(this)
        , $parent = $button.parent().parent()
        , id = $parent.data('id')

      self.join(id, $parent, true)
    })
    this.$el.on('click', '.join-room', function (e) {
      self.join(null, null, true)
    })
    this.$el.on('click', '.private-room', function (e) {
      self.join(null, null, true, true)
    })
    this.socket = socket
    this.socket.on('connect', function() {
      self.connect()
    })
    $win.hashchange(function () {
      if (window.location.hash && window.location.hash.length > 1) {
        self.join(window.location.hash.split('#')[1])
      }
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

    $win.hashchange()

    // this.HighScores = window.HighScores.display()
    this.socket.emit('getPlayers', function(players) {
      window.players = players
      self.getRooms()
    })
    this.socket.on('updateLobby', function (rooms) {
      // self.HighScores.display()
      self.$gameList.empty()
      rooms.forEach(function (room) {
        self.render(room)
      })
    })
    this.socket.on('players', function(players) {
      window.players = players
    })
    return this
  }
  Lobby.prototype.getRooms = function() {
    var self = this
    this.socket.emit('getRooms', function (rooms) {
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
  Lobby.prototype.join = function(id, $el, autoSit, priv) {
    if (this.game) return
    this.game = new Game(this.socket, id, autoSit, priv).connect()
    this.$wrapper
      .removeClass('lobby')
      .addClass('battle')
    return this
  }
  // Leave the game
  Lobby.prototype.leave = function() {
    window.location.hash = ''
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
      room: room.id
    , players: room.players
    , watchers: watchers
    , words: '80'
    }))

    if (room.players.length >= 2) {
      $html.find('.play').attr('disabled', 'disabled')
    }
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
