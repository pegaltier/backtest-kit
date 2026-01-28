import {
    CalendarView,
    dayjs,
    formatAmount,
    getMomentStamp,
    useActualValue,
} from "react-declarative";
import { OpenOrder } from "../../lib/model/Measure.model";
import { useMemo } from "react";
import { ioc } from "../../lib";
import { ListItemText, Typography } from "@mui/material";

interface IOrderCalendarWidgetProps {
    items: OpenOrder[];
}

export const OrderCalendarWidget = ({ items }: IOrderCalendarWidgetProps) => {
    const stampMap = useMemo(() => {
        const stampMap = new Map<number, OpenOrder[]>();
        for (const item of items) {
            const stamp = dayjs(item.date).diff(dayjs('1970-01-01'), 'day');;
            const stampList = stampMap.get(stamp) || [];
            stampList.push(item);
            stampMap.set(stamp, stampList);
        }
        return stampMap;
    }, [items]);

    const stampMap$ = useActualValue(stampMap);

    return (
        <CalendarView
            dotSide={6}
            sx={{
                height: "100%",
            }}
            handler={async ({ fromStamp, toStamp }) => {
                let items = [];

                for (let stamp = fromStamp; stamp <= toStamp; stamp++) {
                    const stampItems = stampMap$.current.get(stamp);
                    stampItems?.forEach((data) => {
                        items.push({
                            data,
                            stamp,
                        });
                    });
                }

                return items;
            }}
            onLoadStart={() => ioc.layoutService.setAppbarLoader(true)}
            onLoadEnd={() => ioc.layoutService.setAppbarLoader(false)}
            renderItem={({ data }) => (
                <>
                    <ListItemText
                        primary={formatAmount(data.price)}
                        secondary={data.quantity}
                    />
                    <Typography>{data.coin} {dayjs(data.date).format("HH:mm")}</Typography>
                </>
            )}
            onItemClick={({ data }) => {
                ioc.layoutService.pickOrderInfo(data.id);
            }}
        />
    );
};

export default OrderCalendarWidget;
