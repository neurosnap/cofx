import {
  task,
  call,
  all,
  spawn,
  delay,
  factory,
  race,
  fork,
} from '../src/index';
import fetch from 'node-fetch';
import * as test from 'tape';
import * as nock from 'nock';
import { genTester, yields } from 'gen-tester';

const noop = (...args: any[]) => {};
const canceller = (ms: number = 150) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve('cancel it');
    }, ms);
  });

function* genCall() {
  const resp = yield* call(fetch, 'http://httpbin.org/get');
  const data = yield* call([resp, 'json']);
  return { ...data, extra: 'stuff' };
}

test('task runtime', (t) => {
  const mockData = { one: 2, extra: 'stuff' };

  nock('http://httpbin.org').get('/get').reply(200, mockData);

  t.plan(1);
  const assertData = (data: any) => {
    t.deepEqual(data, mockData, 'data should equal expected data');
  };

  task(genCall).then(assertData);
});

test('task runtime call generator', (t) => {
  function* one() {
    return 'hi';
  }
  function* two() {
    const val = yield* call(one);
    return val;
  }

  t.plan(1);
  task(two)
    .then((data: any) => {
      t.equal(data, 'hi');
    })
    .catch(console.error);
});

test('task runtime call a normal function', (t) => {
  t.plan(1);
  function one() {
    return 'hi';
  }

  task(one).then((data: any) => {
    t.equal(data, 'hi');
  });
});

test('task runtime call effect normal function', (t) => {
  t.plan(1);
  function one() {
    return 'hi';
  }
  function* two() {
    const result = yield* call(one);
    return result;
  }

  task(two).then((data: any) => {
    t.equal(data, 'hi');
  });
});

test('task runtime all effect array', (t) => {
  t.plan(1);
  function* one() {
    return 'hi';
  }
  function* two() {
    const result = yield all([call(one), call(one)]);
    return result;
  }

  task(two).then((data: any) => {
    t.deepEqual(data, ['hi', 'hi']);
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

  task(two).then((data: any) => {
    t.deepEqual(data, { one: 'hi', two: 'hi' });
  });
});

test('task runtime cancel', (t) => {
  t.plan(1);

  function* one() {
    try {
      yield delay(10000);
      return 'hi';
    } catch (err) {
      t.equal(true, true);
    }
  }

  const cancel = canceller();
  task({ fn: one, cancel }).catch(console.log);
});

test('task fork should cancel', (t) => {
  t.plan(1);

  function* two() {
    try {
      yield delay(10000);
    } catch (err) {
      console.log(err);
    }
  }

  function* one() {
    try {
      yield fork(two);
      yield delay(10000);
    } catch (err) {
      t.equal(true, true);
    }
  }

  const cancel = canceller();
  task({ fn: one, cancel }).catch(console.log);
});

test('task spawn should not cancel', (t) => {
  t.plan(2);

  function* two() {
    yield delay(100);
    t.equal(true, true);
  }

  function* one() {
    try {
      yield spawn(two);
      yield delay(10000);
    } catch (err) {
      t.equal(true, true);
    }
  }

  const cancel = canceller();
  task({ fn: one, cancel }).catch(console.log);
});

test('call effect', (t) => {
  t.plan(1);

  const respValue = { resp: 'value', json: () => 'hi' };
  const returnValue = { data: 'value', extra: 'stuff' };
  const tester = genTester(genCall);
  const { actual, expected } = tester(
    yields(call(fetch, 'http://httpbin.org/get'), respValue),
    yields(call([respValue, 'json']), { data: 'value' }),
    returnValue,
  );

  t.deepEqual(actual, expected);
});

test('all effect array', (t) => {
  t.plan(1);

  function* effectOne(p: string) {
    return `combine ${p}`;
  }

  function* effectTwo(p: number) {
    return 40 + p;
  }

  function* genAll() {
    const res = yield* all([call(effectOne, 'one'), call(effectTwo, 2)]);
    return res;
  }

  const allVal = [{ one: true }, { two: true }];
  const tester = genTester(genAll);
  const { actual, expected } = tester(
    yields(all([call(effectOne, 'one'), call(effectTwo, 2)])),
    allVal,
  );

  t.deepEqual(actual, expected);
});

test('all effect object', (t) => {
  t.plan(1);

  function* effectOne(p: string) {
    return `combine ${p}`;
  }

  function* effectTwo(p: number) {
    return 40 + p;
  }

  function* genAll() {
    const res = yield* all({
      one: call(effectOne, 'one'),
      two: call(effectTwo, 2),
    });

    return res;
  }
  const allVal = { one: 'combine one', two: 42 };
  const tester = genTester(genAll);
  const { actual, expected } = tester(
    yields(
      all({
        one: call(effectOne, 'one'),
        two: call(effectTwo, 2),
      }),
      allVal,
    ),
    allVal,
  );

  t.deepEqual(actual, expected);
});

test('spawn effect', (t) => {
  t.plan(1);

  // @ts-ignore
  function* effect() {}
  function* genSpawn(val: any) {
    yield spawn(effect, val);
    return 'DONE';
  }
  const val = 'value';
  const tester = genTester(genSpawn, val);
  const { actual, expected } = tester(yields(spawn(effect, val), null), 'DONE');

  t.deepEqual(actual, expected);
});

test('delay effect', (t) => {
  t.plan(1);

  function* genDelay() {
    yield delay(1000);
    return 'DONE';
  }
  const tester = genTester(genDelay);
  const { actual, expected } = tester(yields(delay(1000), null), 'DONE');

  t.deepEqual(actual, expected);
});

test('custom middleware', (t) => {
  t.plan(1);

  const middleware = (next: any) => (effect: any) => {
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

test('race array runtime', (t) => {
  function* one() {
    yield delay(500);
    return 1;
  }
  function* two() {
    yield delay(100);
    return 2;
  }
  function* go() {
    const res = yield race([call(one), call(two)]);
    return res;
  }

  t.plan(1);
  const assertData = (data: any) => {
    t.equal(data, 2, 'data should equal expected data');
  };

  task(go)
    .then(assertData)
    .catch((msg: any) => console.log('CANCELLED', msg));
});

test('race obj runtime', (t) => {
  function* one() {
    yield delay(500);
    return 1;
  }
  function* two() {
    yield delay(100);
    return 2;
  }
  function* go() {
    const res = yield race({
      one: call(one),
      two: call(two),
    });
    return res;
  }

  t.plan(1);
  const assertData = (data: any) => {
    t.deepEqual(
      data,
      { one: undefined, two: 2 },
      'data should equal expected data',
    );
  };

  task(go).then(assertData);
});

test('race array cancel', (t) => {
  function* one() {
    yield delay(1000);
    t.fail('should not hit');

    return 1;
  }
  function* two() {
    yield delay(100);
    return 2;
  }
  function* go() {
    const res = yield race([call(one), call(two)]);
    return res;
  }

  t.plan(1);
  const assertData = (data: any) => {
    t.equal(data, 2, 'data should equal expected data');
  };

  task(go).then(assertData);
});

test('race obj cancel', (t) => {
  function* one() {
    try {
      yield delay(1000);
    } catch (err) {
      t.pass('should hit');
    }

    return 1;
  }
  function* two() {
    yield delay(100);
    return 2;
  }
  function* go() {
    const res = yield race({
      one: call(one),
      two: call(two),
    });
    return res;
  }

  t.plan(2);
  const assertData = (data: any) => {
    t.deepEqual(
      data,
      { one: undefined, two: 2 },
      'data should equal expected data',
    );
  };

  task(go).then(assertData);
});

test('cancel task race array cancel', (t) => {
  function* one() {
    try {
      yield delay(5000);
      return 1;
    } catch (err) {
      t.pass('adelay should cancel');
    }
  }
  function* two() {
    try {
      yield delay(2000);
      return 2;
    } catch (err) {
      t.pass('bdelay should cancel');
    }
  }

  function* go() {
    try {
      const res = yield race([call(one), call(two)]);
      return res;
    } catch (err) {
      t.pass('race should cancel');
    }
  }

  t.plan(3);

  const cancel = canceller();
  task({ fn: go, cancel }).catch(console.log);
});

test('when cancelling a task', (t) => {
  t.plan(2);
  const msg = 'cancel the task!';

  function* waiting(duration: number) {
    try {
      yield delay(duration);
    } catch (err) {
      console.log(err);
      t.equal(msg, err, 'generator catch - error message should match');
    }
  }

  const cancel = new Promise((resolve) => {
    setTimeout(() => {
      resolve(msg);
    }, 100);
  });

  task({ fn: waiting, args: [200], cancel })
    .then(console.log)
    .catch((err: any) => {
      t.deepEqual(
        { error: msg },
        err,
        'task catch - error message should match',
      );
    });
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
