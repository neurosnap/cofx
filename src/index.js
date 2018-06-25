const { effectMiddleware, call, all, spawn, delay } = require('./effect');
const factoryBase = require('./factory');

const task = factoryBase(effectMiddleware);
const factory = (...middleware) =>
  factoryBase.apply(this, [...middleware, effectMiddleware]);

module.exports = {
  all,
  call,
  delay,
  factory,
  factoryBase,
  spawn,
  task,
};
