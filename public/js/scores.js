
;(function(views) {
'use strict'

/**
 * Scores constructor
 *
 * @param {Object} socket connection
 */

function Scores(socket) {
  this.data = []
  this.socket = socket
  this.$el = $('.high-scores')
}

/**
 * Set a score
 *
 * @param {String} key name
 * @param {Number} value
 * @param {Function} callback
 */

Scores.prototype.set = function(name, score, next) {
  var self = this
  this.socket.emit('setScore', name, score, function(err) {
    self.display()
    next && next()
  })
  return this
}

/**
 * Get all scores
 *
 * @param {Function} callback
 */

Scores.prototype.get = function(next) {
  var self = this
  this.socket.emit('getScores', function(data) {
    self.data = data
    next && next(data)
  })
  return this
}

/**
 * Display score details
 */

Scores.prototype.display = function() {
  var self = this
    , $el = this.$el

  this.get(function(data) {
    $el.empty()
    if (!data || !data.length) {
      $el.append('No high scores')
    } else {
      $el.append(views.highScores(score))
    }
  })
}

/*!
 * Module exports.
 */

this.Scores = Scores

}).call(this, views);
