export function isPromise(obj: any) {
  return 'function' == typeof obj.then;
}

export function isGenerator(obj: any) {
  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

export function isGeneratorFunction(obj: any) {
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

export function isObject(val: any) {
  return Object == val.constructor;
}
