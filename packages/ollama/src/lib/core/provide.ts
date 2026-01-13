import ContextService from "../services/base/ContextService";
import LoggerService from "../services/common/LoggerService";
import OutlinePrivateService from "../services/private/OutlinePrivateService";
import RunnerPrivateService from "../services/private/RunnerPrivateService";
import OutlinePublicService from "../services/public/OutlinePublicService";
import RunnerPublicService from "../services/public/RunnerPublicService";
import { provide } from "./di";
import { TYPES } from "./types";

{
  provide(TYPES.loggerService, () => new LoggerService());
}

{
  provide(TYPES.contextService, () => new ContextService());
}

{
  provide(TYPES.runnerPrivateService, () => new RunnerPrivateService());
  provide(TYPES.outlinePrivateService, () => new OutlinePrivateService());
}

{
  provide(TYPES.runnerPublicService, () => new RunnerPublicService());
  provide(TYPES.outlinePublicService, () => new OutlinePublicService());
}
