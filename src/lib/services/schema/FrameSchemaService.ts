import { IFrameSchema, FrameName } from "../../../interfaces/Frame.interface";
import { ToolRegistry } from "functools-kit";

export class FrameSchemaService {
  private _registry = new ToolRegistry<Record<FrameName, IFrameSchema>>(
    "frameSchema"
  );

  public register(key: FrameName, value: IFrameSchema) {
    this._registry.register(key, value);
  }

  public override(key: FrameName, value: Partial<IFrameSchema>) {
    this._registry.override(key, value);
  }

  public get(key: FrameName): IFrameSchema {
    return this._registry.get(key);
  }
}

export default FrameSchemaService;
