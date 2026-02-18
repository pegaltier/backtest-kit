import { Value } from './Node.interface';
import NodeType from '../enum/NodeType';

/**
 * Узел-источник данных. Не имеет входящих зависимостей.
 * fetch вызывается для получения значения.
 */
type SourceNode = {
    type: NodeType.SourceNode;
    fetch: () => Promise<Value> | Value;
};

/**
 * Узел вычисления. Имеет входящие зависимости (nodes),
 * compute получает их resolved-значения в том же порядке.
 */
type OutputNode = {
    type: NodeType.OutputNode;
    compute: (values: Value[]) => Promise<Value> | Value;
    nodes: TypedNode[];
};

/**
 * Discriminated union — type-guard для TypeScript.
 * Аналог TypedFieldRegistry из react-declarative:
 * позволяет IDE автоматически сужать тип после указания type.
 */
export type TypedNodeRegistry<Target = unknown> =
    Target extends SourceNode ? SourceNode :
    Target extends OutputNode ? OutputNode :
    never;

/**
 * Типизированный узел графа.
 * Подставляется вместо INode для строгой проверки типов
 * на стороне прикладного программиста.
 */
export type TypedNode = SourceNode | OutputNode;

export default TypedNode;
