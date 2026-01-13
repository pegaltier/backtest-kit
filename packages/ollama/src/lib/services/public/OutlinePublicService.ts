import { inject } from "../../../lib/core/di";
import LoggerService from "../common/LoggerService";
import { TYPES } from "../../../lib/core/types";
import { IOutlineMessage } from "agent-swarm-kit";
import ContextService from "../base/ContextService";
import OutlinePrivateService from "../private/OutlinePrivateService";
import InferenceName from "../../../enum/InferenceName";

export class OutlinePublicService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly outlinePrivateService = inject<OutlinePrivateService>(
    TYPES.outlinePrivateService
  );

  public getCompletion = async (
    messages: IOutlineMessage[],
    inference: InferenceName,
    model: string,
    apiKey?: string | string[]
  ) => {
    this.loggerService.log("outlinePublicService getCompletion", {
      messages,
      model,
      apiKey,
      inference,
    });
    return await ContextService.runInContext(
      async () => {
        return await this.outlinePrivateService.getCompletion(messages);
      },
      {
        apiKey: apiKey!,
        inference,
        model,
      }
    );
  };
}

export default OutlinePublicService;
