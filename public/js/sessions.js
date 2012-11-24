
;(function() {
'use strict'

/**
 * Client constructor.
 *
 * @param {Object} socket.io connection
 */

function Session(socket) {
  var self = this
    , $el = this.$el = $('#current-user p')

  this.id = null
  this.current = {}
  this.sessions = {}
  this.socket = socket

  $el.on('click', 'i', function(e) {
    $el
      .html(''
        + '<form>'
        + '  <input type="text" class="input input-small" value="' + self.current.name + '" />'
        + '</form>'
      )
      .find('form input')
      .focus()
  })
  $el.on('submit', function(e) {
    e.preventDefault()
    self.setName(self.current.name = $el.find('input').val())
    return false
  })
  this.socket.on('session', function() { self.gotSession.apply(self, arguments) })
}

/**
 * Set session name
 *
 * @param {String} name
 * @param {Function} callback
 */

Session.prototype.setName = function(name, next) {
  var self = this
  this.socket.emit('setName', name, function(err) {
    self.display()
    next && next()
  })
  return this
}

/**
 * Get session data
 *
 * @param {Function} callback
 */

Session.prototype.getSession = function(next) {
  var self = this
  this.socket.emit('getSession', function(err, session) {
    if (!err) {
      self.gotSession(session)
      next && next(session)
    }
  })
  return this
}

/**
 * Received session data from the server
 *
 * @param {Object} session data
 */

Session.prototype.gotSession = function(session) {
  this.sessions[this.socket.socket.sessionid] = this.current = session
  this.id = session.id
  return this
}

/**
 * Display session details
 */

Session.prototype.display = function() {
  var self = this
  this.getSession(function(session) {
    session.name
      ? self.$el.html('<i>' + self.current.name || session.name + '</i> <small class="icon icon-edit"></small>')
      : self.setName('anonymous')
  })
  return this
}

/*!
 * Module exports.
 */

this.Sessions = Session

}).call(this);
