# sead [![Build Status](https://travis-ci.org/neurosnap/sead.svg?branch=master)](https://travis-ci.org/neurosnap/sead)

Fork of [co](https://github.com/tj/co) that describes asynchronous tasks as data.

## Why?

Instead of a generator activating side-effects it instead yields data objects
that represent how side-effects ought to be executed.  This pushes side-effects
to `co` instead of the application itself.

Effectively this makes testing side-effects as easy as checking that each step
in a generator returns the proper data structure.

This library was inspired by [redux-saga](https://github.com/redux-saga/redux-saga)
and [re-frame](https://github.com/Day8/re-frame).  Whenever I left the world
of `redux-saga` and wanted to test my async/await/generator functions it would require
mocking/intercepting HTTP requests which is a terrible developer experience after
coming from describing side-effects as data.

[Effects as Data talk by Richard Feldman](https://www.youtube.com/watch?v=6EdXaWfoslc)

## How?

`sead` will work exactly like `co` with the exception that it can handle a new
yielded value type: effect objects. An effect object looks something like this:

```json
{
  "type": "CALL",
  "fn": [function],
  "args": ["list", "of", "arguments"]
}
```

Right now there are three different effects this library implements: `call`, `spawn`, `all`

`task` is an alias for the `co` function.

```js
import { call, task } from 'sead';

function* fetchBin() {
  const resp = yield call(fetch, 'http://httpbin.org/get');
  // sending an array makes `call` activate the function `json` on `resp` object
  // this is required because of the way fetch uses context to determine if the Body
  // promise has been used already.
  const data = yield call([resp, 'json']);
  return data;
}

task(fetchBin)
  .then(console.log)
  .catch(console.error);
```

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
    { data: 'value' },
    'should return data',
  );
});
```

Take a close look here.  When the generator function does not get called by `task`
all it does is return JSON at every `yield`.  This is the brilliance of describing
side-effects as data: we can test our generator function synchronously, without
needing any HTTP interceptors or mocking functions!  So even though at every yield
this library will make asynchronous calls, for testing, we can step through the
generator one step after another and make sure the yield makes the correct call.

## API

### task

Manages async flow for a generator.  This is an alias to the `co` function.

### call

```js
const { task, call } = require('sead');
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
const { task, call, all } = require('sead');
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
const { task, spawn } = require('sead');
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
