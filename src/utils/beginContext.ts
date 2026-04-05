import ExecutionContextService from "../lib/services/context/ExecutionContextService";
import MethodContextService from "../lib/services/context/MethodContextService";

/**
 * Wraps a function so it always runs outside any active method or execution context.
 *
 * When the wrapped function is called, `beginContext` checks whether
 * `MethodContextService` or `ExecutionContextService` currently have an active
 * scope and, if so, escapes each one with `runOutOfContext` before invoking `run`.
 * This prevents accidental context leakage from a caller into a logically independent
 * operation (e.g. an internal runner that must establish its own fresh context).
 *
 * The returned wrapper preserves the original function's parameter and return types,
 * so it is a transparent drop-in replacement.
 *
 * @template T - Type of the wrapped function.
 * @param run - Function to wrap.
 * @returns A new function with the same signature as `run` that escapes any
 *   active context before executing.
 *
 * @example
 * ```typescript
 * const runInContextInternal = beginContext(
 *   async (run: () => Promise<void>, context: IRunContext) => {
 *     return await MethodContextService.runInContext(
 *       () => ExecutionContextService.runInContext(run, context),
 *       context,
 *     );
 *   },
 * );
 * ```
 */
export const beginContext =
  <T extends (...args: any[]) => any>(
    run: T
  ): ((...args: Parameters<T>) => ReturnType<T>) =>
  (...args: Parameters<T>): ReturnType<T> => {

    let fn = () => run(...args);

    if (MethodContextService.hasContext()) {
      fn = MethodContextService.runOutOfContext(fn);
    }

    if (ExecutionContextService.hasContext()) {
      fn = ExecutionContextService.runOutOfContext(fn);
    }

    return fn();
  };

export default beginContext;
