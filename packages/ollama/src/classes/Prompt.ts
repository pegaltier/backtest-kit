import { PromptModel } from "../model/Prompt.model";

const PROMPT_TYPE_SYMBOL = Symbol("prompt-type");

export class Prompt {
  private readonly __type__ = PROMPT_TYPE_SYMBOL;

  private constructor(readonly source: PromptModel) {}

  public static fromPrompt = (source: PromptModel) => {
    if (!source || typeof source !== "object") {
      throw new Error("Source must be a valid PromptModel object");
    }
    return new Prompt(source);
  };

  public static isPrompt = (value: unknown): value is Prompt => {
    return (
      value !== null &&
      typeof value === "object" &&
      (value as Prompt).__type__ === PROMPT_TYPE_SYMBOL
    );
  };
}
