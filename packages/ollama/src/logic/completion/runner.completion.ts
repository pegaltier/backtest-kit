import {
  addCompletion,
  type ISwarmCompletionArgs,
  type ISwarmMessage,
} from "agent-swarm-kit";
import { CompletionName } from "../../enum/CompletionName";
import { engine } from "../../lib";

addCompletion({
  completionName: CompletionName.RunnerCompletion,
  getCompletion: async (params: ISwarmCompletionArgs): Promise<ISwarmMessage> => {
    return await engine.runnerPrivateService.getCompletion(params);
  },
});
