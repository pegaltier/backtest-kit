export interface IStockItem {
    time: {
        year: number,
        month: number,
        day: number,
    },
    resolved: number,
    rejected: number,
    value: number,
}

export default IStockItem;
