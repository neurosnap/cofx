const { task, call, all, spawn, delay, factory } = require('..');
const fetch = require('node-fetch');
const test = require('tape');
const nock = require('nock');
const genTester = require('gen-tester');

const noop = () => {};

function* genCall() {
  const resp = yield call(fetch, 'http://httpbin.org/get');
  const data = yield call([resp, 'json']);
  return { ...data, extra: 'stuff' };
}

test('task runtime', (t) => {
  const mockData = { one: 2, extra: 'stuff' };

  nock('http://httpbin.org')
    .get('/get')
    .reply(200, mockData);

  t.plan(1);
  const assertData = (data) => {
    t.deepEqual(data, mockData, 'data should equal expected data');
  };

  task(genCall).then(assertData);
});

test('task runtime call generator', (t) => {
  function* one() {
    return 'hi';
  }
  function* two() {
    const val = yield call(one);
    return val;
  }

  t.plan(1);
  task(two)
    .then((data) => {
      t.equal(data, 'hi');
    })
    .catch(console.error);
});

test('task runtime call a normal function', (t) => {
  t.plan(1);
  function one() {
    return 'hi';
  }

  task(one).then((data) => {
    t.equal(data, 'hi');
  });
});

test('task runtime call effect normal function', (t) => {
  t.plan(1);
  function one() {
    return 'hi';
  }
  function* two() {
    const result = yield call(one);
    return result;
  }

  task(two).then((data) => {
    t.equal(data, 'hi');
  });
});

test('task runtime all effect object', (t) => {
  t.plan(1);
  function* one() {
    return 'hi';
  }
  function* two() {
    const result = yield all({
      one: call(one),
      two: call(one),
    });
    return result;
  }

  task(two).then((data) => {
    t.deepEqual(data, { one: 'hi', two: 'hi' });
  });
});

test('call effect', (t) => {
  t.plan(1);

  const respValue = { resp: 'value', json: 'hi' };
  const returnValue = { data: 'value', extra: 'stuff' };
  const tester = genTester(genCall);
  const actual = tester([respValue, { data: 'value' }]);
  const expected = [
    call(fetch, 'http://httpbin.org/get'),
    call([respValue, 'json']),
    returnValue,
  ];

  t.deepEqual(actual, expected);
});

test('all effect array', (t) => {
  t.plan(1);

  const effectOne = noop;
  const effectTwo = noop;
  function* genAll() {
    const res = yield all([call(effectOne, 'one'), call(effectTwo, 'two')]);

    return res;
  }
  const allVal = [{ one: true }, { two: true }];
  const tester = genTester(genAll);
  const actual = tester([allVal]);
  const expected = [
    all([call(effectOne, 'one'), call(effectTwo, 'two')]),
    allVal,
  ];

  t.deepEqual(actual, expected);
});

test('all effect object', (t) => {
  t.plan(1);

  const effectOne = noop;
  const effectTwo = noop;
  function* genAll() {
    const res = yield all({
      one: call(effectOne, 'one'),
      two: call(effectTwo, 'two'),
    });

    return res;
  }
  const allVal = { one: true, two: true };
  const tester = genTester(genAll);
  const actual = tester([allVal]);
  const expected = [
    all({
      one: call(effectOne, 'one'),
      two: call(effectTwo, 'two'),
    }),
    allVal,
  ];

  t.deepEqual(actual, expected);
});

test('spawn effect', (t) => {
  t.plan(1);

  function* effect() {}
  function* genSpawn(val) {
    yield spawn(effect, val);
    return 'DONE';
  }
  const val = 'value';
  const tester = genTester(genSpawn, val);
  const actual = tester([null]);
  const expected = [spawn(effect, val), 'DONE'];

  t.deepEqual(actual, expected);
});

test('delay effect', (t) => {
  t.plan(1);

  function* genDelay() {
    yield delay(1000);
    return 'DONE';
  }
  const val = 'value';
  const tester = genTester(genDelay);
  const actual = tester([null]);
  const expected = [delay(1000), 'DONE'];

  t.deepEqual(actual, expected);
});

test('custom middleware', (t) => {
  t.plan(1);

  const middleware = (next) => (effect) => {
    if (effect.type === 'CUSTOM_EFFECT') {
      t.ok(true, 'must rech this branch');
      return Promise.resolve();
    }

    return next(effect);
  };

  const customEffect = () => ({ type: 'CUSTOM_EFFECT' });
  function* genCustom() {
    yield customEffect();
  }

  const customTask = factory(middleware);
  customTask(genCustom);
});

/* function* sp() {
  const resp = yield call(fetch, 'http://httpbin.org/get');
  const json = yield call([resp, 'json']);
  console.log(json);
}

function* example() {
  const resp = yield all([
    call(fetch, 'http://httpbin.org/get'),
    call(fetch, 'http://httpbin.org/get'),
  ]);
  const data = yield all(resp.map((r) => call([r, 'json'])));
  yield spawn(sp);
  // return data;
}

task(example).then(console.log);
*/
