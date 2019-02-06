import { effectMiddleware } from './effect';
import factoryBase from './factory';
import { Middleware } from './types';

export * from './effect';
export * from './types';

export const task = factoryBase(effectMiddleware);
export function factory(this: any, ...middleware: Middleware[]) {
  return factoryBase.apply(this, [...middleware, effectMiddleware]);
}
