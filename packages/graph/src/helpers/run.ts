import NodeType from '../enum/NodeType';
import { TypedNode, InferNodeValue } from '../interfaces/TypedNode.interface';
import { sourceNode, outputNode } from './defineNode';

/**
 * Рекурсивно вычисляет значение узла графа.
 * Для SourceNode вызывает fetch().
 * Для OutputNode сначала резолвит все дочерние nodes параллельно,
 * затем передаёт их типизированные значения в compute().
 */
export const run = async <T extends TypedNode>(node: T): Promise<InferNodeValue<T>> => {
    if (node.type === NodeType.SourceNode) {
        return node.fetch() as Promise<InferNodeValue<T>>;
    }
    const values = await Promise.all(node.nodes.map(run));
    return node.compute(values as any) as Promise<InferNodeValue<T>>;
};

const test = outputNode(
    ([a, b]) => 0, // a: number, b: string
    sourceNode(() => 0),
    sourceNode(() => "bar"),
);

export default run;
