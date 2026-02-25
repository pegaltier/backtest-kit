export interface IItem {
    title: string;
    description: string;
    avatar: React.FC;
    done: number;
    inprogress: number;
    waiting: number;
    archive: number;
}

export default IItem;
