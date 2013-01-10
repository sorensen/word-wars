
/*!
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , bcrypt = require('bcrypt')
  , uuid = require('node-uuid')
  , concat = Array.prototype.concat
  , slice = Array.prototype.slice
  , toString = Object.prototype.toString
  , noop = function(){}
  , db
  , EXPIRATION = 24 * 60 * 60 * 1000

/**
 * User constructor.
 *
 * @inherits EventEmitter
 * @event `loaded`: Emitted after attributes have been set from redis
 * @event `saved`: Emitted after attributes have been saved to redis
 */

function User(attr, sid) {
  attr || (attr = {})
  this.attributes = this.defaults(attr)
  if (attr.id) {
    this.id = attr.id
  }
  this.sid = sid // Socket id
  this.floodCount = 0
}

/**
 * Check if attributes are valid for saving
 *
 * @param {Object} user attributes
 * @param {Function} callback
 */

User.isValid = function(attr, next) {
  next || (next = noop)
  if (!attr.username) return next('Username required')
  if (!attr.hash && !attr.password) return next('Password required')
  if (!attr.id) {
    db.EXISTS('users: ', attr.username, function(err, exists) {
      if (err) return next(err)
      if (exists) return next('Username taken')
      next()
    })
  }
  return this
}

/**
 * Retrieve a stored user and authenticate
 *
 * @param {String} username
 * @param {String} password
 * @param {Function} callback
 */

User.authenticate = function(username, password, next) {
  db.HGETALL('users:' + username, function(err, data) {
    var user = new User(data)
    user.authenticate(password, function(err) {
      if (err) return next && next(err)
      next && next(user)
    })
  })
  return this
}

/**
 * Parse a single user or an object map of users
 *
 * @param {Object|String} user information
 * @param {String} player id
 * @return {Object|User} object map or single instance of user
 */

User.parse = function(data, id) {
  var parsed = {}
  if ('object' === typeof data) {
    for (var id in data) {
      parsed[id] = User.parse(data[id], id)
    }
    return parsed
  }
  return new User(data)
}

/*!
 * Inherit from EventEmitter.
 */

User.prototype.__proto__ = EventEmitter.prototype

/**
 * Ensure default attributes
 *
 * @param {Object} defined attributes
 * @returns {Object} combined attributes
 */

User.prototype.defaults = function(attr) {
  var defaults = {
    name: 'anonymous'
  , wins: 0
  , losses: 0
  , wpm: 0
  , games: 0
  }
  attr || (attr = {})
  for (var prop in attr) {
    defaults[prop] = attr[prop]
  }
  return defaults
}

/**
 * Convert to plain javascript object
 *
 * @return {Object} js object
 */

User.prototype.toObject = function() {
  var data = this.attributes
  data.id = this.sid
  return data
}

/**
 * Convert to serialized string
 *
 * @return {String} json stringified
 */

User.prototype.toRedis = function() {
  return JSON.stringify(this.toObject())
}

/**
 * Get a storable attribute
 *
 * @param {String} property name
 */

User.prototype.get = function(prop) {
  return this.attributes[prop]
}

/**
 * Set a storable attribute
 *
 * @param {String|Object} property name or mapping
 * @param {Any} property value
 */

User.prototype.set = function(prop, val) {
  if (toString.call(prop) === '[object Object]') {
    for (var name in prop) {
      this.attributes[name] = prop[name]
    }
  }
  this.attributes[prop] = val
  return this
}

/**
 * Load attributes from redis
 *
 * @param {Function} callback
 */

User.prototype.load = function(next) {
  var self = this
    , len = 1

  function callback() {
    if (!--len) {
      self.emit('loaded')
      next && next()
    }
  }
  db.GET('session:' + this.sid, function(err, data) {
    if (data) {
      session = JSON.parse(data)
      if (session.username) {
        len = 2
        db.HGETALL('users:' + session.username, function(data) {
          data && self.set(data)
          callback()
        })
      }
      self.set(session)
    }
    callback()
  })
  return this
}

/**
 * Set the user name
 *
 * @param {String} name
 * @param {Function} callback
 */

User.prototype.setName = function(name, next) {
  this.set('name', name)
  this.save(function() {
    next && next()
  })
  return this
}

/**
 * Check if instance is valid
 *
 * @param {Function} callback
 */

User.prototype.isValid = function(next) {
  return User.isValid(this.attributes, next)
}

/**
 * Save attributes to redis
 *
 * @param {Function} callback
 */

User.prototype.save = function(next) {
  var self = this
    , len = this.username ? 2 : 1
    , key = 'session:' + this.sid
  
  function callback(err) {
    if (!--len) {
      self.emit('saved')
      next && next()
    }
  }
  db.SET(key, this.toRedis(), function(err) {
    db.EXPIRE(key, EXPIRATION, callback)
  })
  if (this.username) {
    db.HMSET('users:' + this.username, this.toObject(), callback)
  }
  return this
}

/**
 * Create / save the user object, persisting as a user
 *
 * @param {Object} attributes
 * @param {Function} callback
 */

User.prototype.create = function(attr, next) {
  var self = this

  User.isValid(attr, function(err) {
    if (err) return next && next(err)

    this.id = uuid.v4()
    this.setPassword(attr.password, function() {
      delete attr.password
      self.attributes = attr
      this.save(function() {
        next && next()
      })
    })
  })
  return this
}

/**
 * Get session information for user
 *
 * @param {Function} callback
 */

User.prototype.getSession = function(next) {
  var self = this
  this.load(function() {
    next && next(null, self.toObject())
  })
  return this
}

/**
 * Hash and set a password using bcrypt
 *
 * @param {String} password
 * @param {Function} callback
 */

User.prototype.setPassword = function(password, next) {
  var self = this
  bcrypt.genSalt(10, function(err, salt) {
    if (err) return next && next(err)
    bcrypt.hash(password, salt, function(err, hash) {
      if (err) return next && next(err)
      self.hash = hash
      next && next()
    })
  })
  return this
}

/**
 * Authenticate the current user by password
 *
 * @param {String} password
 * @param {Function} callback
 */

User.prototype.authenticate = function(password, next) {
  var self = this
  if (!password || !this.hash) {
    return next && next('Missing parameters')
  }
  bcrypt.compare(password, this.hash, function(err, valid) {
    if (err) return next && next(err)
    valid && (self.anonymous = false)
    if (valid) return next && next(null, self)
    next('Invalid password')
  })
  return this
}

/**
 * Check if user is flooding messages
 *
 * @return {Number} count
 */

User.prototype.isFlooded = function() {
  return this.floodCount > 15
}

/**
 * Increment the flood counter, remove after delay
 */

User.prototype.floodTick = function() {
  var self = this
  this.floodCount += 1
  if (this.isFlooded()) {
    // Penalize for flooding
    setTimeout(function() {
      self.floodCount = 0
    }, this.floodCount * 1000)
  } else {
    this.floodTimeout && clearTimeout(this.floodTimeout)
    this.floodTimeout = setTimeout(function() {
      self.floodCount = Math.max(0, self.floodCount - 1)
    }, 1000)
  }
  return this
}

/*!
 * Module exports.
 */

module.exports = function(con) {
  db || (db = con)
  return User
}
