import { IOutletModalProps } from "react-declarative";

export const NotificationView = ({
    data,
}: IOutletModalProps) => {
    return (
        <pre>
            {JSON.stringify(data, null, 2)}
        </pre>
    )
}

export default NotificationView;
