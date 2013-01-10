
module.exports = {
  development: {
    port: 3000
  , redis: {
      host: 'localhost'
    , port: 6379
    }
  , session: {
      secret: 'IvIVKmFkjE!!a3fP6C38%m%C0%n094bpGnn73GrJU5$oET6!tI^a4pmFs7X3!Ue^'
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