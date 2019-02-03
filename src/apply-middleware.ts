import { Middleware, Promisify, NextFn } from './types';

export default function applyMiddleware(middlewares: Middleware[], ctx: any) {
  return (value: any, promisify: Promisify, cancel?: Promise<any>) => {
    const n = (effect: any) => effect;
    const compose = (acc: NextFn, md: Middleware) => md.call(ctx, acc);
    const chain = middlewares.reduce(compose, n);
    return chain(value, promisify, cancel);
  };
}
