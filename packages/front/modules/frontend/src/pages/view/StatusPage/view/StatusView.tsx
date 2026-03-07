import { IOutletProps } from "react-declarative";

export const StatusView = ({ params }: IOutletProps) => {
    return <p>{JSON.stringify(params, null, 2)}</p>
}

export default StatusView;
