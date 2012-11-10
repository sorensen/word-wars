var express     = require('express')
  , connect     = require('connect')
  , redis       = require('redis')
  , ejs         = require('ejs')
  , parseCookie = connect.utils.parseCookie
  , RedisStore  = require('connect-redis')(express)

module.exports = function (app) {
  var io = require('socket.io').listen(app.settings.server)

  app.configure('development', function () {
    app.set('redis', {
        host: 'localhost'
      , port: 6379
    })
    app.set('port', 3000)

    app.use(express.logger())
  })

  app.configure('production', function () {
    app.set('redis', {
        host: 'localhost'
      , port: 6379
    })
    app.set('port', 80)
  })

  app.configure(function () {
    app.set('io', io)
    app.set('db', redis.createClient(app.settings.redis.port, app.settings.redis.host))
    app.set('sessionStore', new RedisStore({client: app.settings.db}))
    app.use(express.static(__dirname + '/public'))
    app.use(express.bodyParser())
    app.use(express.methodOverride())
    app.set('views', __dirname + '/views')
    app.use(express.cookieParser())
    app.use(express.session({
        store: app.settings.sessionStore
      , secret: 'IvIVKmFkjE!!a3fP6C38%m%C0%n094bpGnn73GrJU5$oET6!tI^a4pmFs7X3!Ue^'
    }))
    app.use(express.errorHandler({ 
      dumpExceptions: true
    , showStack: true
    }))
    app.use(app.router)
    app.engine('html', ejs.renderFile)
  })

  io.configure(function () {
    io.set('authorization', function (data, callback) {
      if (!data.headers.cookie) {
        return callback('No cookie', false)
      }

      var cookie = parseCookie(data.headers.cookie)
      app.settings.sessionStore.get(cookie['connect.sid'], function (err, session) {
        if (err || !session) {
          return callback('Error', false)
        }

        data.session = session
        callback(null, true)
      })
    })
  })
}
