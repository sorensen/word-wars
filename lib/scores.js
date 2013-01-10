
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
  this.prefix = 'scores:'
}

/**
 * Get a score
 *
 * @param {String} key name
 * @param {Function} callback
 */

Scores.prototype.get = function(name, min, max, start, stop, next) {
  var limit = ''
  if (stop !== undefined) {
    limit = ' LIMIT ' + start + ' ' + stop
  }
  next || (next = arguments[arguments.length - 1])
  this.db.ZREVRANGEBYSCORE(this.prefix + name, min, max, 'WITHSCORES' + limit, function(err, resp) {
    if (err) return next && next(err)
    next && next(null, resp)
  })
  return this
}

/**
 * Get the top ten of any score
 *
 * @param {String} score name
 * @param {Function} callback
 */

Scores.prototype.getTopTen = function(name, next) {
  return this.get(name, '+inf', '-inf', 0, 10, next)
}

/**
 * Internal saving method
 *
 * @param {String} key name
 * @param {Number} score
 * @param {Function} callback
 * @api private
 */

Scores.prototype._set = function(name, score, member, next) {
  this.db.ZADD(this.prefix + name, score, member, function(err) {
    if (err) return next && next(err)
    next && next(null, resp)
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

Scores.prototype.set = function(name, score, member, next) {
  return this._set(name, score, member, next)
}

/**
 * Track a score according to time for auditing
 *
 * @param {String} score name
 * @param {String} key lookup
 * @param {Function} callback
 */

Scores.prototype.track = function(name, score, member, next) {
  return this._set(name + ':' + member, score, utils.timestamp(), next)
}

/**
 * Increment a score by 1
 *
 * @param {String} score name
 * @param {String} key lookup
 * @param {Function} callback
 */

Scores.prototype.inc = function(name, member, next) {
  this.db.ZINCRBY(this.prefix + name, 1, member, function(err, resp) {
    if (err) return next && next(err)
    next && next(null, resp)
  })
  return this
}

/*!
 * Module exports.
 */

module.exports = Scores
