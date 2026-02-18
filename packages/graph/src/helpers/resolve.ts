import { ExecutionContextService, MethodContextService, lib } from "backtest-kit";

import NodeType from '../enum/NodeType';
import { TypedNode, InferNodeValue } from '../interfaces/TypedNode.interface';

/**
 * Рекурсивно вычисляет значение узла графа.
 * Для SourceNode вызывает fetch().
 * Для OutputNode сначала резолвит все дочерние nodes параллельно,
 * затем передаёт их типизированные значения в compute().
 */
export const resolve = async <T extends TypedNode>(node: T): Promise<InferNodeValue<T>> => {

    if (!ExecutionContextService.hasContext()) {
        throw new Error("Execution context is required to resolve graph nodes. Please ensure that resolve() is called within a valid execution context.");
    }

    if (!MethodContextService.hasContext()) {
        throw new Error("Method context is required to resolve graph nodes. Please ensure that resolve() is called within a valid method context.");
    }

    if (node.type === NodeType.SourceNode) {
        const { symbol, when } = lib.executionContextService.context;
        const { exchangeName } = lib.methodContextService.context;
        return node.fetch(symbol, when, exchangeName) as Promise<InferNodeValue<T>>;
    }
    const values = await Promise.all(node.nodes.map(resolve));
    return node.compute(values as any) as Promise<InferNodeValue<T>>;
};

export default resolve;
