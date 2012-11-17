
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
      host: 'nodejitsudb2600402396.redis.irstack.com'
    , port: 6379
    , auth: 'nodejitsudb2600402396.redis.irstack.com:f327cfe980c971946e80b8e975fbebb4'
    }
  }
}