import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import ResolveService from "../base/ResolveService";
import path from "path";
import LoaderService from "../base/LoaderService";

const CANDIDATES_FN = (
  fileName: string,
  self: ModuleConnectionService,
): [filePath: string, baseDir: string][] => [
  [
    path.join(process.cwd(), "modules", fileName),
    path.join(process.cwd(), "modules"),
  ],
  [
    path.join(self.resolveService.OVERRIDE_MODULES_DIR, fileName),
    self.resolveService.OVERRIDE_MODULES_DIR,
  ],
  [
    path.join(self.resolveService.DEFAULT_MODULES_DIR, fileName),
    self.resolveService.DEFAULT_MODULES_DIR,
  ],
];

const LOAD_MODULE_MODULE_FN = async (
  fileName: string,
  self: ModuleConnectionService,
): Promise<boolean> => {
  for (const [filePath, baseDir] of CANDIDATES_FN(fileName, self)) {
    try {
      if (await self.loaderService.check(filePath, baseDir)) {
        self.loaderService.import(filePath, baseDir);
        return true;
      }
    } catch {
      console.warn(`Module module import failed for file: ${filePath}`);
    }
  }
  return false;
};

export class ModuleConnectionService {
  readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  readonly resolveService = inject<ResolveService>(TYPES.resolveService);
  readonly loaderService = inject<LoaderService>(TYPES.loaderService);

  public loadModule = async (fileName: string) => {
    this.loggerService.log("moduleConnectionService getInstance", {
      fileName,
    });
    return await LOAD_MODULE_MODULE_FN(fileName, this);
  };
}

export default ModuleConnectionService;
