
;(function() {
  'use strict'

  function Sess () {
    var me = this
    me.current = {}

    me.$el.on('click', 'i', function (e) {
      me.$el.html('<form><input type="text" class="input input-small" '
        +' value="' + (me.current.name || '') + '" /></form>')
      me.$el.find('form input').focus()
    })

    me.$el.on('submit', function (e) {
      e.preventDefault()
      me.setName(me.current.name = me.$el.find('input').val())
    })

  }

  Sess.prototype = {
      $el : $('#session-bar div h4')
    , sessions : {}
    , setName : function (name, cb) {
        var me = this
        conn.emit('setName', name, function (err) {
          me.display()
          cb && cb()
        })
    }
    , get : function (socketid, cb) {
        var me = this
        conn.emit('getSession', socketid, function (err, session) {
          if (err) console.log(err)
          cb(me.sessions[socketid] = me.current = JSON.parse(session))
        })
    }
    , display : function () {
        var me = this
        this.get(window.conn.socket.sessionid, function (session) {
          if (!session.name) me.setName('anonymous')
          else me.$el.html('<i>' + session.name + '</i> <small class="icon icon-edit"></small>')
        })
    }
  }

  window.Sessions = new Sess()

}).call(this)
