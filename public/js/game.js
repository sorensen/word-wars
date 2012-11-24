
;(function() {
'use strict'

/*!
 * Module dependencies.
 */

var root = this
  , $win = $(this)
  , ENTER = 13
  , DELETE = 8
  , imgPath = '/img/digits.png'

/**
 * Game constructor
 *
 * @param {Object} socket connection object
 * @param {String} game id
 * @param {String} player id
 * @param {Object} [options]
 */

function Game(socket, id, pid, options) {
  options || (options = {})

  var self = this
    , room = options.room || {}

  this.socket = socket
  this.id = id
  this.seats = {}
  this.redWords = {}
  this.blueWords = {}
  this.options = options
  this.autoSit = options.autoSit
  this.isPrivate = options.isPrivate
  this.pid = pid || room.pid

  this.players = room.players || {}
  this.watchers = room.watchers || {}
  this.playedWords = room.playedWords || {}
  this.currentWords = room.currentWords || {}

  // Socket event to method mapping
  this.proxies = {
    attack: 'attacked'
  , block: 'blocked'
  , won: 'won'
  , start: 'start'
  , sat: 'sat'
  , stood: 'stood'
  , ready: 'playerReady'
  , over: 'over'
  , joined: 'joined'
  }

  // Cache selectors
  this.$el = $('#battle-mode')
  this.$input = $('#game-input')
  this.$redSeat = $('#red-seat')
  this.$blueSeat = $('#blue-seat')
  this.$redName = $('#red-player .player-name span')
  this.$blueName = $('#blue-player .player-name span')
  this.$playerNames = $('.player-name')
  this.$redSpacesLeft = $('#red-player .spaces-left')
  this.$blueSpacesLeft = $('#blue-player .spaces-left')
  this.$spacesLeft = $('.spaces-left')
  this.$red = $('#red-player .word-list')
  this.$blue = $('#blue-player .word-list')
  this.$wordLists = $('.word-list')
  this.$vs = $('#vs')
  this.$notification = $('#notification')
  this.$counter = $('#counter')
  this.$sit = $('#sit')
  this.$stand = $('#stand')
  this.$ready = $('#ready')
  this.$gameOverlay = $('#game-overlay')
  this.$readyOverlay = $('#ready-overlay')
  this.$isReadyOverlay = $('#is-ready-overlay')

  // Permanently focus the game input
  $win.click(function(e) {
    if (self.enabled && !self.$input.focus()) {
      self.$input.focus()
    }
  })
  // Attack and clear input if enter pressed
  this.$input
    .keypress(function(e) {
      if (self.enabled && e.which === ENTER) {
        self.sendWord(self.$input.val())
        self.$input.val('')
      }
    })
    .keyup(function(e) {
      self.highlight()
    })
  this.$sit.click(function() { self.sit() })
  this.$stand.click(function() { self.stand() })
  this.$ready.click(function() { self.ready() })

  // Bootstrap room information
  if (this.players) {
    for (var id in this.players) {
      var player = this.players[id]
      this.seats[player.seat] = player.id
      player.ready && this.playerReady(player.id)
    }
    this.updateSeats()
    options.autoSit && this.sit()
  }
  console.log('setup players: ', this.players, this.seats)
  return this
}

/**
 * Send event and data to the server
 */

Game.prototype.send = function() {
  console.log('game emit: ', arguments)
  this.socket.emit.apply(this.socket, arguments)
  return this
}
/**
 * Reset game internals
 */

Game.prototype.reset = function() {
  console.log('game reset')
  this.words = {}
  this.players = {}
  this.redWords = {}
  this.blueWords = {}
  this.seats = {}
  return this.disableInput()
}

/**
 * Remove all socket listeners
 */

Game.prototype.removeListeners = function() {
  for (var name in this.proxies) {
    this.socket.removeAllListeners(name)
  }
  return this
}

/**
 * Connect to all socket methods
 */

Game.prototype.connect = function() {
  var self = this
  if (this.connected) {
    return this
  }
  this.removeListeners()
  Proxy.setup(this, this.proxies, this.socket)
  this.connected = true
  return this
}

/**
 * Display notification message
 */

Game.prototype.notify = function(msg) {
  this.$notification
    .show()
    .html(msg)
    .delay(6000)
    .fadeOut(2000)
  return this
}

/**
 * Enable main game input element
 */

Game.prototype.enableInput = function() {
  this.enabled = true
  console.log('enable input: ', this.$input)
  this.$input.removeAttr('disabled').focus()
  return this
}

/**
 * Disable main game input element
 */

Game.prototype.disableInput = function() {
  this.enabled = false
  this.$input.attr('disabled', 'disabled')
  return this
}

/**
 * Get normalized seat name for security
 *
 * @param {String} seat name
 */

Game.prototype.getSeat = function(seat) {
  return seat === 'red' ? 'red' : 'blue'
}

/**
 * Get seat name from player id
 *
 * @param {String} player id
 */

Game.prototype.getSeatByPlayer = function(playerId) {
  var self = this
    , seat

  Object.keys(this.seats).forEach(function(key) {
    if (self.seats[key] === playerId) {
      seat = key
    }
  })
  return seat
}

/**
 * Get player name by id
 *
 * @param {String} player id
 * @param {String} player name
 */

Game.prototype.getPlayerName = function(id) {
  return (this.players[id] || {}).name
}

/**
 * Get player by seat name
 *
 * @param {String} seat name
 * @return {String} player id
 */

Game.prototype.getPlayer = function(seat) {
  return this.seats[this.getSeat(seat)]
}

/**
 * Another player has joined the game
 *
 * @param {Object} player information
 */

Game.prototype.joined = function(player) {
  this.players[player.id] = player
  return this
}

/**
 * Another player has attacked
 *
 * @param {String} word
 * @param {String} player id
 */

Game.prototype.attacked = function(word, id) {
  this.$isReadyOverlay.hide()
  word = word.toLowerCase().trim()

  var $word = $('<div><p>' + word + '</p></div>')
    , $el

  if (this.getSeatByPlayer(id) === 'red') {
    $el = this.$blue
    this.blueWords[word] = $word
  } else {
    $el = this.$red
    this.redWords[word] = $word
  }
  this.animate($el, $word)
  this.updateSpacesLeft()
  return this
}

/**
 * Animate the word down the game board
 *
 * @param {Object} game board element
 * @param {Object} word element
 */

Game.prototype.animate = function($el, $word) {
  var timeout = 1500

  $el.append($word)
  $({
    position: 0
  }).animate({
    position: 90
  }, {
    duration: timeout
  , step: function(position) {
      var idx = $word.index() * 10
      if (position > (90 - idx)) {
        position = 90 - idx
        $word.data('bottom', true)
      }
      $word.css({top: position + '%'})
    }
  })
  $word.lettering()
  return this
}

/**
 * Restack all words on the game board
 *
 * @param {Object} game board element
 * @param {Number} word index
 */

Game.prototype.reStack = function($el, idx) {
  var timeout = 1500
  $el.children().each(function() {
    var $word = $(this)
      , wordIdx = $word.index()
      , start = 90 - wordIdx * 10
      , end   = start + 90

    if (!$word.data('bottom') || idx - 1 >= wordIdx) {
      return
    }
    $({
      position: start
    }).animate({
      position: end
    }, {
      duration: timeout
    , step: function(position) {
        var idx = $word.index() * 10
        if (position > (90 - idx)) position = 90 - idx
        $word.css({top: position + '%'})
      }
    })
  })
}

/**
 * Update remaining word spaces of player
 */

Game.prototype.updateSpacesLeft = function() {
  var redLen = 10 - Object.keys(this.redWords).length
    , blueLen = 10 - Object.keys(this.blueWords).length

  if (this.isSitting && this.pid === this.seats.blue) {
    this.$blueSpacesLeft.html(redLen)
    this.$redSpacesLeft.html(blueLen)
  } else {
    this.$redSpacesLeft.html(redLen)
    this.$blueSpacesLeft.html(blueLen)
  }
  return this
}

/**
 * Player blocked a word
 *
 * @param {String} word
 * @param {String} player id
 */

Game.prototype.blocked = function(word, id) {
  var idx

  word = word.toLowerCase().trim()

  if (this.getSeatByPlayer(id) === 'red') {
    if (this.redWords[word]) {
      idx = this.redWords[word].index()
      this.redWords[word].remove()
      delete this.redWords[word]
      this.reStack(this.$red, idx)
    }
  } else {
    if (this.blueWords[word]) {
      idx = this.blueWords[word].index()
      this.blueWords[word].remove()
      delete this.blueWords[word]
      this.reStack(this.$blue, idx)
    }
  }
  this.updateSpacesLeft()
  return this
}

/**
 * Start the game and begin countdown timer
 */

Game.prototype.start = function() {
  var self = this
    , otherSeat = this.seats.blue

  this.isPlaying = this.isSitting
    ? true
    : false

  this.gameStarted = true
  this.$playerNames.show()

  if (this.isPlaying) {
    if (this.pid === otherSeat) {
      otherSeat = this.seats.red
    }
    this.$redName.html('You')
  } else {
    this.$redName.html(this.getPlayerName(this.seats.red))
  }
  this.$blueName.html(this.getPlayerName(otherSeat))

  this.clearBoard()

  if (this.playing && !this.isSitting) {
    return
  }
  // Begin countdown
  this.$counter
    .show()
    .countdown({
      stepTime: 60
    , format: 's'
    , startTime: '3'
    , digitImages: 6
    , digitWidth: 53
    , digitHeight: 77
    , timerEnd: function() {
        // Clear elements
        self.$counter.html('').hide()
        self.clearBoard()
        self.enableInput()
      }
    , image: imgPath
    })
  return this
}

/**
 * Player has won the game
 *
 * @param {String} player id
 */

Game.prototype.won = function(pid) {
  var self = this
    , me = this.pid === pid
    , msg
    , name = this.getPlayerName(pid)

  this.notify('Player ' + name + ' won!')

  if (this.isPlaying) {
    msg = me
      ? 'Victory'
      : 'Defeat'
  } else {
    msg = name + ' won'
  }
  this.$gameOverlay.show().html('<span>' + msg + '</span>')
  this.clearBoard()

  this.tick = setTimeout(function() {
    self.$gameOverlay
      .html('<span>Game Over</span>')
      .fadeOut(5000, function() {
        self.over()
      })
  }, 5 * 1000)
  return this
}

/**
 * Game over
 */

Game.prototype.over = function() {
  if (this.gameStarted) {

  }
  $('.player-name').hide()
  this.gameStarted = false
  return this
    .clearBoard()
    .disableInput()
    .updateSeats()
}

/**
 * Player has quit the game
 */

Game.prototype.quit = function() {
  var self = this

  if (this.isPlaying || this.isSitting) {
    this.clearBoard()
  }
  this.send('leave', function(e) {
    self.removeListeners()
    self.connected = false
  })
  return this.reset()
}

/**
 * Sit down on open seat
 */

Game.prototype.sit = function() {
  if (this.isSitting || (this.seats.red && this.seats.blue)) {
    return this
  }
  var self = this
  this.send('sit', function(err) {
    err && self.notify(err)
  })
  return this
}

/**
 * A player has sat down
 *
 * @param {String} player id
 * @param {String} seat name
 */

Game.prototype.sat = function(id, seat) {
  console.log('sat: ', id, seat)
  if (id === this.pid) {
    this.isSitting = true
    if (this.getSeat(seat) === 'blue') {
      this.$red = $('#blue-player .word-list')
      this.$blue = $('#red-player .word-list')
      this.$redSeat = $('#blue-seat')
      this.$blueSeat = $('#red-seat')
    }
  }
  this.seats[this.getSeat(seat)] = id
  return this.updateSeats()
}

/**
 * Stand up from the game
 */

Game.prototype.stand = function() {
  if (!this.isSitting) {
    return this
  }
  var self = this
  this.send('stand', function(err) {
    err && self.notify(err)
  })
  return this
}

/**
 * Player has stood up from a seat
 *
 * @param {String} player id
 */

Game.prototype.stood = function(id) {
  if (id === this.pid) {
    this.isSitting = false
  }
  this.seats[this.getSeatByPlayer(id)] = null
  return this.updateSeats()
}

/**
 * Send ready signal to the server
 */

Game.prototype.ready = function() {
  if (!this.isSitting) {
    return this
  }
  var self = this
  
  this.$readyOverlay.show()
  this.send('playerReady', function(err) {
    err && self.notify(err)
  })
  return this
}

/**
 * Mark another player as ready to play the game
 *
 * @param {String} player id
 */

Game.prototype.playerReady = function(pid) {
  if (pid !== this.pid && !this.gameStarted) {
    this.$isReadyOverlay.show()
  }
  return this
}

/**
 *
 */

Game.prototype.updateWords = function() {
  var self = this
  if (!this.room) {
    return this
  }
  if (this.room.playing) {
    this.start()
  }
  this.room.players.forEach(function(player) {
    var seat = player.seat
      , words = player.currentWords

    words.forEach(function(word) {
      word = word.toLowerCase().trim()

      var $word = $('<div><p>' + word + '</p></div>')
        , $el

      if (seat === 'red') {
        $el = self.$red
        self.redWords[word] = $word
      } else {
        $el = self.$blue
        self.blueWords[word] = $word
      }
      $el.append($word)

      var idx = $word.index() * 10
        , position = 90 - idx

      $word.data('bottom', true)
      $word.css({top: position + '%'})
      $word.lettering()
      self.updateSpacesLeft()
    })
  })
  return this
}

/**
 * Update seat information with current players
 */

Game.prototype.updateSeats = function() {
  var self = this
    , pid = this.pid
    , red = this.seats.red
    , blue = this.seats.blue
    , $other = this.$el.find('#blue-player .player')
  
  console.log('updateSeats: ', pid, red, blue)

  $('.player strong').html('')
  $('#red-player .player').hide()

  // Both players sitting
  if (red && blue) {
    this.$vs.show()
    this.$sit.hide()
    var forOther = blue
    if (pid === blue) {
      forOther = red
    }
    $other
      .show()
      .find('strong')
      .html(this.getPlayerName(forOther))

    if (!this.isSitting) {
      $('#red-player .player')
        .show()
        .find('strong')
        .html(this.getPlayerName(red))

      this.updateWords()
    }
  // One player sitting
  } else if (red || blue) {
    // You are sitting
    if (pid === blue || pid === red) {
      $other.hide()
      this.$sit.hide()
    // Someone else is sitting
    } else {
      $other
        .show()
        .find('strong')
        .html(this.getPlayerName(red || blue))

      this.$sit.show()
      this.$ready.hide()
      this.$stand.hide()
    }
  // No players sitting
  } else {
    this.$el.find('.player').hide()
    this.$sit.show()
    this.$stand.hide()
    this.$ready.hide()
  }
  if (this.isSitting) {
    this.$stand.show()
    this.$ready.show()
    this.$sit.hide()
  }
  return this
}

/**
 * Clear game boards and reset to factory condition
 */

Game.prototype.clearBoard = function() {
  this.$el.find('.player').hide()
  this.$sit.hide()
  this.$stand.hide()
  this.$ready.hide()
  this.$readyOverlay.hide()
  this.$isReadyOverlay.hide()
  this.redWords = {}
  this.blueWords = {}
  this.$spacesLeft.html('10')
  this.$wordLists.html('')
  this.$playerNames.hide()
  this.$vs.hide()
  return this
}

/**
 * Send a word to the server for either attacking or blocking
 *
 * @param {String} word
 */

Game.prototype.sendWord = function(word) {
  var self = this
  if (!this.enabled) return
  this.send('sendWord', word, function(err) {
    if (err) {
      return self.notify(err)
    }
  })
  return this
}

/**
 * Highlight letters of blockable words
 */

Game.prototype.highlight = function() {
  var val = this.$input.val()
    , words = (this.getSeatByPlayer(this.pid) === 'red')
      ? this.redWords
      : this.blueWords

  for (var word in words) {
    var $word = words[word]
      , children = $word.children()

    // Reset word color
    $word.find('span').css('color', '#000000')

    // Part of input found in word
    if (val.length && word.substring(0, val.length) === val) {
      for (var i = 0; i !== children.length && i !== val.length; i++) {
        $(children[i]).css('color', '#ff0000')
      }
    }
  }
  return this
}

/*!
 * Module exports
 */

root.Game = Game

}).call(this);
