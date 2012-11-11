var express     = require('express')
  , connect     = require('connect')
  , cookie      = require('cookie')
  , redis       = require('redis')
  , ejs         = require('ejs')
  , parseCookie = connect.utils.parseSignedCookies
  , RedisStore  = require('connect-redis')(express)

module.exports = function (app) {
  var io = require('socket.io').listen(app.settings.server)

  app.configure('development', function () {
    app.set('redis', {
        host: 'localhost'
      , port: 6379
    })
    app.set('port', 3000)

    // app.use(express.logger())
  })

  app.configure('production', function () {
    app.set('redis', {
        host: 'nodejitsudb2600402396.redis.irstack.com'
      , port: 6379
      , auth: 'nodejitsudb2600402396.redis.irstack.com:f327cfe980c971946e80b8e975fbebb4'
    })
    app.set('port', 80)
  })

  app.configure(function () {
    app.set('io', io)
    app.set('db', redis.createClient(app.settings.redis.port, app.settings.redis.host))
    app.settings.db.auth(app.settings.redis.auth)
    app.set('sessionStore', new RedisStore({client: app.settings.db}))
    app.set('sessionSecret', 'IvIVKmFkjE!!a3fP6C38%m%C0%n094bpGnn73GrJU5$oET6!tI^a4pmFs7X3!Ue^')
    app.use(express.static(__dirname + '/public'))
    app.use(express.bodyParser())
    app.use(express.methodOverride())
    app.use(express.cookieParser())
    app.use(express.session({
        store: app.settings.sessionStore
      , secret: app.settings.sessionSecret
    }))
    app.use(express.errorHandler({ 
      dumpExceptions: true
    , showStack: true
    }))
    app.use(app.router)
  })

  io.configure(function () {
    
    io.disable('log');

    io.set('authorization', function (data, callback) {
      if (!data.headers.cookie) {
        return callback('No cookie', false)
      }

      var parsedCookie = parseCookie(cookie.parse(decodeURIComponent(data.headers.cookie)), app.settings.sessionSecret)
      app.settings.sessionStore.get(parsedCookie['connect.sid'], function (err, session) {
        if (err || !session) {
          return callback('Error', false)
        }

        data.session = session
        data.session.id = parsedCookie['connect.sid']
        callback(null, true)
      })
    })
  })
}
