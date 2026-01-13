import {
  addCompletion,
  ISwarmCompletionArgs,
  type ISwarmMessage,
} from "agent-swarm-kit";
import { CompletionName } from "../../enum/CompletionName";
import { engine } from "../../lib";
import { signal } from "../../lib/signal";

addCompletion({
  completionName: CompletionName.RunnerStreamCompletion,
  getCompletion: async (params: ISwarmCompletionArgs): Promise<ISwarmMessage> => {
    const selectedInference = await signal.inferenceMetaService.getActiveInference();
    const result = await engine.runnerPublicService.getStreamCompletion(params, selectedInference);
    return result;
  },
});
