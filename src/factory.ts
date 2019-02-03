import { Middleware } from './types';

import runtime from './runtime';

export interface Runtime<Fn extends (...args: any[]) => any> {
  fn: Fn;
  args?: Parameters<Fn>;
  cancel?: Promise<any>;
}

function factory(...middleware: Middleware[]) {
  function externalRuntime<Fn extends (...args: any[]) => any, V = any>(
    this: any,
    gen: Runtime<Fn>,
    ...args: any[]
  ): Promise<V>;
  function externalRuntime<Fn extends (...args: any[]) => any, V = any>(
    this: any,
    gen: Fn,
    ...args: Parameters<Fn>
  ): Promise<V>;
  function externalRuntime<Fn extends (...args: any[]) => any, V = any>(
    this: any,
    gen: Fn | Runtime<Fn>,
    ...args: Parameters<Fn>
  ): Promise<V> {
    const ctx = this;
    if (typeof gen === 'function') {
      return runtime.call<any, any, any>(ctx, {
        fn: gen,
        args,
        middleware,
      });
    }

    return runtime.call<any, any, any>(ctx, {
      ...gen,
      middleware,
    });
  }

  return externalRuntime;
}

export default factory;
