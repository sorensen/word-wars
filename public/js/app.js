
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


  function Game() {
    var self = this

    this.$input = $('#input')
    this.$player = $('#' + playerOne)
    this.$opponent = $('#' + playerTwo)
    this.socket = io.connect()

    this.init()
    // Initialize
    // this.socket.on('connect', function() { self.connect() })

    // Permanently focus the game input
    $win.click(function(e) {
      if (!self.$input.focus()) {
        self.$input.focus()
      }
    })
    // Attack and clear input if enter pressed
    this.$input.keypress(function(e) {
      if (e.which === ENTER) {
        self.attacked(self.$input.val())
        self.$input.val('')
      }
    })
    return this
  }

  Game.prototype.init = function() {
    var self = this

    // Internals
    this.words = {}
    this.players = {}
    this.playerId = null

    this.playerWords = {}
    this.opponentWords = {}

    this.socket.on('connect', function() { 
      self.connect()
    })
    return this
  }

  // Socket actions
  // --------------

  Game.prototype.connect = function() {
    var self = this

    this.playerId = this.socket.socket.sessionid

    this.socket.on('used', this.usedWord)
    this.socket.on('attack', this.attack)
    this.socket.on('players', this.players)
    this.socket.on('block', this.blocked)
    this.socket.on('lose', this.lost)
    this.socket.on('win', this.won)
    this.socket.on('start', this.start)
    this.socket.on('over', this.over)
    return this
  }
  Game.prototype.send = function() {
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
    var me = id === this.playerId
      , word = word.toLowerCase().trim()
      , $el = me ? this.$player : this.$opponent

    this.animate($el, word)
  }
  Game.prototype.animate = function($el, word) {
    var height = $el.height()
      , ten = height / 10
      , idx = $el.children().length
      , $word = $('<div><p>' + word + '</p></div>')

    this.word($word, idx)
    $el.prepend($word)
    return this
  }
  Game.prototype.word = function($el, idx) {
    var top = (9 - idx)
      , timeout = 1500

    console.log('word: ', top, timeout)
    $el
      .animate({
        top: top * 10 + '%'
      }, timeout, 'linear', function() {
        console.log('done')
      })
  }
  Game.prototype.blocked = function() {

    return this
  }
  Game.prototype.start = function() {

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

  // Game actions
  // ------------

  Game.prototype.reset = function() {
    this.init()
    return this
  }

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
  Game.prototype.attack = function() {

    return this
  }
  Game.prototype.notify = function() {

    return this
  }
  Game.prototype.highlight = function() {

    return this
  }

  $(function() {
    current = window.current = new Game()

  })


}).call(this)
