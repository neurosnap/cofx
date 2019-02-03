import { isPromise, isGenerator, isGeneratorFunction, isObject } from './is';
import { Middleware } from './types';
import speculation from './speculation';
import applyMiddleware from './apply-middleware';

interface BaseRuntime<Fn extends (...args: any[]) => any> {
  fn: Fn;
  args?: Parameters<Fn>;
  cancel?: Promise<any>;
  middleware?: Middleware[];
}

/**
 * Execute the generator function or a generator
 * and return a promise.
 */
export default function runtime<V, Fn extends (...args: any[]) => any>(
  this: any,
  { fn, args, cancel, middleware = [] }: BaseRuntime<Fn>,
): Promise<V> {
  const ctx = this;

  function promisify(obj: any, genCancel?: Promise<any>): Promise<any> {
    const nCancel = genCancel || cancel;
    if (!obj) return obj;
    if (isPromise(obj)) return obj;
    if (
      typeof obj === 'function' ||
      isGeneratorFunction(obj) ||
      isGenerator(obj)
    ) {
      return runtime.call(ctx, {
        fn: obj,
        args: [],
        cancel: nCancel,
        middleware,
      });
    }
    if (Array.isArray(obj)) {
      const eff = obj.map((o) => promisify(o, nCancel));
      return Promise.all(eff);
    }
    if (isObject(obj)) return objectToPromise.call(ctx, obj);
    return obj;
  }

  function objectToPromise(obj: { [key: string]: any }) {
    const results = { ...obj };
    const keys = Object.keys(obj);
    const promises: Promise<any>[] = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const promise = promisify.call(ctx, obj[key]);
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
  return speculation((resolve, reject, onCancel) => {
    const iter = typeof fn === 'function' ? fn.apply(ctx, args || []) : fn;
    if (!iter || typeof iter.next !== 'function') {
      return resolve(iter);
    }

    onCancel(onCancelled);
    onFulfilled(); // kickstart generator

    function onCancelled(error: string) {
      try {
        iter.throw(error);
        reject({ error });
      } catch (err) {
        return reject(err);
      }
    }

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

      const taskValue = applyMiddleware(middleware, ctx)(
        value,
        promisify,
        cancel,
      );
      const promiseValue = promisify.call(ctx, taskValue);

      if (promiseValue && isPromise(promiseValue)) {
        return promiseValue.then(onFulfilled, onRejected);
      }

      const msg =
        `You may only yield a function, promise, generator, array, or` +
        ` object, but the following object was passed: "${ret.value}"`;

      return onRejected(new TypeError(msg));
    }
  }, cancel);
}
