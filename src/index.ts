import { effectMiddleware, call, all, spawn, delay } from './effect';
import factoryBase from './factory';
import { Middleware } from './types';

const task = factoryBase(effectMiddleware);
const factory = (...middleware: Middleware[]) =>
  factoryBase.apply(this, [...middleware, effectMiddleware]);

export { all, call, delay, factory, factoryBase, spawn, task };
export * from './types';
