const read = require('mz/fs').readFile;
const { task } = require('..');
const test = require('tape');

test('co(* -> yield []) should aggregate several promises', (t) => {
  t.plan(4);

  task(function*() {
    const a = read('index.js', 'utf8');
    const b = read('LICENSE', 'utf8');
    const c = read('package.json', 'utf8');

    const res = yield [a, b, c];
    t.equal(3, res.length);
    t.ok(~res[0].indexOf('exports'));
    t.ok(~res[1].indexOf('MIT'));
    t.ok(~res[2].indexOf('devDependencies'));
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
