import { run } from 'worker-testbed';

import { setLogger } from "../build/index.mjs";

import "./spec/exchange.test.mjs";

setLogger({
    log(){},
    debug(){},
    info(){},
    warn: console.log,
})

run(import.meta.url, () => {
    console.log("All tests are finished");
    process.exit(-1);
});
