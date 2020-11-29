import { readFile as read } from 'mz/fs';
import { task } from '../src/index';
import * as test from 'tape';

test('co() recursion should aggregate arrays within arrays', (t) => {
  t.plan(5);

  task(function* () {
    const a = read('prettier.config.js', 'utf8');
    const b = read('LICENSE.md', 'utf8');
    const c = read('package.json', 'utf8');

    const res: any = yield [a, [b, c]];
    t.equal(2, res.length);
    t.ok(~res[0].indexOf('exports'));
    t.equal(2, res[1].length);
    t.ok(~res[1][0].indexOf('MIT'));
    t.ok(~res[1][1].indexOf('devDependencies'));
  });
});

test('co() recursion should aggregate objects within objects', (t) => {
  t.plan(3);

  task(function* () {
    const a = read('prettier.config.js', 'utf8');
    const b = read('LICENSE.md', 'utf8');
    const c = read('package.json', 'utf8');

    const res: any = yield {
      0: a,
      1: {
        0: b,
        1: c,
      },
    };

    t.ok(~res[0].indexOf('exports'));
    t.ok(~res[1][0].indexOf('MIT'));
    t.ok(~res[1][1].indexOf('devDependencies'));
  });
});
