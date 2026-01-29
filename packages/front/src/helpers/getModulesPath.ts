import { createRequire } from "module";
import { join } from "path";

const require = createRequire(import.meta.url);

export function getModulesPath() {
    const modulePath = require.resolve('@backtest-kit/ui');
    return join(modulePath, "../../");
}

export default getModulesPath;
