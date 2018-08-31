import { isPromise, isGenerator, isGeneratorFunction, isObject } from './is';
import { Middleware, Promisify, NextFn, CoFn } from './types';

function applyMiddleware(middlewares: Middleware[], ctx: any) {
  return (value: any, promisify: Promisify) => {
    const n = (effect: any) => effect;
    const compose = (acc: NextFn, md: Middleware) => md.call(ctx, acc);
    const chain = middlewares.reduce(compose, n);
    return chain(value, promisify);
  };
}

function factoryBase(...middleware: Middleware[]) {
  /**
   * Execute the generator function or a generator
   * and return a promise.
   */
  return function runtime<V>(gen: CoFn<V>, ...args: any[]) {
    const ctx = this;

    function promisify(obj: any): Promise<any> {
      if (!obj) return obj;
      if (isPromise(obj)) return obj;
      if (
        typeof obj === 'function' ||
        isGeneratorFunction(obj) ||
        isGenerator(obj)
      ) {
        return runtime.call(this, obj);
      }
      if (Array.isArray(obj)) {
        return Promise.all(obj.map(promisify));
      }
      if (isObject(obj)) return objectToPromise.call(this, obj);
      return obj;
    }

    function objectToPromise(obj: { [key: string]: CoFn<V> }) {
      const results = { ...obj };
      const keys = Object.keys(obj);
      const promises: Promise<any>[] = [];

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const promise = promisify.call(this, obj[key]);
        if (promise && isPromise(promise)) {
          defer(promise, key);
        } else {
          results[key] = obj[key];
        }
      }

      return Promise.all(promises).then(() => results);

      function defer(promise: Promise<any>, key: string) {
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
      const iter = typeof gen === 'function' ? gen.apply(ctx, args) : gen;

      if (!iter || typeof iter.next !== 'function') {
        return resolve(iter);
      }

      onFulfilled(); // kickstart generator

      function onFulfilled(res?: any) {
        try {
          const ret = iter.next(res);
          next(ret);
          return null;
        } catch (e) {
          return reject(e);
        }
      }

      function onRejected(err: any) {
        try {
          const ret = iter.throw(err);
          next(ret);
        } catch (e) {
          return reject(e);
        }
      }

      /**
       * Get the next value in the generator,
       * return a promise.
       */
      function next(ret: any) {
        const value = ret.value;
        if (ret.done) {
          return resolve(value);
        }

        const taskValue = applyMiddleware(middleware, ctx)(value, promisify);
        const promiseValue = promisify.call(ctx, taskValue);
        if (promiseValue && isPromise(promiseValue)) {
          return promiseValue.then(onFulfilled, onRejected);
        }

        const msg =
          `You may only yield a function, promise, generator, array, or` +
          ` object, but the following object was passed: "${ret.value}"`;

        return onRejected(new TypeError(msg));
      }
    });
  };
}

export default factoryBase;
