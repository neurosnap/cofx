declare module 'cosed' {
  export type CoFn = Iterator<any>;
  export type Fn = (...args: any[]) => void | Iterator<any>;
  export interface CallEffect {
    type: 'CALL';
    fn: Fn;
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
    effects: Effect[];
  }
  export type Effect = { type: string } & { [key: string]: any };
  type NextFn = () => Middleware;
  type Promisify = (p: any) => Promise<any>;
  type Middleware = (next: NextFn) => (effect: Effect, promisify: Promisify) => Middleware;

  export function task(fn: CoFn, ...args: any[]): Promise<any>;
  export function call(fn: Fn, ...args: any[]): CallEffect;
  export function all(effects: Effect[]): AllEffect;
  export function delay(ms: number): DelayEffect;
  export function factory(...args: Middleware[]): (fn: CoFn) => Promise<any>;
  export function factoryBase(...args: Middleware[]): any;
  export function spawn(fn: Fn, ...args: any[]): any;
}
