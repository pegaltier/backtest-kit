import {
  addCompletion,
  ISwarmCompletionArgs,
  type ISwarmMessage,
} from "agent-swarm-kit";
import { CompletionName } from "../../enum/CompletionName";
import { engine } from "../../lib";

addCompletion({
  completionName: CompletionName.RunnerStreamCompletion,
  getCompletion: async (params: ISwarmCompletionArgs): Promise<ISwarmMessage> => {
    return await engine.runnerPrivateService.getStreamCompletion(params);
  },
});
