const {
  isPromise,
  isGenerator,
  isGeneratorFunction,
  isObject,
} = require('./is');

const slice = Array.prototype.slice;

function applyMiddleware(middlewares, ctx) {
  return (...args) => {
    const n = (effect) => effect;
    const chain = middlewares.reduce((acc, md) => md.call(ctx, acc), n);
    return chain(...args);
  };
}

function factoryBase(...middleware) {
  /**
   * Execute the generator function or a generator
   * and return a promise.
   */
  return function runtime(gen, ...args) {
    const ctx = this;

    function promisify(obj) {
      if (!obj) return obj;
      if (isPromise(obj)) return obj;
      if (isGeneratorFunction(obj) || isGenerator(obj)) {
        return runtime.call(this, obj);
      }
      if (Array.isArray(obj)) return Promise.all(obj.map(promisify));
      if (isObject(obj)) return objectToPromise.call(this, obj);
      return obj;
    }

    function objectToPromise(obj) {
      var results = new obj.constructor();
      var keys = Object.keys(obj);
      var promises = [];

      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var promise = promisify.call(this, obj[key]);
        if (promise && isPromise(promise)) {
          defer(promise, key);
        } else results[key] = obj[key];
      }

      return Promise.all(promises).then(() => results);

      function defer(promise, key) {
        // predefine the key in the result
        results[key] = undefined;
        promises.push(
          promise.then((res) => {
            results[key] = res;
          }),
        );
      }
    }

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

      onFulfilled(); // kickstart generator

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
        const value = ret.value;
        if (ret.done) {
          return resolve(value);
        }

        const taskValue = applyMiddleware(middleware)(value, promisify);
        const promiseValue = promisify.call(ctx, taskValue);
        if (promiseValue && isPromise(promiseValue)) {
          return promiseValue.then(onFulfilled, onRejected);
        }

        const msg =
          `You may only yield a function, promise, generator, array, or` +
          ` object, but the following object was passed: "${String(
            ret.value,
          )}"`;

        return onRejected(new TypeError(msg));
      }
    });
  };
}

module.exports = factoryBase;
