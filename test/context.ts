import { task, call } from '../src/index';
import * as test from 'tape';

test('co.call(this) should pass the context', (t) => {
  t.plan(1);

  const ctx = {
    some: 'thing',
  };

  // @ts-ignore
  task.call(ctx, function*(this: any) {
    t.ok(ctx == this);
  });
});

test('call([]) should pass context to a generator', (t) => {
  t.plan(3);

  let ctx: GenClass;

  class GenClass {
    two() {
      t.ok(ctx == this);
      return Promise.resolve(2);
    }

    * one() {
      t.ok(ctx == this);
      return yield call<any>([this, 'two']);
    }
  }

  ctx = new GenClass;

  // @ts-ignore
  task.call(ctx, function*(this: any) {
    const result = yield call([ctx, 'one']);
    t.ok(result === 2);
  });
});
