import { effectMiddleware } from './effect';
import factoryBase from './factory';
import { Middleware } from './types';

export * from './effect';
export * from './types';

export const task = factoryBase(effectMiddleware);
export const factory = (...middleware: Middleware[]) =>
  factoryBase.apply(this, [...middleware, effectMiddleware]);
