const { isObject } = require('./is');

const noop = () => {};
const typeDetector = (type) => (value) =>
  value && isObject(value) && value.type === type;

const CALL = 'CALL';
const call = (fn, ...args) => ({ type: CALL, fn, args });
const isCall = typeDetector(CALL);
function callEffect({ fn, args }) {
  if (!Array.isArray(fn)) {
    return fn.call(this, ...args);
  }

  const [obj, fnName, ...fargs] = fn;
  return obj[fnName](...fargs);
}

const ALL = 'ALL';
const all = (effects) => ({ type: ALL, effects });
const isAll = typeDetector(ALL);
function allEffect({ effects }, promisify) {
  const ctx = this;

  if (Array.isArray(effects)) {
    const mapFn = (effect) => effectHandler.call(ctx, effect, promisify);
    return effects.map(mapFn);
  }

  if (isObject(effects)) {
    const reduceFn = (acc, key) => ({
      ...acc,
      [key]: effectHandler.call(ctx, effects[key], promisify),
    });
    return Object
      .keys(effects)
      .reduce(reduceFn);
  }
}

const SPAWN = 'SPAWN';
const spawn = (fn, ...args) => ({ type: SPAWN, fn, args });
const isSpawn = typeDetector(SPAWN);
function spawnEffect({ fn, args }, promisify) {
  return new Promise((resolve, reject) => {
    promisify(fn.call(this, ...args)).then(noop);
    resolve();
  });
}

const DELAY = 'DELAY';
const delay = (ms) => ({ type: DELAY, ms });
const isDelay = typeDetector(DELAY);
function delayEffect({ ms }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => { resolve(); }, ms);
  });
}

function effectHandler(effect, promisify) {
  const ctx = this;
  if (isCall(effect)) return callEffect.call(ctx, effect);
  if (isAll(effect)) return allEffect.call(ctx, effect, promisify);
  if (isSpawn(effect)) return spawnEffect.call(ctx, effect, promisify);
  if (isDelay(effect)) return delayEffect.call(ctx, effect);
  return effect;
}

function effectMiddleware(next) {
  return (effect, promisify) => {
    const nextEffect = effectHandler(effect, promisify);
    return next(nextEffect);
  }
}

module.exports = { effectMiddleware, delay, call, spawn, all };
