
/*!
 * Module dependencies.
 */

var utils = require('./utils')

/**
 * Score constructor
 *
 * @param {Object} redis client instance
 */

function Scores(db) {
  this.db = db
}

/**
 * Get a score
 *
 * @param {String} key name
 * @param {Function} callback
 */

Scores.prototype.get = function(name, next) {
  this.db.ZREVRANGEBYSCORE('scores:' + name, '+inf', '-inf', 'WITHSCORES LIMIT 0 10', function(err, replies) {
    next && next(replies)
  })
  return this
}

/**
 * Set a score
 *
 * @param {String} key name
 * @param {Number} score
 * @param {Function} callback
 */

Scores.prototype.set = function(name, score, next) {
  this.db.ZADD('scores:' + name, function(err) {
    next && next()
  })
  return this
}

/*!
 * Module exports.
 */

module.exports = Scores
