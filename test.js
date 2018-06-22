const { task, call, all, spawn } = require('./index');
const fetch = require('node-fetch');
const assert = require('assert');
const test = require('tape');
const nock = require('nock');
const genTester = require('gen-tester');

const noop = () => {};

function* genCall() {
  const resp = yield call(fetch, 'http://httpbin.org/get');
  const data = yield call([resp, 'json']);
  return { ...data, extra: 'stuff' };
}

test('task runner', (t) => {
  const mockData = { one: 2, extra: 'stuff' };

  nock('http://httpbin.org')
    .get('/get')
    .reply(200, mockData);

  t.plan(1);
  const assertData = (data) => {
    t.deepEqual(data, mockData, 'data should equal expected data');
  }

  task(genCall).then(assertData);
});

test('call effect', (t) => {
  t.plan(1);

  const respValue = { resp: 'value', json: 'hi' };
  const returnValue = { data: 'value', extra: 'stuff' };
  const tester = genTester(genCall)
  const actual = tester([
    respValue,
    { data: 'value' },
  ]);
  const expected = [
    call(fetch, 'http://httpbin.org/get'),
    call([respValue, 'json']),
    returnValue,
  ];

  t.deepEqual(actual, expected);
});

test('all effect', (t) => {
  t.plan(1);

  const effectOne = noop;
  const effectTwo = noop;
  function* genAll() {
    const res = yield all([
      call(effectOne, 'one'),
      call(effectTwo, 'two'),
    ]);

    return res;
  }
  const allVal = [{ one: true }, { two: true }];
  const tester = genTester(genAll);
  const actual = tester([allVal]);
  const expected = [
    all([
      call(effectOne, 'one'),
      call(effectTwo, 'two'),
    ]),
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
  const expected = [
    spawn(effect, val),
    'DONE',
  ];

  t.deepEqual(actual, expected);
});

/* function* example() {
  const resp = yield all([
    call(fetch, 'http://httpbin.org/get'),
    call(fetch, 'http://httpbin.org/get'),
  ]);
  const data = yield all(resp.map((r) => call([r, 'json'])));
  return data;
}

task(example).then(console.log);
*/
