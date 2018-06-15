function isPromise(obj) {
  return 'function' == typeof obj.then;
}

function isGenerator(obj) {
  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

function isGeneratorFunction(obj) {
  var constructor = obj.constructor;
  if (!constructor) return false;
  if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) return true;
  return isGenerator(constructor.prototype);
}

function isObject(val) {
  return Object == val.constructor;
}

module.exports = {
  isPromise,
  isGenerator,
  isGeneratorFunction,
  isObject,
};
