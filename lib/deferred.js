export function deferred(f) {
  let promise;

  return {
    then(
      onfulfilled,
      onrejected
    ) {
      promise ||= new Promise(resolve => resolve(f()));
      return promise.then(
        onfulfilled,
        onrejected
      );
    },
  };
}
