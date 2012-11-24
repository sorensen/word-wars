
;(function() {
'use strict'

/*!
 * Module dependencies.
 */

var concat = Array.prototype.concat
  , slice = Array.prototype.slice

/**
 * Proxy constructor
 */

function Proxy() {}

/**
 * Call a method of the given scope, prepending any given
 * args to the function call along with sent arguments
 *
 * @param {Object} scope of method call
 * @param {String} method name
 * @param {...} additional arguments to be used every method call
 * @return {Object} js object
 */

Proxy.prototype.proxy = function(scope, method) {
  var scope = scope || this
    , args = slice.call(arguments, 2)
  if (!scope[method]) {
    throw new Error('Proxy method `' + method + '` does not exist')
  }
  return function() {
    console.log('proxied: ', method)
    return scope[method].apply(scope, concat.apply(args, arguments))
  }
}

/**
 * Setup all proxy methods, if an array is supplied for the methods
 * the event will be proxied to a method of the same name
 *
 * @param {Object} scope of method calls
 * @param {Array|Objects} methods to bind
 * @param {Object} event emitting object
 * @param {...} additional arguments to be used on every method
 */

Proxy.prototype.setup = function(scope, methods, emitter) {
  var scope = scope || this
    , args = slice.call(arguments, 3)
    , map = {}
    , len

  if (methods instanceof Array) {
    len = methods.length
    while (len--) {
      map[methods[len]] = methods[len]
    }
    methods = map
  }
  for (var name in methods) {
    var method = methods[name]
    if (!scope[method]) {
      throw new Error('Proxy setup method `' + method + '` does not exist')
    }
    emitter.on(name, this.proxy.apply(scope, concat.apply([scope, method], args)))
  }
  return this
}

/*!
 * Module exports.
 */

if (typeof exports !== 'undefined') {
  module.exports = new Proxy()
} else {
  this.Proxy = new Proxy()
}

}).call(this);
