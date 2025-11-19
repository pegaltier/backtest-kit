import { run } from 'worker-testbed';

import "./spec/candle.test.mjs";

run(import.meta.url, () => {
    console.log("All tests are finished");
    process.exit(-1);
});
