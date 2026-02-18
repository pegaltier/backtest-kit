import INode from '../interfaces/Node.interface';

/**
 * Рекурсивно разворачивает граф узлов в плоский массив.
 * Порядок: сначала зависимости (children), затем родитель — топологический порядок.
 * Дубликаты (один узел может быть зависимостью нескольких) исключаются по ссылке.
 */
export const deepFlat = (arr: INode[] = []): INode[] => {
    const result: INode[] = [];
    const seen = new Set<INode>();
    const process = (entries: INode[] = []) => entries.forEach((entry) => {
        if (seen.has(entry)) {
            return;
        }
        seen.add(entry);
        process(entry.nodes ?? []);
        result.push(entry);
    });
    process(arr);
    return result;
};

export default deepFlat;
