
;(function() {
  'use strict'

  function HighScores () {
    var me = this
    me.scores = []
  }

  HighScores.prototype = {
      $el : $('.high-scores')
    , setScore : function (name, score, cb) {
        var me = this
        conn.emit('setScore', name, score, function (err) {
          me.display()
          cb && cb()
        })
        return me
    }
    , get : function (cb) {
        var me = this
        conn.emit('getScores', function (scores) {
          console.log('scores', scores)
          cb(me.scores = scores)
        })
        return me
    }
    , display : function () {
        var me = this
        this.get(function (scores) {
          me.$el.empty()
          if (!scores || !scores.length) me.$el.append('no high scores yet')
          else scores.forEach(function (score) {
            me.$el.append(views.highScores(score))
          })
        })
        return me
    }
  }

  window.HighScores = new HighScores()

}).call(this)
