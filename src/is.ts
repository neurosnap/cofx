function isPromise(obj: any) {
  return 'function' == typeof obj.then;
}

function isGenerator(obj: any) {
  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

function isGeneratorFunction(obj: any) {
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

function isObject(val: any) {
  return Object == val.constructor;
}

export { isPromise, isGenerator, isGeneratorFunction, isObject };
