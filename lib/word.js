
/*!
 * Module dependencies.
 */

var dictionary = require('./dictionary')
  , utils = require('./utils')
  , list = Object.keys(dictionary)
  , size = list.length
  , CHECK = 0

/**
 * Word constructor
 */

function Word(pid, word) {
  this.pid = pid
  this.word = word.toUpperCase()
}

/**
 * Find a random word in the dictionary
 *
 * @param {String} player id
 * @return {Word} random word
 */

Word.random = function(id) {
  return new Word(id, list[utils.getRandomInt(0, size)])
}

/**
 * Parse a single player or an object map of players
 *
 * @param {Object|String} player information
 * @param {String} player id
 * @return {Object|Player} object map or single instance of players
 */

Word.parse = function(data, toObject) {
  var parsed = toObject ? {} : []
  if (data instanceof Array) {
    for (var i = 0; i !== data.length; i++) {
      var arr = data[i].split(':')
        , pid = arr[0]
        , val = arr[1]
        , word = new Word(pid, val)

      toObject
        ? (parsed[pid] || (parsed[pid] = [])).push(word)
        : parsed.push(word)
    }
    return parsed
  }
  data = data.split(':')
  return new Word(data[0], data[1])
}

/**
 * Convert to plain javascript object
 *
 * @return {Object} js object
 */

Word.prototype.toObject = function() {
  return {
    word: this.word
  , pid: this.pid
  }
}

/**
 * Determine if a word is in the dictionary
 * 
 * @return {Boolean} valid word
 */

Word.prototype.isValid = function() {
  return dictionary[this.word] === CHECK
}

/**
 * Convert to serialized string
 *
 * @return {String} redis string value
 */

Word.prototype.toRedis = function() {
  return this.pid + ':' + this.word
}

/*!
 * Module exports.
 */

 module.exports = Word
