const read = require('mz/fs').readFile;
const { task } = require('..');
const test = require('tape');

test('co(* -> yield {}) should aggregate several promises', (t) => {
  t.plan(4);

  task(function *(){
    const a = read('index.js', 'utf8');
    const b = read('LICENSE', 'utf8');
    const c = read('package.json', 'utf8');

    const res = yield {
      a: a,
      b: b,
      c: c
    };

    t.equal(3, Object.keys(res).length);
    t.ok(~res.a.indexOf('exports'));
    t.ok(~res.b.indexOf('MIT'));
    t.ok(~res.c.indexOf('devDependencies'));
  });
});

test('co(* -> yield {}) should noop with no args', (t) => {
  t.plan(1);

  task(function *(){
    const res = yield {};
    t.equal(0, Object.keys(res).length);
  });
});

test('co(* -> yield {}) should ignore non-thunkable properties', (t) => {
  t.plan(8);

  task(function *(){
    const foo = {
      name: { first: 'tobi' },
      age: 2,
      address: read('index.js', 'utf8'),
      tobi: new Pet('tobi'),
      now: new Date(),
      falsey: false,
      nully: null,
      undefiney: undefined,
    };

    const res = yield foo;

    t.equal('tobi', res.name.first);
    t.equal(2, res.age);
    t.equal('tobi', res.tobi.name);
    t.equal(foo.now, res.now);
    t.equal(false, foo.falsey);
    t.equal(null, foo.nully);
    t.equal(undefined, foo.undefiney);
    t.ok(~res.address.indexOf('exports'));
  });
})

test('co(* -> yield {}) should preserve key order', (t) => {
  t.plan(1);

  function timedThunk(time){
    return function(cb){
      setTimeout(cb, time);
    }
  }

  task(function *(){
    const before = {
      sun: timedThunk(30),
      rain: timedThunk(20),
      moon: timedThunk(10)
    };

    const after = yield before;

    const orderBefore = Object.keys(before).join(',');
    const orderAfter = Object.keys(after).join(',');
    t.equal(orderBefore, orderAfter);
  });
});

function Pet(name) {
  this.name = name;
  this.something = function(){};
}
