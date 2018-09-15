import { readFile as read } from 'mz/fs';
import { task } from '../src/index';
import * as test from 'tape';

test('co(* -> yield []) should aggregate several promises', (t) => {
  t.plan(3);

  task(function*() {
    const b = read('LICENSE.md', 'utf8');
    const c = read('package.json', 'utf8');

    const res = yield [b, c];
    t.equal(2, res.length);
    t.ok(~res[0].indexOf('MIT'));
    t.ok(~res[1].indexOf('devDependencies'));
  });
});

test('co(* -> yield []) should noop with no args', (t) => {
  t.plan(1);

  task(function*() {
    const res = yield [];
    t.equal(0, res.length);
  });
});

test('co(* -> yield []) should support an array of generators', (t) => {
  t.plan(1);

  task(function*() {
    const val = yield [
      (function*() {
        return 1;
      })(),
    ];
    t.deepEqual(val, [1]);
  });
});
