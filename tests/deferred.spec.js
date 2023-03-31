import {deferred} from '../lib/deferred.js';

describe('deferred()', () => {
  it('resolves to the return value of its function', async () => {
    const d = deferred(() => {
      return 'return value';
    });

    const ret = await d;
    ret.should.equal('return value');
  });

  it('defers execution until awaited', async () => {
    let executionCount = 0;
    executionCount.should.equal(0);

    const d = deferred(() => {
      executionCount++;
      return 'return value';
    });

    executionCount.should.equal(0);
    await d;
    executionCount.should.equal(1);
  });

  it('only executes once', async () => {
    let executionCount = 0;
    executionCount.should.equal(0);

    const d = deferred(() => {
      executionCount++;
      return 'return value';
    });

    await d;
    await d;
    executionCount.should.equal(1);
  });

  it('unwraps returned promises', async () => {
    const d = deferred(() => {
      return Promise.resolve('return value');
    });

    const ret = await d;
    ret.should.equal('return value');
  });
});

