const co = require('./index');
const fetch = require('node-fetch');
const assert = require('assert');

const task = (fn, ...args) => {
  return {
    type: 'TASK',
    fn,
    args,
  };
};

function* test() {
  const resp = yield task(fetch, 'http://httpbin.org/get');
  const data = yield resp.json();
  return data;
}

function* another() {
  const tmp = yield task(test);
  console.log(tmp);
}

co(another);

const gen = test();
const mock = {
  json: () => Promise.resolve(),
};
assert.deepEqual(gen.next().value, task(fetch, 'http://httpbin.org/get'));
gen.next(mock);
const last = gen.next('cool');
assert(last.done === true);
assert(last.value == 'cool');
// co(test);
