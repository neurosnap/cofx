var { task } = require('..');
const test = require('tape');

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

function* work() {
  yield sleep(50);
  return 'yay';
}

test('co(fn*) with a generator function should wrap with co()', (t) => {
  t.plan(4);

  task(function*() {
    const a = yield work;
    const b = yield work;
    const c = yield work;

    t.ok('yay' == a);
    t.ok('yay' == b);
    t.ok('yay' == c);

    const res = yield [work, work, work];
    t.deepEqual(['yay', 'yay', 'yay'], res);
  });
});

test('co(fn*) with a generator function should catch errors', (t) => {
  t.plan(2);

  task(function*() {
    yield function*() {
      throw new Error('boom');
    };
  }).then(
    function() {
      throw new Error('wtf');
    },
    function(err) {
      t.ok(err);
      t.ok(err.message == 'boom');
    },
  );
});
