
;(function() {
  'use strict'

  var $doc = $(document)
    , $win = $(window)
    , $body = $('body')
    , getChar = String.fromCharCode
    , speed = 5
    , current
    , ENTER = 13
    , DELETE = 8

    , playerOne = 'red-player'
    , playerTwo = 'blue-player'
    , imgPath = '/img/digits.png'

  // Helpers
  // =======

  function uuid(a) {
    return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,b)
  }

  // Game Lobby
  // ==========

  function Lobby(socket) {
    var self = this

    window.sock = socket
    this.$wrapper = $('#wrapper')
    this.$home = $('#home')
    this.$lobby = $('#lobby-mode')

    this.$home.click(function() {
      self.home()
    })
    this.$lobby.on('click', '.join', function(e) {
      console.log('join: ', e, this)

      var $el = $(this)
        , id = $el.parent().attr('data-id')

      console.log('id', id)
      self.join(id)
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

    this.socket.emit('getGames', function(rooms) {
      console.log('rooms: ', rooms)

      for (var key in rooms) {
        self.render(key, rooms[key])
      }
    })
    return this
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
  // Render all rooms
  Lobby.prototype.render = function(id, room) {
    var $el = this.$lobby.find('[data-id="' + id + '"]')

    // If the room does not exist, create it
    if (!$el || !$el.length) {
      $el = $(''
        + '<div class="game" data-id="' + id + '">'
        + '  <button class="join btn btn-info btn-small">Join</button>'
        + '  <div class="host"><span>Host:</span> Some Host</div>'
        + '  <div class="blue-player"><span>Player:</span> Player 1</div>'
        + '  <div class="watchers"><span>Watchers:</span> 5</div>'
        + '  <div class="words"><span>Words:</span> 80</div>'
        + '</div>'
      )
      this.$lobby.append($el)
    }
  }
  // Refresh all games in the view
  Lobby.prototype.refresh = function() {
    return this
  }


  // Game Engine
  // ===========

  function Game(socket, id) {
    var self = this

    this.socket = socket
    this.id = id
    this.listeners = []
    this.$input = $('#input')
    this.$player = $('#' + playerOne)
    this.$opponent = $('#' + playerTwo)
    this.$notification = $('#notification')
    this.$counter = $('#counter')

    this.reset()
    // Permanently focus the game input
    $win.click(function(e) {
      if (self.enabled && !self.$input.focus()) {
        self.$input.focus()
      }
    })
    // Attack and clear input if enter pressed
    this.$input.keypress(function(e) {
      if (self.enabled && e.which === ENTER) {
        self.attack(self.$input.val())
        self.$input.val('')
      }
    })
    return this
  }

  Game.prototype.reset = function() {
    this.words = {}
    this.players = {}
    this.playerId = null
    this.playerWords = {}
    this.opponentWords = {}
    return this.disableInput()
  }

  // Socket actions
  // --------------

  Game.prototype.connect = function() {
    var self = this

    this.playerId = this.socket.socket.sessionid
    this.listeners = [
      'used'
    , 'attack'
    , 'players'
    , 'block'
    , 'lose'
    , 'win'
    , 'start'
    , 'over'
    ]
    this.socket.on('used', function () { self.usedWord.apply(self, arguments) })
    this.socket.on('attack', function () { self.attacked.apply(self, arguments) })
    this.socket.on('players', function () { self.players.apply(self, arguments) })
    this.socket.on('block', function () { self.blocked.apply(self, arguments) })
    this.socket.on('lose', function () { self.lost.apply(self, arguments) })
    this.socket.on('win', function () { self.won.apply(self, arguments) })
    this.socket.on('start', function () { self.start.apply(self, arguments) })
    this.socket.on('over', function () { self.over.apply(self, arguments) 

    this.send('join', this.id, function(e) {
      console.log(e)
    })
    return this
  }
  Game.prototype.send = function(action, word, fn) {
    var self = this
    console.log('send: ', arguments)
    this.socket.emit(action, word, function() {
      console.log('socket done: ', arguments)
      fn && fn.apply(this, arguments)
    })
    // this.socket.emit.apply(this.socket, arguments)
    return this
  }
  Game.prototype.players = function() {
    return this
  }
  Game.prototype.usedWord = function() {

    return this
  }
  Game.prototype.heights = function() {

    return this
  }
  Game.prototype.attacked = function(word, id) {
    console.log('attacked: ', arguments)
    word = word.toLowerCase().trim()

    var me = id === this.playerId
      , $el = me ? this.$opponent : this.$player
      , $word = $('<div><p>' + word + '</p></div>')

    if (me) {
      this.opponentWords[word] = $word
    } else {
      this.playerWords[word] = $word
    }

    this.animate($el, $word)
  }
  Game.prototype.animate = function($el, $word) {
    var height = $el.height()
      , ten = height / 10
      , idx = $el.children().length

    this.word($word, idx)
    $el.prepend($word)
    return this
  }
  Game.prototype.word = function($el, idx) {
    var top = (9 - idx)
      , timeout = 1500

    $el
      .animate({
        top: top * 10 + '%'
      }, timeout, 'linear', function() {
        console.log('done')
      })
  }
  Game.prototype.blocked = function(word, id) {
    var me = id === this.playerId

    word = word.toLowerCase().trim()

    console.log(word, me, this.playerWords)
    if (me) {
      this.playerWords[word].remove()
      delete this.playerWords[word]
    } else {
      this.opponentWords[word].remove()
      delete this.opponentWords[word]
    }

    return this
  }
  // Start game, display countdown
  Game.prototype.start = function() {
    var self = this

    this.$counter
      .show()
      .countdown({
        stepTime: 60
      , format: 's'
      , startTime: '5'
      , digitImages: 6
      , digitWidth: 53
      , digitHeight: 77
      , timerEnd: function() { 
          self.$counter
            .html('')
            .hide()
          self.enableInput()
        }
      , image: imgPath
      })
    return this
  }
  Game.prototype.enableInput = function() {
    this.enabled = true
    this.$input.removeAttr('disabled').focus()
    return this
  }
  Game.prototype.disableInput = function() {
    this.enabled = false
    this.$input.attr('disabled', 'disabled')
    return this
  }
  Game.prototype.won = function() {

    return this
  }
  Game.prototype.lost = function() {

    return this
  }
  Game.prototype.over = function() {

    return this
  }

  // Player has quit the game
  Game.prototype.quit = function() {
    this.send('leave', this.id, function(e) {
      for (var i = 0; i !== this.listeners.length; i++) {
        this.socket.removeListener(this.listeners[i])
      }
    })
    return this.reset()
  }

  // Game actions
  // ------------

  Game.prototype.setup = function() {
    this.socket.on()
    return this
  }
  Game.prototype.fail = function() {

    return this
  }
  Game.prototype.win = function() {

    return this
  }
  Game.prototype.add = function(e) {
    var $el = this.$input
      , str = $el.val()

    $el.val(str + getChar(e.which))
    return this
  }
  Game.prototype.remove = function(e) {
    var $el = this.$input
      , str = $el.val()

    $el.val(str.substr(0, str.length))
    return this
  }
  Game.prototype.stack = function() {
    var self = this

    ;[this.$player.children()
    , this.$opponent.children()
    ].forEach(function($els) {
      var len = $els.length

      $els.each(function(key, val) {
        self.word($(val), len - key - 1)
      })
    })
    return this
  }
  Game.prototype.attack = function(word) {
    var self = this

    this.send('attack', word, function (err) {
      if (err) return console.log(err)
    })
    return this
  }
  Game.prototype.notify = function(msg) {
    this.$notification
      .show()
      .html(msg)
      .delay(3000)
      .fadeOut(2000)
    return this
  }
  Game.prototype.highlight = function() {

    return this
  }

  $(function() {
    //window.game = new Game()
    window.lobby = new Lobby(io.connect())

    $('#lobby-mode').on('click', '.join', function (e) {
      var room = $(this).data('room')
      window.lobby.join(room)
    })
  })


}).call(this)
