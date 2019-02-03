import { task } from '../src/index';
import * as test from 'tape';

const ctx = {
  some: 'thing',
};

test('co.call(this) should pass the context', (t) => {
  t.plan(1);

  // @ts-ignore
  task.call(ctx, function*(this: any) {
    t.ok(ctx == this);
  });
});
