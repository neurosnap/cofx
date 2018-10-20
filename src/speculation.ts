type Fn = (...args: any[]) => void;
type Speculation<V> = (
  resolve: Fn,
  reject: Fn,
  onCancel: (c: Fn) => Promise<any>,
) => void;

const noop = () => {};

// HOF Wraps the native Promise API
// to add take a shouldCancel promise and add
// an onCancel() callback.
export default function speculation<V = any>(
  fn: Speculation<V>,
  cancel?: Promise<any>,
) {
  return new Promise<V>((_resolve, _reject) => {
    // Track if the promise becomes resolved or rejected to
    // avoid invoking onCancel after a promise becomes isSettled.
    let isSettled = false;

    // When the callsite resolves, mark the promise as fulfilled.
    const resolve = (input: any) => {
      isSettled = true;
      _resolve(input);
    };

    // When the callsite rejects, mark the promise as fulfilled.
    const reject = (input: any) => {
      isSettled = true;
      _reject(input);
    };

    const onCancel = (handleCancel: Fn) => {
      const maybeHandleCancel = (value: any) => {
        if (!isSettled) {
          handleCancel(value);
        }
      };

      if (!cancel) {
        return;
      }

      return (
        cancel
          .then(
            maybeHandleCancel,
            // Ignore expected cancel rejections:
            noop,
          )
          // handle onCancel errors
          .catch(reject)
      );
    };

    fn(resolve, reject, onCancel);
  });
}
