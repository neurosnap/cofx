function isPromise(obj) {
  return 'function' == typeof obj.then;
}

function isGenerator(obj) {
  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

function isGeneratorFunction(obj) {
  const constructor = obj.constructor;
  const name = constructor.name;
  const displayName = constructor.displayName;
  if (!constructor) {
    return false;
  }

  if (name === 'GeneratorFunction' || displayName === 'GeneratorFunction') {
    return true;
  }

  return isGenerator(constructor.prototype);
}

function isObject(val) {
  return Object == val.constructor;
}

module.exports = { isPromise, isGenerator, isGeneratorFunction, isObject };
