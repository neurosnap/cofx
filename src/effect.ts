import { isObject } from './is';
import {
  CallEffect,
  Effect,
  Promisify,
  CoFn,
  DelayEffect,
  NextFn,
  AllEffects,
  EffectHandler,
} from './types';
import speculation from './speculation';

const noop = (...args: any[]) => {};
export const typeDetector = (type: string) => (value: any) =>
  value && isObject(value) && value.type === type;

export const CALL = 'CALL';
export const call = (fn: CoFn | any[], ...args: any[]): CallEffect => ({
  type: CALL,
  fn,
  args,
});
const isCall = typeDetector(CALL);
function callEffect(
  { fn, args }: { fn: CoFn; args: any[] },
  promisify: Promisify,
  cancel: Promise<any>,
) {
  return speculation((resolve, reject, onCancel) => {
    if (Array.isArray(fn)) {
      const [obj, fnName, ...fargs] = fn;
      return resolve(obj[fnName](...fargs));
    }

    const gen = fn.call(this, ...args);

    if (!gen || typeof gen.next !== 'function') {
      return resolve(gen);
    }

    promisify(gen, cancel)
      .then(resolve)
      .catch(reject);

    onCancel((msg) => {
      if (typeof gen.next === 'function') {
        try {
          gen.throw(msg);
        } catch (err) {
          console.log(err);
        }
      }
      reject(msg);
    });
  }, cancel);
}

export const ALL = 'ALL';
export const all = (effects: AllEffects) => ({
  type: ALL,
  effects,
});
const isAll = typeDetector(ALL);
function allEffect(
  { effects }: { effects: AllEffects },
  promisify: Promisify,
  cancel: Promise<any>,
) {
  const ctx = this;

  if (Array.isArray(effects)) {
    const mapFn = (effect: Effect) =>
      effectHandler.call(ctx, { effect, promisify, cancel });
    const eff = effects.map(mapFn);
    return eff;
  }

  if (isObject(effects)) {
    const reduceFn = (acc: { [key: string]: Promise<any> }, key: string) => {
      return {
        ...acc,
        [key]: effectHandler.call(ctx, {
          effect: effects[key],
          promisify,
          cancel,
        }),
      };
    };
    const eff: { [key: string]: any } = Object.keys(effects).reduce(
      reduceFn,
      {},
    );
    return eff;
  }
}

export const RACE = 'RACE';
export const race = (effects: AllEffects) => ({
  type: RACE,
  effects,
});
const isRace = typeDetector(RACE);
function raceEffect(
  { effects }: { effects: AllEffects },
  promisify: Promisify,
  genCancel: Promise<any>,
) {
  const ctx = this;
  // super hacky way to cancel a chain of promises/generators
  let forceCancel = noop;
  const cancel = new Promise((resolve) => {
    if (genCancel && typeof genCancel.then === 'function') {
      genCancel.then(resolve);
    }
    forceCancel = resolve;
  });

  if (Array.isArray(effects)) {
    const mapFn = (effect: Effect) => {
      return promisify(effectHandler.call(ctx, { effect, promisify, cancel }));
    };
    const eff = effects.map(mapFn);
    return Promise.race(eff)
      .then((result) => {
        forceCancel('cancelled by race');
        return result;
      })
      .catch((err) => {
        forceCancel(err);
      });
  }

  const keys = Object.keys(effects);
  return Promise.race(
    keys.map((key: string) => {
      return promisify(
        effectHandler.call(ctx, { effect: effects[key], promisify, cancel }),
      ).then((result) => {
        return {
          winner: key,
          result,
        };
      });
    }),
  ).then((result) => {
    forceCancel('cancelled by race');
    return keys.reduce((acc: { [key: string]: any }, key: string) => {
      if (result.winner === key) {
        acc[key] = result.result;
      } else {
        acc[key] = undefined;
      }

      return acc;
    }, {});
  });
}

export const FORK = 'FORK';
export const fork = (fn: CoFn, ...args: any[]) => ({ type: FORK, fn, args });
const isFork = typeDetector(FORK);
function forkEffect(
  { fn, args }: { fn: CoFn; args: any[] },
  promisify: Promisify,
  cancel: Promise<any>,
) {
  return speculation((resolve, reject) => {
    promisify(fn.call(this, ...args))
      .then(noop)
      .catch(reject);
    resolve();
  }, cancel);
}

export const SPAWN = 'SPAWN';
export const spawn = (fn: CoFn, ...args: any[]) => ({ type: SPAWN, fn, args });
const isSpawn = typeDetector(SPAWN);
function spawnEffect(
  { fn, args }: { fn: CoFn; args: any[] },
  promisify: Promisify,
) {
  return speculation((resolve, reject, onCancel) => {
    promisify(fn.call(this, ...args))
      .then(noop)
      .catch(reject);
    resolve();

    onCancel(() => {
      reject();
    });
  });
}

export const DELAY = 'DELAY';
export const delay = (ms: number): DelayEffect => ({ type: DELAY, ms });
const isDelay = typeDetector(DELAY);
function delayEffect({ ms }: { ms: number }, cancel: Promise<any>) {
  return speculation((resolve, reject, onCancel) => {
    const timerId = setTimeout(() => {
      resolve();
    }, ms);

    onCancel(() => {
      clearTimeout(timerId);
      reject('delay has been cancelled.');
    });
  }, cancel);
}

export function effectHandler({ effect, promisify, cancel }: EffectHandler) {
  const ctx = this;
  if (isCall(effect)) return callEffect.call(ctx, effect, promisify, cancel);
  if (isAll(effect)) return allEffect.call(ctx, effect, promisify, cancel);
  if (isRace(effect)) return raceEffect.call(ctx, effect, promisify, cancel);
  if (isSpawn(effect)) return spawnEffect.call(ctx, effect, promisify);
  if (isFork(effect)) return forkEffect.call(ctx, effect, promisify, cancel);
  if (isDelay(effect)) return delayEffect.call(ctx, effect, cancel);
  return effect;
}

export function effectMiddleware(next: NextFn) {
  return (effect: Effect, promisify: Promisify, cancel: Promise<any>) => {
    const nextEffect = effectHandler({ effect, promisify, cancel });
    return next(nextEffect);
  };
}
