import { isObject } from './is';
import {
  CallEffect,
  Effect,
  Promisify,
  CoFn,
  DelayEffect,
  NextFn,
  AllEffects,
} from './types';

const noop = () => {};
const typeDetector = (type: string) => (value: any) =>
  value && isObject(value) && value.type === type;

const CALL = 'CALL';
const call = (fn: CoFn | any[], ...args: any[]): CallEffect => ({
  type: CALL,
  fn,
  args,
});
const isCall = typeDetector(CALL);
function callEffect({ fn, args }: { fn: CoFn; args: any[] }) {
  if (Array.isArray(fn)) {
    const [obj, fnName, ...fargs] = fn;
    return obj[fnName](...fargs);
  }

  const gen = fn.call(this, ...args);
  if (!gen || typeof gen.next !== 'function') {
    return Promise.resolve(gen);
  }

  return gen;
}

const ALL = 'ALL';
const all = (effects: AllEffects) => ({
  type: ALL,
  effects,
});
const isAll = typeDetector(ALL);
function allEffect({ effects }: { effects: AllEffects }, promisify: Promisify) {
  const ctx = this;

  if (Array.isArray(effects)) {
    const mapFn = (effect: Effect) =>
      effectHandler.call(ctx, effect, promisify);
    return effects.map(mapFn);
  }

  if (isObject(effects)) {
    const reduceFn = (acc: { [key: string]: Promise<any> }, key: string) => {
      return {
        ...acc,
        [key]: effectHandler.call(ctx, effects[key], promisify),
      };
    };
    return Object.keys(effects).reduce(reduceFn, {});
  }
}

const SPAWN = 'SPAWN';
const spawn = (fn: CoFn, ...args: any[]) => ({ type: SPAWN, fn, args });
const isSpawn = typeDetector(SPAWN);
function spawnEffect(
  { fn, args }: { fn: CoFn; args: any[] },
  promisify: Promisify,
) {
  return new Promise((resolve, reject) => {
    promisify(fn.call(this, ...args)).then(noop);
    resolve();
  });
}

const DELAY = 'DELAY';
const delay = (ms: number): DelayEffect => ({ type: DELAY, ms });
const isDelay = typeDetector(DELAY);
function delayEffect({ ms }: { ms: number }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

function effectHandler(effect: Effect, promisify: Promisify) {
  const ctx = this;
  if (isCall(effect)) return callEffect.call(ctx, effect);
  if (isAll(effect)) return allEffect.call(ctx, effect, promisify);
  if (isSpawn(effect)) return spawnEffect.call(ctx, effect, promisify);
  if (isDelay(effect)) return delayEffect.call(ctx, effect);
  return effect;
}

function effectMiddleware(next: NextFn) {
  return (effect: Effect, promisify: Promisify) => {
    const nextEffect = effectHandler(effect, promisify);
    return next(nextEffect);
  };
}

export { effectMiddleware, delay, call, spawn, all };
