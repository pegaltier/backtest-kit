import { ActionName, IActionSchema } from "../../../interfaces/Action.interface";
import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import { isObject, ToolRegistry } from "functools-kit";

/**
 * Service for managing action schema registry.
 *
 * Uses ToolRegistry from functools-kit for type-safe schema storage.
 * Action handlers are registered via addAction() and retrieved by name.
 */
export class ActionSchemaService {
  readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  private _registry = new ToolRegistry<Record<ActionName, IActionSchema>>(
    "actionSchema"
  );

  /**
   * Registers a new action schema.
   *
   * @param key - Unique action name
   * @param value - Action schema configuration
   * @throws Error if action name already exists
   */
  public register = (key: ActionName, value: IActionSchema) => {
    this.loggerService.log(`actionSchemaService register`, { key });
    this.validateShallow(value);
    this._registry = this._registry.register(key, value);
  };

  /**
   * Validates action schema structure for required properties.
   *
   * Performs shallow validation to ensure all required properties exist
   * and have correct types before registration in the registry.
   *
   * @param actionSchema - Action schema to validate
   * @throws Error if actionName is missing or not a string
   * @throws Error if handler is missing or not a function
   * @throws Error if callbacks is not an object
   */
  private validateShallow = (actionSchema: IActionSchema) => {
    this.loggerService.log(`actionSchemaService validateShallow`, {
      actionSchema,
    });
    if (typeof actionSchema.actionName !== "string") {
      throw new Error(`action schema validation failed: missing actionName`);
    }
    if (typeof actionSchema.handler !== "function" && !isObject(actionSchema.handler)) {
      throw new Error(
        `action schema validation failed: handler is not a function or plain object for actionName=${actionSchema.actionName}`
      );
    }
    if (
      actionSchema.callbacks &&
      !isObject(actionSchema.callbacks)
    ) {
      throw new Error(
        `action schema validation failed: callbacks is not an object for actionName=${actionSchema.actionName}`
      );
    }
  };

  /**
   * Overrides an existing action schema with partial updates.
   *
   * @param key - Action name to override
   * @param value - Partial schema updates
   * @returns Updated action schema
   * @throws Error if action name doesn't exist
   */
  public override = (key: ActionName, value: Partial<IActionSchema>) => {
    this.loggerService.log(`actionSchemaService override`, { key });
    this._registry = this._registry.override(key, value);
    return this._registry.get(key);
  };

  /**
   * Retrieves an action schema by name.
   *
   * @param key - Action name
   * @returns Action schema configuration
   * @throws Error if action name doesn't exist
   */
  public get = (key: ActionName): IActionSchema => {
    this.loggerService.log(`actionSchemaService get`, { key });
    return this._registry.get(key);
  };
}

export default ActionSchemaService;
