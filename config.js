
module.exports = {
  development: {
    port: 3000
  , redis: {
      host: 'localhost'
    , port: 6379
    }  
  }
, production: {
    port: 80
  , redis: {
      host: 'localhost'
    , port: 6379
    , auth: ''
    }
  }
}