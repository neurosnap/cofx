import { task } from '../src/index';
import * as test from 'tape';

test('yield <invalid> should throw an error', (t) => {
  t.plan(2);

  task(function* () {
    yield null;
    throw new Error('lol');
  }).catch((err: any) => {
    t.ok(err instanceof TypeError);
    t.ok(~err.message.indexOf('You may only yield'));
  });
});
