const { task } = require('..');
const test = require('tape');

test('yield <invalid> should throw an error', (t) => {
  t.plan(2);

  task(function* () {
    yield null;
    throw new Error('lol');
  }).catch((err) => {
    t.ok(err instanceof TypeError);
    t.ok(~err.message.indexOf('You may only yield'));
  })
})
