
/*!
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , utils = require('./utils')
  , Word = require('./word')
  , dictionary = require('./dictionary')
  , dictionaryList = Object.keys(dictionary)
  , dictionaryLength = dictionaryList.length

/**
 * Computer constructor
 *
 * @inherits EventEmitter
 */

function Computer(room, options) {
  var self = this
  options || (options = {})

  this.difficulty = options.difficulty || 'normal'
  this.mode = options.mode || 'normal'

  this.room = room
  this.maxLength = options.maxLength || 10
  this.interval = options.interval || 1000
}

/*!
 * Inherit from EventEmitter.
 */

Computer.prototype.__proto__ = EventEmitter.prototype

/**
 * Computation interval
 */

Computer.prototype.tick = function() {
  var self = this
    , room = this.room
    , now = utils.timestamp()
    , started = this.started
    , thisTime = this.nextTime
    , nextAttackWave = Math.max(1000 * (5 - (now - started) / 30000), 1000)
    , nextTime = now + nextAttackWave
    , players = this.room.players
    , keys = Object.keys(players)
    , first = players[keys.pop()]
    , second = players[keys.pop()]

  if (!first || !second) {
    return this
  }
  if (now > thisTime) {
    var timeout = this.nextTime * 1000

    setTimeout(function() { 
      if (!self.room) {
        return
      }
      self.attack(self.generateWord(second.id), first, second)
      self.attack(self.generateWord(first.id), second, first)
      self.nextTime = nextTime
    }, timeout)
  }
  return this
}

/**
 * Auto attack a player in a room
 *
 * @param {Word} word instance
 * @param {Player} mock attacker
 * @param {Player} mock defender
 */

Computer.prototype.attack = function(word, attacker, defender) {
  var self = this
  this.room.attack(word, attacker, defender, function(err) {
    if (err) {
      self.attack(word, attacker, defender)
    }
  }, true)
  return this
}

/**
 * Start tick and computations
 */

Computer.prototype.start = function() {
  var now = utils.timestamp()
    , self = this

  this.started = now
  this.nextTime = now + 5 * 1000
  this.ticker = setInterval(function() {
    self.tick()
  }, this.interval)
  return this
}

/**
 * Stop running
 */

Computer.prototype.stop = function() {
  this.ticker && clearInterval(this.ticker)
  return this
}

/**
 * Generate a random word that has not been used
 *
 * @return {Word} generated word
 */

Computer.prototype.generateWord = function(id) {
  var random = Word.random(id)
    , max = this.maxLength

  return random.word.length > this.maxLength
    ? this.generateWord(id)
    : random
}

/*!
 * Module exports.
 */

module.exports = Computer
