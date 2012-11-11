
;(function() {
  'use strict'

  function Sess () {
    var me = this
    me.current = {}

    me.$el.on('click', 'i', function (e) {
      me.$el.html('<form><input type="text" class="input input-small" '
        +' value="' + me.current.name + '" /></form>')
      me.$el.find('form input').focus()
    })

    me.$el.on('submit', function (e) {
      e.preventDefault()
      me.setName(me.current.name = me.$el.find('input').val())
      return false
    })

    conn.on('setName', function () { console.log('setname emit') })
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
    , getSession : function (cb) {
        var me = this
        conn.emit('getSession', function (err, session) {
          if (err) console.log(err)
          cb(me.sessions[conn.socket.sessionid] = me.current = session)
        })
    }
    , display : function () {
        var me = this
        console.log('display name')
        this.getSession(function (session) {
          if (!session.name) me.setName('anonymous')
          else me.$el.html('<i>' + me.current.name || session.name + '</i> <small class="icon icon-edit"></small>')
        })
    }
  }

  window.Sessions = Sess

}).call(this)
