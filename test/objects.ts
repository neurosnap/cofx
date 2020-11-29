import { readFile as read } from 'mz/fs';
import { task } from '../src/index';
import * as test from 'tape';

test('co(* -> yield {}) should aggregate several promises', (t) => {
  t.plan(3);

  task(function* () {
    const b = read('LICENSE.md', 'utf8');
    const c = read('package.json', 'utf8');

    const res: { b: string; c: string } = yield {
      b: b,
      c: c,
    };

    t.equal(2, Object.keys(res).length);
    t.ok(~res.b.indexOf('MIT'));
    t.ok(~res.c.indexOf('devDependencies'));
  });
});

test('co(* -> yield {}) should noop with no args', (t) => {
  t.plan(1);

  task(function* () {
    const res: object = yield {};
    t.equal(0, Object.keys(res).length);
  });
});

test('co(* -> yield {}) should ignore non-thunkable properties', (t) => {
  t.plan(8);

  task(function* () {
    const foo = {
      name: { first: 'tobi' },
      age: 2,
      address: read('LICENSE.md', 'utf8'),
      tobi: new Pet('tobi'),
      now: new Date(),
      falsey: false,
      nully: null as any,
      undefiney: undefined as any,
    };

    const res: any = yield foo;

    t.equal('tobi', res.name.first);
    t.equal(2, res.age);
    t.equal('tobi', res.tobi.name);
    t.equal(foo.now, res.now);
    t.equal(false, foo.falsey);
    t.equal(null, foo.nully);
    t.equal(undefined, foo.undefiney);
    t.ok(~res.address.indexOf('MIT'));
  });
});

class Pet {
  name: string;
  something: () => void;
  constructor(name: string) {
    this.name = name;
    this.something = function () {};
  }
}
