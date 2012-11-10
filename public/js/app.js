
;(function() {
  'use strict'

  var $doc = $(document)
    , $win = $(window)
    , getChar = String.fromCharCode
    , speed = 5
    , current


  function Game() {
    var self = this

    this.socket = io.connect()
    this.words = {}
    this.players = {}
    this.playerId = null

    this.socket.on('connect', function() { self.connect() })
  }

  // Socket actions
  // --------------

  Game.prototype.connect = function() {
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
  Game.prototype.attacked = function() {

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

  Game.prototype.setup = function() {
    this.socket.on()
  }
  Game.prototype.fail = function() {

  }
  Game.prototype.win = function() {

  }
  Game.prototype.add = function() {

  }
  Game.prototype.remove = function() {

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
    current = new Game()
  })

  // Window/document event bindings
  $doc
    .unbind('keypress')
    .keypress(function(e) {
      if (e.which === 13) {
        attackDefend(word, function(e) {
          resetWord()
        })
      }
    })

}).call(this)