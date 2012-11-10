
var express = require('express')
  , ejs = require('ejs')
  , app = express()
  , port = 8000


app.configure(function() {
  app.use(express.static(__dirname + '/public'))
  app.use(express.bodyParser())
  app.use(express.cookieParser())
  app.use(express.methodOverride())
  app.set('views', __dirname + '/views')
  app.use(express.errorHandler({ 
    dumpExceptions: true
  , showStack: true
  }))
  app.use(app.router)
  app.engine('html', ejs.renderFile);
})

app.get('/', function(req, res) {
  res.render('index.html')
})


app.listen(port, function() {
  console.log('app started')
})