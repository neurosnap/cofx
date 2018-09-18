# cofx [![Build Status](https://travis-ci.org/neurosnap/cofx.svg?branch=master)](https://travis-ci.org/neurosnap/cofx)

A node, javascript library that helps developers describe side-effects as data in a declarative, flexible API.

## Features

* Perform non-blocking IO operations synchronously
* Generators yield data structures, not IO
* Testability
* Ability to write custom effect handlers

## Why?

Instead of a generator activating side-effects (e.g. making HTTP requests)
it instead yields data objects that represent how side-effects ought to be executed.

Effectively this makes testing side-effects as easy as checking that each step
in a generator returns the proper data structure.  Because we are leveraging generators
this library also helps reduce the level of nesting when dealing with asynchronous operations.

This library was inspired by [redux-saga](https://github.com/redux-saga/redux-saga)
and [re-frame](https://github.com/Day8/re-frame).  Whenever I left the world
of a react/redux and wanted to test my async/await/generator functions it would require
mocking/intercepting HTTP requests which is a terrible developer experience after
coming from describing side-effects as data.  Instead this library does all the heavy
lifting of activating the side-effects while the end-developer can build their in a
declarative manner.

[Effects as Data talk by Richard Feldman](https://www.youtube.com/watch?v=6EdXaWfoslc)

## How?

`cofx` will work exactly like `co` with the exception that it can handle a new
yielded value type: effect objects. An effect object looks something like this:

```json
{
  "type": "CALL",
  "fn": [function],
  "args": ["list", "of", "arguments"]
}
```

`task` is an alias for the `co` function.  It returns a promise that receives the return
value of the generator.

```js
import { call, task } from 'cofx';

function* fetchBin() {
  const resp = yield call(fetch, 'http://httpbin.org/get');
  // sending an array makes `call` activate the function `json` on `resp` object
  // this is required because of the way fetch uses context to determine if the Body
  // promise has been used already.
  const data = yield call([resp, 'json']);
  return { ...data, extra: 'stuff' };
}

task(fetchBin)
  .then(console.log)
  .catch(console.error);
```

Check out the API section for more effects.

## Testing

Taking the previous example, this is how you would test it:

```js
const test = require('tape');

test('test fetchBin', (t) => {
  const gen = fetchBin();

  t.deepEqual(
    gen.next().value,
    call(fetch, 'http://httpbin.org/get'),
    'should make http request',
  );

  const respValue = { resp: 'value', json: 'hi' };
  t.deepEqual(
    gen.next(respValue).value,
    call([respValue, 'json']),
    'should get json from response',
  );

  const last = gen.next({ data: 'value' });
  t.ok(last.done, 'generator should finish');
  t.deepEqual(
    last.value,
    { data: 'value', extra: 'stuff' },
    'should return data',
  );
});
```

Using a little helper library called [gen-tester](https://github.com/neurosnap/gen-tester)
we can make this even easier.

```js
const { genTester, yields } = require('gen-tester');

test('test fetchBin', (t) => {
  t.plan(1);

  const respValue = { resp: 'value', json: 'hi' };
  const returnValue = { data: 'value', extra: 'stuff' };

  const tester = genTester(genCall);
  const { actual, expect } = tester(
    yields(
      call(fetch, 'http://httpbin.org/get'),
      respValue, // the result value of `resp` in the generator
    ),
    yields(
      call([respValue, 'json']),
      { data: 'value' }, // the result value of `data` in the generator
    ),
    returnValue,
  );

  t.deepEqual(actual, expected);
});
```

Take a close look here.  When the generator function does not get called by `task`
all it does is return JSON at every `yield`.  This is the brilliance of describing
side-effects as data: we can test our generator function synchronously, without
needing any HTTP interceptors or mocking functions!  So even though at every yield
this library will make asynchronous calls, for testing, we can step through the
generator one step after another and make sure the yield makes the correct call.

## References

* [react-cofx](https://github.com/neurosnap/react-cofx) async render components
* [redux-cofx](https://github.com/neurosnap/redux-cofx) side-effect middleware for redux
* [gen-tester](https://github.com/neurosnap/gen-tester) test cofx generators

## API

### task

Manages async flow for a generator.  This is an alias to the `co` function.

### call

```js
const { task, call } = require('cofx');
const fetch = require('node-fetch');

function* example() {
  yield call(fetch, 'http://google.com')
  return 'hi';
}

task(example);
```

### all

Uses `Promise.all` to execute effects in parallel.  Could be an array of effects
or an object of effects.

```js
const { task, call, all } = require('cofx');
const fetch = require('node-fetch');

function* example() {
  const resp = yield all([
    call(fetch, 'http://google.com'),
    call(fetch, 'http://something-else.com'),
  ]);
  const data = yield all(resp.map((r) => call([r, 'json'])));
  return data;
}

task(example);
```

### spawn

Spawns an effect without the generator waiting for that effect to finish.

```js
const { task, spawn } = require('cofx');
const fetch = require('node-fetch');

function effect() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
      console.log('ACTIVATE');
    }, 5000);
  });
}

function* example() {
  yield spawn(effect);
  console.log('COOL');
}

task(example);
// COOL
// ... five seconds later
// ACTIVATE
```

### delay

This will `sleep` the generator for the designated amount of time.

```js
const { task, delay } = require('cofx');

function* example() {
  console.log('INIT')
  yield delay(1000);
  console.log('END');
}

task(example);
// INIT
// ... one second later
// END
```

### factory

This is what creates `task`.  This allows end-developers to build their own
effect middleware.  When using middleware it must return a promise, something that `co` understands how to handle, and
to allow other middleware to handle the effect as well, you
must return `next(effect)`;

```js
const { factory } = require('cofx');

const ERROR = 'ERROR';
const error = (msg) => ({ type: ERROR, msg });
const middleware = (next) => (effect) => {
  if (effect.type === ERROR) {
    return Promise.reject(effect.msg);
  }

  return next(effect);
};

function* example() {
  yield error('SOMETHING HAPPENED');
}

const customTask = factory(middleware);
customTask(example).catch((err) => {
  console.log(`ERROR: ${err}`);
});

// ERROR: SOMETHING HAPPENED
```
