import { task } from '../src/index';
import * as test from 'tape';

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

function* work() {
  yield sleep(50);
  return 'yay';
}

test('co(fn*) with a generator function should wrap with co()', (t) => {
  t.plan(4);

  task(function* () {
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

  task(function* () {
    // @ts-ignore
    yield function* () {
      throw new Error('boom');
    };
  }).then(
    function () {
      throw new Error('wtf');
    },
    function (err: any) {
      t.ok(err);
      t.ok(err.message == 'boom');
    },
  );
});
