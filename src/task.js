const {
  isPromise,
  isGenerator,
  isGeneratorFunction,
  isObject,
} = require('./util');

const slice = Array.prototype.slice;

const noop = () => {};
const typeDetector = (type) => (value) =>
  isObject(value) && value.type === type;

const CALL = 'CALL';
const call = (fn, ...args) => ({ type: CALL, fn, args });
const isCall = typeDetector(CALL);
function callEffect({ fn, args }) {
  if (!Array.isArray(fn)) {
    return fn.call(this, ...args);
  }

  const [obj, fnName, ...fargs] = fn;
  return obj[fnName](...fargs);
}

const ALL = 'ALL';
const all = (effects) => ({ type: ALL, effects });
const isAll = typeDetector(ALL);
function allEffect({ effects }) {
  const ctx = this;

  if (Array.isArray(effects)) {
    const mapFn = (effect) => taskHandler.call(ctx, effect);
    return effects.map(mapFn);
  }

  if (isObject(effects)) {
    const reduceFn = (acc, key) => ({
      ...acc,
      [key]: taskHandler.call(ctx, effects[key]),
    });
    return Object
      .keys(effects)
      .reduce(reduceFn);
  }
}

const SPAWN = 'SPAWN';
const spawn = (fn, ...args) => ({ type: SPAWN, fn, args });
const isSpawn = typeDetector(SPAWN);
function spawnEffect({ fn, args }) {
  return new Promise((resolve, reject) => {
    toPromise(fn.call(this, ...args), task).then(noop);
    resolve();
  });
}

const CANCEL = 'CANCEL';
const cancel = (effect) => ({ type: CANCEL, effect });
const isCancel = typeDetector(CANCEL);
function cancelEffect({ effect }) {

}

/**
 * Convert a `yield`ed value into a promise.
 *
 * @param {Mixed} obj
 * @return {Promise}
 */
function toPromise(obj) {
  if (!obj) return obj;
  if (isPromise(obj)) return obj;
  if (isGeneratorFunction(obj) || isGenerator(obj)) return task.call(this, obj);
  if (Array.isArray(obj)) return arrayToPromise.call(this, obj);
  if (isObject(obj)) return objectToPromise.call(this, obj);
  return obj;
}

function taskHandler(effect) {
  const ctx = this;
  if (isCall(effect)) return callEffect.call(ctx, effect);
  if (isAll(effect)) return allEffect.call(ctx, effect);
  if (isSpawn(effect)) return spawnEffect.call(ctx, effect);
  return effect;
}

/**
 * Wrap the given generator `fn` into a
 * function that returns a promise.
 * This is a separate function so that
 * every `task()` call doesn't create a new,
 * unnecessary closure.
 *
 * @param {GeneratorFunction} fn
 * @return {Function}
 */
task.wrap = (fn, ...args) => {
  createPromise.__generatorFunction__ = fn;
  const createPromise = () => task.call(this, fn.apply(this, args));
  return createPromise;
};

/**
 * Execute the generator function or a generator
 * and return a promise.
 */
function task(gen, ...args) {
  const ctx = this;

  // we wrap everything in a promise to avoid promise chaining,
  // which leads to memory leak errors.
  // see https://github.com/tj/co/issues/180
  return new Promise((resolve, reject) => {
    if (typeof gen === 'function') {
      gen = gen.apply(ctx, args);
    }

    if (!gen || typeof gen.next !== 'function') {
      return resolve(gen);
    }

    onFulfilled();

    function onFulfilled(res) {
      var ret;

      try {
        ret = gen.next(res);
      } catch (e) {
        return reject(e);
      }

      next(ret);
      return null;
    }

    function onRejected(err) {
      var ret;

      try {
        ret = gen.throw(err);
      } catch (e) {
        return reject(e);
      }

      next(ret);
    }

    /**
     * Get the next value in the generator,
     * return a promise.
     */
    function next(ret) {
      if (ret.done) {
        return resolve(ret.value);
      }

      const taskValue = taskHandler.call(ctx, ret.value);
      const value = toPromise.call(ctx, taskValue);

      if (value && isPromise(value)) {
        return value.then(onFulfilled, onRejected);
      }

      const msg = `You may only yield a function, promise, generator, array, or`
        + ` object, but the following object was passed: "${String(ret.value)}"`;

      return onRejected(new TypeError(msg));
    }
  });
}

/**
 * Convert an array of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 *
 * @param {Array} arr
 * @return {Promise}
 */
function arrayToPromise(arr) {
  const mapFn = (obj) => toPromise.call(this, obj);
  return Promise.all(arr.map(mapFn));
}

/**
 * Convert an object of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 *
 * @param {Object} obj
 * @return {Promise}
 * @api private
 */
function objectToPromise(obj) {
  var results = new obj.constructor();
  var keys = Object.keys(obj);
  var promises = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var promise = toPromise.call(this, obj[key]);
    if (promise && isPromise(promise)) defer(promise, key);
    else results[key] = obj[key];
  }
  return Promise.all(promises).then(function () {
    return results;
  });

  function defer(promise, key) {
    // predefine the key in the result
    results[key] = undefined;
    promises.push(promise.then(function (res) {
      results[key] = res;
    }));
  }
}

module.exports = { task, call, all, spawn };
