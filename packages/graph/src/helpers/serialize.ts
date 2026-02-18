import { randomString } from "functools-kit";

import INode from '../interfaces/Node.interface';
import IFlatNode from '../interfaces/FlatNode.interface';

import deepFlat from './deepFlat';

/**
 * Преобразует древовидный граф в плоский массив IFlatNode для хранения в БД.
 * Каждому узлу присваивается уникальный id (если не задан),
 * объектные ссылки nodes заменяются на массив nodeIds.
 */
export const serialize = (roots: INode[]): IFlatNode[] => {
    const flat = deepFlat(roots);

    // Первый проход: назначаем id каждому уникальному узлу
    const idMap = new Map<INode, string>();
    flat.forEach((node) => {
        const id = randomString();
        idMap.set(node, id);
    });

    // Второй проход: строим IFlatNode с nodeIds вместо nodes
    return flat.map((node) => {
        const flatNode: IFlatNode = {
            id: idMap.get(node)!,
            type: node.type,
            description: node.description,
            fetch: node.fetch,
            compute: node.compute,
            nodeIds: node.nodes?.map((child) => idMap.get(child)!),
        };
        return flatNode;
    });
};

/**
 * Восстанавливает древовидный граф из плоского массива IFlatNode.
 * nodes каждого узла заполняется по nodeIds.
 * Возвращает корневые узлы (те, на которые никто не ссылается).
 */
export const deserialize = (flat: IFlatNode[]): INode[] => {
    // Первый проход: создаём INode-объекты, индексируем по id
    const byId = new Map<string, INode>();
    flat.forEach((flatNode) => {
        const node: INode = {
            type: flatNode.type,
            description: flatNode.description,
            fetch: flatNode.fetch,
            compute: flatNode.compute,
        };
        byId.set(flatNode.id, node);
    });

    // Второй проход: проставляем nodes[] по nodeIds
    flat.forEach((flatNode) => {
        if (flatNode.nodeIds?.length) {
            const node = byId.get(flatNode.id)!;
            node.nodes = flatNode.nodeIds
                .map((id) => byId.get(id))
                .filter((n): n is INode => n !== undefined);
        }
    });

    // Корневые узлы — те, на которые не ссылается никто другой
    const referenced = new Set(flat.flatMap((n) => n.nodeIds ?? []));
    return [...byId.entries()]
        .filter(([id]) => !referenced.has(id))
        .map(([, node]) => node);
};
