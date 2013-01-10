
/*!
 * Module dependencies.
 */

if (process.env.NODE_ENV !== 'production') {
  require('rconsole')
}
var express = require('express')
  , app = express()
  , repl = require('repl')
  , server = require('http').createServer(app)
  , connect = require('connect')
  , cookie = require('cookie')
  , redis = require('redis')
  , ejs = require('ejs')
  , sio = require('socket.io')
  , io = sio.listen(server)
  , parseCookie = connect.utils.parseSignedCookies
  , RedisStore = require('connect-redis')(express)
  , Engine = require('./lib/engine')
  , config = require('./config')

/*!
 * Server configuration
 */

// Auto config each environment setting
for (var env in config) {
  var conf = config[env]
  app.configure(env, function() {
    for (var key in conf) {
      app.set(key, conf[key])
    }
  })
}

app.configure(function () {
  app.set('io', io)
  app.set('db', redis.createClient(app.settings.redis.port, app.settings.redis.host))
  app.settings.db.auth(app.settings.redis.auth)
  app.set('sessionStore', new RedisStore({client: app.settings.db}))
  app.set('sessionSecret', app.settings.session.secret)
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
  app.use(express.static(__dirname + '/public'))
  app.use(app.router)
})

/*!
 * Socket.io configuration
 */

io.configure(function () {
  var settings = app.settings
    , redisConf = settings.redis
    , RedisStore = sio.RedisStore
    , redisPub = redis.createClient(redisConf.port, redisConf.host)
    , redisSub = redis.createClient(redisConf.port, redisConf.host)
  
  redisPub.auth(redisConf.auth)
  redisSub.auth(redisConf.auth)

  io.set('store', new RedisStore({
    redis: redis
  , redisPub: redisPub
  , redisSub: redisSub
  , redisClient: settings.db
  }))
  
  io.disable('log');
  io.set('authorization', function (data, callback) {
    if (!data.headers.cookie) {
      return callback('No cookie', false)
    }
    var parsedCookie = parseCookie(cookie.parse(decodeURIComponent(data.headers.cookie)), app.settings.sessionSecret)
    settings.sessionStore.get(parsedCookie['connect.sid'], function (err, session) {
      if (err || !session) {
        return callback('Error', false)
      }
      data.session = session
      data.session.id = parsedCookie['connect.sid']
      callback(null, true)
    })
  })
})

app.set('server', server)
app.set('engine', new (Engine(app.settings.db, app.settings.io))())
require('./pages')(app)

/*!
 * Start REPL
 */

if (process.argv[2] === 'repl') {
  input = repl.start({
    prompt: ">>> "
  , input: process.stdin
  , output: process.stdout
  , useColors: true
  , useGlobal: true
  })
  // Set local context of REPL
  input.context.engine = app.settings.engine
}

/*!
 * Start server
 */

server.listen(app.settings.port, function() {
  console.log('Server started on port: ' + app.settings.port)
})
