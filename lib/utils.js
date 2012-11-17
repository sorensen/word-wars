
/**
 * Shortcut for getting current timestamp
 *
 * @return {Number} unix timestamp
 */

exports.timestamp = function() {
  return new Date().getTime()
}

/**
 * Random integer generator
 *
 * @param {Number} lower bounds
 * @param {Number} upper bounds
 * @return {Number} random integer
 */

exports.getRandomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
