import { isObject } from './is';
import { Middleware, CoFn, Runtime } from './types';

import runtime from './runtime';

function factory(...middleware: Middleware[]) {
  return function externalRuntime<V>(
    gen: CoFn<V> | Runtime<V>,
    ...args: any[]
  ) {
    const ctx = this;

    if (isObject(gen)) {
      return runtime.call(ctx, {
        ...gen,
        middleware,
      });
    }

    return runtime.call(ctx, {
      fn: gen,
      args,
      middleware,
    });
  };
}

export default factory;
