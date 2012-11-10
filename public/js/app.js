
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

    this.game = null
    this.$wrapper = $('#wrapper')
    this.$home = $('#home')
    this.$el = $('#lobby-mode')

    $win.unload(function() {
      self.game && self.game.quit()
    })
    this.$home.click(function() { self.home() })

    this.$el.on('click', '.join', function(e) {
      var $el = $(this)
        , id = $el.parent().data('id')

      self.join(id)
    })
    this.$el.on('click', '.create-room', function (e) {
      var roomName = $('#room-name').val()

      if (roomName === '') return

      self.join(roomName)
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

    this.socket.emit('getRooms', function(rooms) {
      if (rooms.length === 0) return self

      rooms.forEach(function (room) {
        self.render(room)
      })
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
  Lobby.prototype.render = function(room) {
    var $el = this.$el.find('[data-id="' + room + '"]')

    // If the room does not exist, create it
    if (!$el || !$el.length) {
      $el = $(''
        + '<div class="game" data-id="' + room + '">'
        + '  <button class="join btn btn-info btn-small">Join</button>'
        + '  <button class="watch btn btn btn-small">Watch</button>'
        + '  <div class="clearfix"></div>'
        + '  <div class="host"><strong>Host:</strong> <span>Some Host</span></div>'
        + '  <div class="red-player"><strong>Red Player:</strong> <span>Player 1</span></div>'
        + '  <div class="blue-player"><strong>Blue Player:</strong> <span>Player 2</span></div>'
        + '  <div class="watchers"><strong>Watchers:</strong> <span>5</span></div>'
        + '  <div class="words"><strong>Words:</strong> <span>80</span></div>'
        + '</div>'
      )
      this.$el.append($el)
    } else {
      this.update($el, room)
    }
  }
  // Update room information
  Lobby.prototype.update = function($el, room) {
    $el
      .find('.join').end()
      .find('.host span').html().end()
      .find('.blue-player span').html().end()
      .find('.red-player span').html().end()
      .find('.watchers span').html().end()
      .find('.words span').html().end()
    return this
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
    this.$el = $('#battle-mode')
    this.$input = $('#input')
    this.$red = $('#' + playerOne)
    this.$blue = $('#' + playerTwo)
    this.$redSeat = $('#red-seat')
    this.$blueSeat = $('#blue-seat')
    this.$notification = $('#notification')
    this.$counter = $('#counter')

    this.$sit = $('#sit')
    this.$stand = $('#stand')


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
    this.$sit.click(function() { self.sit() })
    this.$stand.click(function() { self.stand() })
    return this
  }

  Game.prototype.reset = function() {
    this.words = {}
    this.players = {}
    this.pid = null
    this.playerWords = {}
    this.opponentWords = {}
    return this.disableInput()
  }

  // Socket actions
  // --------------

  Game.prototype.connect = function() {
    var self = this

    if (this.connected) {
      return this
    }
    this.pid = this.socket.socket.sessionid
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
    this.socket.on('over', function () { self.over.apply(self, arguments) })

    this.socket.on('sat', function () { self.sat.apply(self, arguments) })
    this.socket.on('stood', function () { self.stood.apply(self, arguments) })

    console.log('connect')
    this.send('join', this.id, function(e) {
      console.log(e)
    })
    this.connected = true
    return this.updateSeats()
  }
  Game.prototype.send = function() {
    var self = this
    console.log('send: ', arguments)
    // this.socket.emit(action, word, function() {
    //   console.log('socket done: ', arguments)
    //   fn && fn.apply(this, arguments)
    // })
    this.socket.emit.apply(this.socket, arguments)
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
    word = word.toLowerCase().trim()

    var me = id === this.pid
      , $el = me ? this.$blue : this.$red
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

      })
  }
  Game.prototype.blocked = function(word, id) {
    var me = id === this.pid

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
          console.log('start game')
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
    console.log('enable input')
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
    var self = this
    this.send('leave', this.id, function(e) {
      for (var i = 0; i !== self.listeners.length; i++) {
        self.socket.removeAllListeners(self.listeners[i])
      }
      self.connected = false
    })
    return this.reset()
  }
  Game.prototype.sat = function(seat, id) {
    if (id === this.pid) {
      this.isSitting = true
    }
    this[this.getSeat(seat)] = id
    return this.updateSeats()
  }
  Game.prototype.stood = function(seat, id) {
    if (id === this.pid) {
      this.isSitting = false
    }
    this[this.getSeat(seat)] = null
    return this.updateSeats()
  }

  // Normalize seat names for security
  Game.prototype.getSeat = function(seat) {
    return seat === 'red' ? 'red' : 'blue'
  }
  Game.prototype.getPlayer = function(seat) {
    return this[this.getSeat(seat)]
  }

  // Game actions
  // ------------

  Game.prototype.sit = function(el, e) {
    if (this.isSitting) {
      return this
    }
    var self = this
      , $el = $(el)
      , seat = this.getSeat($el.data('player'))
      , player = this.getPlayer(seat)

    if (!player) {
      this.send('sit', this.id, function(err) {
        err && self.notify(err)
      })
    } else {
      this.notify('That seat is taken')
    }
    return this
  }
  Game.prototype.stand = function() {
    if (!this.isSitting) {
      return this
    }
    var self = this
      , pid = this.pid
      , red = this.red
      , blue = this.blue
      , seat

    pid === red && (seat = red)
    pid === blue && (seat = blue)
    
    if (seat) {
      this.send('stand', this.id, function(err) {
        err && self.notify(err)
      })
    }
    return this
  }
  Game.prototype.updateSeats = function() {
    var self = this
      , pid = this.pid
      , red = this.red
      , blue = this.blue

    // Both players sitting
    if (red && blue) {
      this.$sit.hide()
    // One player sitting
    } else if (red || blue) {
      // Someone else sitting
      if (pid !== blue && pid !== red) {
        this.$el.find('#blue-player .player').show()
      }
    // No players sitting
    } else {
      this.$el.find('.player').hide()
      this.$sit.show()
      this.$stand.hide()
    }
    if (this.isSitting) {
      this.$stand.show()
    }
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

    ;[this.$red.children()
    , this.$blue.children()
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
      if (err) {
        return self.notify(err)
      }
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
    window.lobby = new Lobby(io.connect())
  })

}).call(this)
