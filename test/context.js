const { task } = require('..');
const test = require('tape');

const ctx = {
  some: 'thing'
};

test('co.call(this) should pass the context', (t) => {
  t.plan(1);

  task.call(ctx, function *(){
    t.ok(ctx == this);
  });
})
