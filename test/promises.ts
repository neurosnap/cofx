import { task } from '../src/index';
import * as test from 'tape';

function getPromise(val: any, err?: any) {
  return new Promise(function(resolve, reject) {
    if (err) reject(err);
    else resolve(val);
  });
}

test('co(* -> yield <promise> with one promise yield', (t) => {
  t.plan(1);

  task(function*() {
    const a = yield getPromise(1);
    t.equal(1, a);
  });
});

test('co(* -> yield <promise> with several promise yields', (t) => {
  t.plan(1);

  task(function*() {
    const a = yield getPromise(1);
    const b = yield getPromise(2);
    const c = yield getPromise(3);

    t.deepEqual([1, 2, 3], [a, b, c]);
  });
});

test('co(* -> yield <promise> when a promise is rejected', (t) => {
  t.plan(2);

  let error: any;

  task(function*() {
    try {
      yield getPromise(1, new Error('boom'));
    } catch (err) {
      error = err;
    }

    t.ok('boom' == error.message);
    const ret = yield getPromise(1);
    t.ok(1 == ret);
  });
});

test('co(* -> yield <promise> when yielding a non-standard promise-like', (t) => {
  t.plan(1);

  t.ok(
    task(function*() {
      yield { then: function() {} };
    }) instanceof Promise,
  );
});

test('co(function) -> promise', (t) => {
  t.plan(1);

  task(function() {
    return 1;
  }).then(function(data) {
    t.equal(data, 1);
  });
});

test('co(function) -> resolve promise', (t) => {
  t.plan(1);

  task(function() {
    return Promise.resolve(1);
  }).then(function(data) {
    t.equal(data, 1);
  });
});

test('co(function) -> reject promise', (t) => {
  t.plan(1);

  task(function() {
    return Promise.reject(1);
  }).catch(function(data) {
    t.equal(data, 1);
  });
});

test('co(function) -> catch errors', (t) => {
  t.plan(1);

  task(function() {
    throw new Error('boom');
  })
    .then(function() {
      throw new Error('nope');
    })
    .catch(function(err) {
      t.equal(err.message, 'boom');
    });
});
