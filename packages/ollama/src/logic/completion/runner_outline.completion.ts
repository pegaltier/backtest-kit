import {
  addCompletion,
  IOutlineCompletionArgs,
} from "agent-swarm-kit";
import { CompletionName } from "../../enum/CompletionName";
import { engine } from "../../lib";
import { signal } from "../../lib/signal";

addCompletion({
  completionName: CompletionName.RunnerOutlineCompletion,
  getCompletion: async (params: IOutlineCompletionArgs) => {
    const selectedInference = await signal.inferenceMetaService.getActiveInference();
    return await engine.runnerPublicService.getOutlineCompletion(params, selectedInference);
  },
  json: true,
});
