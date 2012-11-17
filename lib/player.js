
/*!
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter

/**
 * Player constructor
 *
 * @param {Object} redis connection object
 * @param {Object} socket.io connection
 * @inherits EventEmitter
 * @event `quit`: Emitted when client has disconnected
 */

function Player(attributes, client) {
  attributes || (attributes = {})
  this.attributes = attributes
  if (attributes.id) {
    this.id = attributes.id
  }
  this.client = client
}

/**
 * Parse a single player or an object map of players
 *
 * @param {Object|String} player information
 * @param {String} player id
 * @return {Object|Player} object map or single instance of players
 */

Player.parse = function(data, id) {
  var parsed = {}
  if ('object' === typeof data) {
    for (var id in data) {
      parsed[id] = Player.parse(data[id], id)
    }
    return parsed
  }
  data = data.split(':')
  return new Player({
    id: id
  , ready: data[0] === 'true' ? true : false
  , seat: data[1]
  })
}

/*!
 * Inherit from EventEmitter.
 */

Player.prototype.__proto__ = EventEmitter.prototype

/**
 * Get a storable attribute
 *
 * @param {String} property name
 */

Player.prototype.get = function(prop) {
  return this.attributes[prop]
}

/**
 * Set a storable attribute
 *
 * @param {String} property name
 * @param {Any} property value
 */

Player.prototype.set = function(prop, val) {
  this.attributes[prop] = val
  return this
}

/**
 * Convert to plain javascript object
 *
 * @return {Object} js object
 */

Player.prototype.toObject = function() {
  return this.attributes
}

/**
 * Convert to serialized string
 *
 * @return {String} redis string value
 */

Player.prototype.toString = function() {
  return this.get('ready') + ':' + this.get('seat')
}

/*!
 * Module exports.
 */

 module.exports = Player
