const { task } = require('..');
const test = require('tape');

test('co(gen, args) should pass the rest of the arguments', (t) => {
  t.plan(5);

  task(function *(num, str, arr, obj, fun) {
    t.ok(num === 42);
    t.ok(str === 'forty-two');
    t.ok(arr[0] === 42);
    t.ok(obj.value === 42);
    t.ok(fun instanceof Function)
  }, 42, 'forty-two', [42], { value: 42 }, function () {});
})
