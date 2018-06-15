const { task, call, all, spawn } = require('./index');
const fetch = require('node-fetch');
const assert = require('assert');
const test = require('tape');
const nock = require('nock');

const noop = () => {};

function* genCall() {
  const resp = yield call(fetch, 'http://httpbin.org/get');
  const data = yield call([resp, 'json']);
  return data;
}

test('task runner', (t) => {
  const mockData = { one: 2 };

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
  const gen = genCall();

  t.plan(4);

  t.deepEqual(
    gen.next().value,
    call(fetch, 'http://httpbin.org/get'),
    'should make http request',
  );

  const respValue = { resp: 'value', json: 'hi' };
  t.deepEqual(
    gen.next(respValue).value,
    call([respValue, 'json']),
    'should get json from response',
  );

  const last = gen.next({ data: 'value' });
  t.ok(last.done, 'generator should finish');
  t.deepEqual(
    last.value,
    { data: 'value' },
    'should return data',
  );
});

test('all effect', (t) => {
  const effectOne = noop;
  const effectTwo = noop;
  function* genAll() {
    const res = yield all([
      call(effectOne, 'one'),
      call(effectTwo, 'two'),
    ]);

    return res;
  }
  const gen = genAll();

  t.plan(3);

  t.deepEqual(
    gen.next().value,
    all([
      call(effectOne, 'one'),
      call(effectTwo, 'two'),
    ]),
    'should call all effects in parralel',
  );

  const allVal = [{ one: true }, { two: true }];
  const last = gen.next(allVal);
  t.ok(last.done, 'generator should finish');
  t.deepEqual(
    last.value,
    allVal,
    'should return data',
  );
});

test('spawn effect', (t) => {
  function* effect() {}
  function* genSpawn(val) {
    yield spawn(effect, val);
    return 'DONE';
  }

  const val = 'value';
  const gen = genSpawn(val);

  t.plan(3);

  t.deepEqual(
    gen.next().value,
    spawn(effect, val),
    'should call spawn effect',
  );

  const last = gen.next();
  t.ok(last.done, 'generator should finish');
  t.deepEqual(
    last.value,
    'DONE',
    'should return data',
  );
});

/* function* example() {
  const resp = yield all([
    call(fetch, 'http://httpbin.org/get'),
    call(fetch, 'http://httpbin.org/get'),
  ]);
  const data = yield all(resp.map((r) => call([r, 'json'])));
  return data;
}

task(example).then(console.log); */
