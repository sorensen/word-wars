
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


  function Game() {
    var self = this

    this.$input = $('#input')
    this.$player = $('#player')
    this.$opponent = $('#opponent')
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
  }

  Game.prototype.init = function() {
    // Internals
    this.words = {}
    this.players = {}
    this.playerId = null

    this.playerWords = {}
    this.opponentWords = {}
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
  }
  Game.prototype.send = function() {
    this.socket.emit.apply(this.socket, arguments)
  }
  Game.prototype.players = function() {

  }
  Game.prototype.usedWord = function() {

  }
  Game.prototype.heights = function() {

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
      , words = $el.children().length
      , $word = $('<div><p>' + word + '</p></div>')

    $word.css({
      bottom: words * 10 + '%'
    , top: 'auto'
    })
    $el.prepend($word)
  }
  Game.prototype.blocked = function() {

  }
  Game.prototype.start = function() {

  }
  Game.prototype.won = function() {

  }
  Game.prototype.lost = function() {

  }
  Game.prototype.over = function() {

  }

  // Game actions
  // ------------

  Game.prototype.reset = function() {
    this.init()
  }

  Game.prototype.setup = function() {
    this.socket.on()
  }
  Game.prototype.fail = function() {

  }
  Game.prototype.win = function() {

  }
  Game.prototype.add = function(e) {
    var $el = this.$input
      , str = $el.val()

    $el.val(str + getChar(e.which))
  }
  Game.prototype.remove = function(e) {
    var $el = this.$input
      , str = $el.val()

    $el.val(str.substr(0, str.length))
    return this
  }
  Game.prototype.stack = function() {

  }
  Game.prototype.attack = function() {

  }
  Game.prototype.notify = function() {

  }
  Game.prototype.highlight = function() {

  }

  $(function() {
    current = window.current = new Game()

  })


}).call(this)