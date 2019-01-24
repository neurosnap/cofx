export type Fn = (...args: any[]) => void;
export type GenFn<V = any> = (...args: any[]) => IterableIterator<V>;
export type CoFn<V = any> = GenFn<V> | Fn;

export type TaskFn<V> = (fn: CoFn<V>, ...args: any[]) => Promise<any>;
export interface CallEffect {
  type: 'CALL';
  fn: Fn | any[];
  args: any[];
}
export interface SpawnEffect {
  type: 'SPAWN';
  fn: Fn;
  args: any[];
}
export interface DelayEffect {
  type: 'DELAY';
  ms: number;
}
export type AllEffects = Effect[] | { [key: string]: Effect };
export interface AllEffect {
  type: 'ALL';
  effects: AllEffects;
}
export type Effect = { type: string } & { [key: string]: any };
export type NextFn = (...args: any[]) => Middleware;
export type Promisify = (p: any, cancel?: Promise<any>) => Promise<any>;
export type Middleware = (
  next: NextFn,
) => (
  effect: Effect,
  promisify: Promisify,
  cancelPromise: Promise<any>,
) => Middleware;

export interface Runtime<V> {
  fn: CoFn<V>;
  args?: any[];
  cancel?: any;
}
export interface EffectHandler {
  effect: Effect;
  promisify: Promisify;
  cancel: Promise<any>;
}
