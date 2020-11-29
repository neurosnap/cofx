import { isObject } from './is';
import {
  CallEffectDescriptor,
  Effect,
  Promisify,
  CoFn,
  DelayEffectDescriptor,
  NextFn,
  EffectHandler,
  RaceEffectDescriptor,
  SpawnEffectDescriptor,
  SagaGenerator,
  SagaReturnType,
  EffectReturnType,
} from './types';
import speculation from './speculation';

const noop = (...args: any[]) => {};
export const typeDetector = (type: string) => (value: any) =>
  value && isObject(value) && value.type === type;

export const CALL = 'CALL';
export function call<Fn extends (...args: any[]) => any>(
  fn: Fn,
  ...args: Parameters<Fn>
): SagaGenerator<SagaReturnType<Fn>, CallEffectDescriptor<SagaReturnType<Fn>>>;
export function call<
  Ctx extends { [P in Name]: (this: Ctx, ...args: any[]) => any },
  Name extends string
>(
  ctxAndFnName: [Ctx, Name],
  ...args: Parameters<Ctx[Name]>
): SagaGenerator<
  SagaReturnType<Ctx[Name]>,
  CallEffectDescriptor<SagaReturnType<Ctx[Name]>>
>;
export function* call<Fn extends (...args: any[]) => any>(
  fn: Fn,
  ...args: Parameters<Fn>
): SagaGenerator<SagaReturnType<Fn>, CallEffectDescriptor<SagaReturnType<Fn>>> {
  const res: any = yield {
    type: CALL,
    fn,
    args,
  };
  return res;
}

const isCall = typeDetector(CALL);
function callEffect<Fn extends (...args: any[]) => any>(
  this: any,
  { fn, args }: { fn: Fn | any[]; args: Parameters<Fn> },
  promisify: Promisify,
  cancel: Promise<any>,
) {
  return speculation((resolve, reject, onCancel) => {
    let gen: any;
    if (Array.isArray(fn)) {
      const [obj, fnName, ...fargs] = fn;
      gen = obj[fnName](...fargs);
    } else {
      gen = fn.call(this, ...args);
    }

    if (!gen || typeof gen.next !== 'function') {
      return resolve(gen);
    }

    promisify(gen, cancel).then(resolve).catch(reject);

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
export function all<T extends { [key: string]: any }>(
  effects: T,
): SagaGenerator<{ [K in keyof T]: EffectReturnType<T[K]> }, any>;
export function all<T>(effects: T[]): SagaGenerator<EffectReturnType<T>[], any>;
export function* all(effects: any) {
  const res: any = yield {
    type: ALL,
    effects,
  };
  return res;
}

const isAll = typeDetector(ALL);
function allEffect(
  this: any,
  { effects }: { effects: any[] },
  promisify: Promisify,
  cancel: Promise<any>,
): Promise<any>[];
function allEffect(
  this: any,
  { effects }: { effects: any },
  promisify: Promisify,
  cancel: Promise<any>,
): Promise<any>[] | { [key: string]: Promise<any> } {
  const ctx = this;

  if (Array.isArray(effects)) {
    const mapFn = (effect: Effect<any>) =>
      effectHandler.call(ctx, { effect, promisify, cancel });
    const eff = effects.map(mapFn);
    return eff;
  }

  const reduceFn = (acc: { [key: string]: Promise<any> }, key: string) => {
    return {
      ...acc,
      [key]: effectHandler.call(ctx, {
        effect: effects[key] as any,
        promisify,
        cancel,
      }),
    };
  };
  const eff: { [key: string]: any } = Object.keys(effects).reduce(reduceFn, {});
  return eff;
}

export const RACE = 'RACE';
export function race<T extends { [key: string]: any }>(
  effects: T,
): SagaGenerator<{ [K in keyof T]: EffectReturnType<T[K]> }, any>;
export function race<T>(
  effects: T[],
): SagaGenerator<EffectReturnType<T>[], any>;
export function* race(effects: any) {
  const res = yield {
    type: RACE,
    effects,
  };
  return res;
}

const isRace = typeDetector(RACE);
function raceEffect(
  this: any,
  { effects }: { effects: any },
  promisify: Promisify,
  genCancel: Promise<any>,
): Promise<any>;
function raceEffect(
  this: any,
  { effects }: { effects: any[] },
  promisify: Promisify,
  genCancel: Promise<any>,
): Promise<any> {
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
    const mapFn = (effect: Effect<any>) => {
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

type Fn = (...args: any[]) => any;
export const FORK = 'FORK';
export const fork = (fn: Fn | any[], ...args: any[]) => ({
  type: FORK,
  fn,
  args,
});

const isFork = typeDetector(FORK);
function forkEffect(
  this: any,
  { fn, args }: { fn: Fn | any[]; args: any[] },
  promisify: Promisify,
  cancel: Promise<any>,
) {
  if (Array.isArray(fn)) {
    return speculation((resolve, reject) => {
      const [obj, fnName] = fn as any[];
      promisify(obj[fnName](...args))
        .then(noop)
        .catch(reject);
      resolve();
    }, cancel);
  }

  return speculation((resolve, reject) => {
    promisify((fn as Fn).call(this, ...args))
      .then(noop)
      .catch(reject);
    resolve();
  }, cancel);
}

export const SPAWN = 'SPAWN';
export const spawn = (fn: CoFn, ...args: any[]) => ({ type: SPAWN, fn, args });
const isSpawn = typeDetector(SPAWN);
function spawnEffect(
  this: any,
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
export const delay = (ms: number): DelayEffectDescriptor => ({
  type: DELAY,
  ms,
});
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

export function effectHandler(
  this: any,
  { effect, promisify, cancel }: EffectHandler,
) {
  const ctx = this;
  if (isCall(effect)) {
    return callEffect.call(
      ctx,
      effect as CallEffectDescriptor,
      promisify,
      cancel,
    );
  }
  if (isAll(effect)) {
    return allEffect.call(ctx, effect, promisify, cancel);
  }
  if (isRace(effect)) {
    return raceEffect.call(
      ctx,
      effect as RaceEffectDescriptor<any>,
      promisify,
      cancel,
    );
  }
  if (isSpawn(effect)) {
    return spawnEffect.call(ctx, effect as SpawnEffectDescriptor, promisify);
  }
  if (isFork(effect)) {
    return forkEffect.call(
      ctx,
      effect as CallEffectDescriptor,
      promisify,
      cancel,
    );
  }
  if (isDelay(effect)) {
    return delayEffect.call(ctx, effect as DelayEffectDescriptor, cancel);
  }
  return effect;
}

export function effectMiddleware(next: NextFn) {
  return (effect: Effect<any>, promisify: Promisify, cancel: Promise<any>) => {
    const nextEffect = effectHandler({ effect, promisify, cancel });
    return next(nextEffect);
  };
}
