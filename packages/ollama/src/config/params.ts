declare function parseInt(value: unknown): number;

export const GLOBAL_CONFIG = {
  /**
   * Enable debug mode for detailed logging.
   * When enabled, additional debug information will be logged.
   * Can be set via CC_ENABLE_DEBUG environment variable.
   * Default: false
   */
  CC_ENABLE_DEBUG: "CC_ENABLE_DEBUG" in process.env ? !!parseInt(process.env.CC_ENABLE_DEBUG) : false,
  /**
   * Enable thinking mode for AI responses.
   * When enabled, the AI will provide extended reasoning before answering.
   * Can be set via CC_ENABLE_THINKING environment variable.
   * Default: false
   */
  CC_ENABLE_THINKING: "CC_ENABLE_THINKING" in process.env ? !!parseInt(process.env.CC_ENABLE_THINKING) : false,
};

export const DEFAULT_CONFIG = Object.freeze({...GLOBAL_CONFIG});

/**
 * Type for global configuration object.
 */
export type GlobalConfig = typeof GLOBAL_CONFIG;
