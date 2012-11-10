var express = require('express')
  , app     = express()
  , http    = require('http')
  , server  = http.createServer(app)

app.set('server', server)

require('./config')(app)

require('./routes')(app)

require('./realtime')(app)

server.listen(app.settings.port, function () {
  console.log('Express server started on port: ' + app.settings.port)
})
