declare module 'cofx' {
  export type CoFn = (...args: any[]) => any;
  export type TaskFn = (fn: CoFn, ...args: any[]) => Promise<any>;
  export type Fn = (...args: any[]) => any;
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
  export interface AllEffect {
    type: 'ALL';
    effects: Effect[] | { [key: string]: Effect };
  }
  export type Effect = { type: string } & { [key: string]: any };
  export type NextFn = (...args: any[]) => Middleware;
  export type Promisify = (p: any) => Promise<any>;
  export type Middleware = (
    next: NextFn,
  ) => (effect: Effect, promisify: Promisify) => Middleware;

  export function task(fn: CoFn, ...args: any[]): Promise<any>;
  export function call(fn: Fn | any[], ...args: any[]): CallEffect;
  export function all(effects: Effect[]): AllEffect;
  export function delay(ms: number): DelayEffect;
  export function factory(...args: Middleware[]): TaskFn;
  export function factoryBase(...args: Middleware[]): any;
  export function spawn(fn: Fn, ...args: any[]): any;
}
