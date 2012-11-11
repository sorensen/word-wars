if (process.env.NODE_ENV !== 'production') require('rconsole')

var app     = require('express')()
  , server  = require('http').createServer(app)

app.set('server', server)

require('./config')(app)

require('./pages')(app)

require('./realtime')(app)

server.listen(app.settings.port, function () {
  console.log('Express server started on port: ' + app.settings.port)
})
