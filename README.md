# cofx [![Build Status](https://travis-ci.org/neurosnap/cofx.svg?branch=master)](https://travis-ci.org/neurosnap/cofx)

A node and javascript library that helps developers describe side-effects as data in a declarative, flexible API.

## Features

* Perform non-blocking IO operations synchronously
* Generators yield data structures, not IO
* Testability
* Ability to write custom effect handlers

## Why?

Maintaining side-effects, especially IO, are difficult to write in javascript.  They are asynchronous,
they require effort to prevent callback hell, and they can be difficult to test.

This library leverages the power of generators to help control the flow of side-effects as well as
create a platform to easily test those side-effects.  The key feature of this library is to
describe those side-effects as data.

Instead of a generator activating side-effects (e.g. making HTTP requests)
it yields data objects that represent how side-effects ought to be executed.

Effectively this makes testing side-effects as easy as checking that each step
in a generator returns the proper data structure.  Because we are leveraging generators
this library also helps reduce the level of nesting when dealing with asynchronous operations.

This library was inspired by [redux-saga](https://github.com/redux-saga/redux-saga)
and [re-frame](https://github.com/Day8/re-frame).  Whenever I left the world
of react/redux and wanted to test my async/await/generator functions it would require
mocking/intercepting HTTP requests which is a terrible developer experience.
Instead this library does all the heavy lifting of activating the side-effects while
the end-developer can write code in a declarative manner.

This technique is very popular, the prime example is `react`.  Testing react components
is easy because the components are functions that accept state and then return data as HTML.

```js
const view = f(state);
```

The functions themselves do not mutate the DOM, they tell the `react` runtime how to mutate the DOM.
This is a critical distinction and pivotal for understanding how this library operates.
Effectively the end-developer only concerns itself with the shape of the data being returned from their
react components and the react runtime does the rest.


## References

* [Effects as Data talk by Richard Feldman](https://www.youtube.com/watch?v=6EdXaWfoslc)
* [react-cofx](https://github.com/neurosnap/react-cofx) async render components
* [redux-cofx](https://github.com/neurosnap/redux-cofx) side-effect middleware for redux
* [gen-tester](https://github.com/neurosnap/gen-tester) test cofx generators


## How?

`cofx` will yield to data objects and activate side-effects based on the shape of those objects.
An effect object looks something like this:

```json
{
  "type": "CALL",
  "fn": [function],
  "args": ["list", "of", "arguments"]
}
```

This JSON object tells the `cofx` runtime that it should call a function, `fn` with arguments
in `args`.  From there the runtime knows exactly what to do with the results of the function, whether it's
a promise or a not.

`task` returns a promise that receives the return value of the generator.

```js
import { call, task } from 'cofx';

// running this generator without the runtime `task` would simply return data objects that describe
// what the runtime should do.  Really it returns a DSL that the runtime interprets.
function* fetchBin() {
  const resp = yield call(fetch, 'http://httpbin.org/get');
  // sending an array makes `call` activate the function `json` on `resp` object
  // this is required because of the way fetch uses context to determine if the Body
  // promise has been used already.
  const data = yield call([resp, 'json']);
  return { ...data, extra: 'stuff' };
}

// `task` is in charge of handling the actual side-effects
// all user code does not contain any side-effects because they return json objects
task(fetchBin)
  .then(console.log)
  .catch(console.error);
```

## Cancelling a task (added v2.0)

Cancelling a task is possible by passing a promise into the `task` that once resolved, will
cancel the task.

```js
import { task, delay } from 'cofx';

function* waiting(duration) {
  try {
    yield delay(duration);
  } catch (err) {
    console.log(err);
  }
}

const cancel = new Promise((resolve) => {
  setTimeout(() => {
    resolve('cancel the task!');
  }, 500);
});

task({ fn: waiting, args: [1000], cancel })
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

When the generator function does not get called by `task`
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

### race

Uses `Promise.race` to execute effects in parallel.  Could be an array of effects
or an object of effects.  The request that finishes first will be returned.

```js
const { task, call, race } = require('cofx');
const fetch = require('node-fetch');

function* example() {
  const resp = yield race([
    call(fetch, 'http://google.com'),
    call(fetch, 'http://something-really-slow.com'),
  ]);
  const data = yield call([resp, 'json']); // resp is the result of the fastest request
  return data;
}

task(example);
```

```js
const { task, call, race, delay } = require('cofx');
const fetch = require('node-fetch');

function* example() {
  const resp = yield race({
    google: call(fetch, 'http://google.com'),
    delay: delay(10 * 1000),
  });

  console.log(resp);
  // -> { google: { ... }, delay: undefined }

  if (resp.google) {
    const data = yield call([resp, 'json']); // resp is the result of the fastest request
    return data;
  }
}

task(example);
```

### fork (added v2.0)

Forks (attached) an effect without the generator waiting for that effect to finish.  If
a task gets cancelled, this fork will also be cancelled.

```js
const { task, fork } = require('cofx');
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
  yield fork(effect);
  console.log('COOL');
}

task(example);
// COOL
// ... five seconds later
// ACTIVATE
```

### spawn

Spawns (dettached) an effect without the generator waiting for that effect to finish.  If
a task gets cancelled, this spawn will *NOT* be cancelled.

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
effect middleware.  When using middleware it must return a promise, something that
`co` understands how to handle, and to allow other middleware to handle the effect
as well, you must return `next(effect)`;

#### error effect handler

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

#### date effect handler

```js
const { factory } = require('cofx');

const GET_DATE = 'GET_DATE';
const getDate = () => ({ type: GET_DATE });
const middleware = (next) => (effect) => {
  if (effect.type === GET_DATE) {
    return Promise.resolve(new Date());
  }

  return next(effect);
};

function* example() {
  const now = yield getDate();
  return now;
}

const customTask = factory(middleware);
customTask(example).then((now) => {
  console.log(now);
});

// Fri Sep 21 2018 13:44:24 GMT-0400 (Eastern Daylight Time)
```
