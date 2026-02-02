import { createRequire } from "module";
import { join } from "path";

const require = createRequire(import.meta.url);

function getPublicPath() {
    const modulePath = require.resolve('@backtest-kit/ui');
    return join(modulePath, "../public");
}

export const CC_WWWROOT_PATH = "./public"; // getPublicPath()
export const CC_WWWROOT_HOST = "0.0.0.0";
export const CC_WWWROOT_PORT = 60050;
