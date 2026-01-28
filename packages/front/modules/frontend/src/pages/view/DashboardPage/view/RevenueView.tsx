import { Box, Container } from "@mui/material";
import {
    Breadcrumbs2,
    Breadcrumbs2Type,
    datetime,
    dayjs,
    IBreadcrumbs2Action,
    IBreadcrumbs2Option,
    LoaderView,
    One,
    sleep,
    useAlert,
    useAsyncAction,
    useAsyncValue,
    useOnce,
    useOne,
    usePrompt,
} from "react-declarative";
import { ioc } from "../../../../lib";
import IconWrapper from "../../../../components/common/IconWrapper";
import {
    AirlineStops,
    CurrencyExchange,
    Equalizer,
    HourglassTop,
    KeyboardArrowLeft,
    Refresh,
    Search,
    TrendingUp,
} from "@mui/icons-material";
import revenue_fields from "../../../../assets/revenue_fields";
import { Background } from "../../../../components/common/Background";
import order_create_fields from "../../../../assets/order_create_fields";
import { defaultSlots } from "../../../../components/OneSlotFactory";

const ADMIN_PASS = "88888888";

const LOADER_SIZE = 56;

const actions: IBreadcrumbs2Action[] = [
    {
        action: "pick-closed",
        label: "История сделок",
        icon: () => <IconWrapper icon={CurrencyExchange} color="#4caf50" />,
    },
    {
        divider: true,
    },
    {
        action: "pick-volume-status",
        label: "Индикатор SMA (объём рынка)",
        icon: () => <IconWrapper icon={Equalizer} color="#4caf50" />,
    },
    {
        action: "pick-short-status",
        label: "Индикатор EMA (короткая перспектива)",
        icon: () => <IconWrapper icon={AirlineStops} color="#4caf50" />,
    },
    {
        action: "pick-swing-status",
        label: "Индикатор MACD (средняя перспектива)",
        icon: () => <IconWrapper icon={TrendingUp} color="#4caf50" />,
    },
    {
        action: "pick-long-status",
        label: "Индикатор RSI (долгая перспектива)",
        icon: () => <IconWrapper icon={HourglassTop} color="#4caf50" />,
    },
    {
        divider: true,
    },
    {
        action: "update-now",
        label: "Обновить",
        icon: () => <IconWrapper icon={Refresh} color="#4caf50" />,
    },
];

const options: IBreadcrumbs2Option[] = [
    {
        type: Breadcrumbs2Type.Link,
        action: "back-action",
        label: <KeyboardArrowLeft sx={{ display: "block" }} />,
    },
    {
        type: Breadcrumbs2Type.Link,
        action: "back-action",
        label: "Дэшборд",
    },
    {
        type: Breadcrumbs2Type.Link,
        action: "back-action",
        label: "Панель администратора",
    },
    {
        type: Breadcrumbs2Type.Button,
        action: "create-action",
        label: "Добавить заказ",
    },
];

export const RevenueView = () => {
    const pickAlert = useAlert({
        title: "Готово",
        description: "Заказ создан успешно",
    });

    const pickPrompt = usePrompt({
        title: "Пароль администратора",
        inputType: "password",
    });

    const pickOne = useOne<any>({
        title: "Создание заказа",
        fields: order_create_fields,
        slots: defaultSlots,
        handler: async () => ({
            currentPrice: await ioc.revenueViewService.getLastClosePrice(),
        }),
        large: true,
    });

    const [measure, { execute, loading }] = useAsyncValue(
        async () => await ioc.measureViewService.getTradeInfo(),
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        },
    );

    useOnce(() => ioc.layoutService.reloadOutletSubject.subscribe(execute));

    const { execute: executeBuy } = useAsyncAction(
        async (dto: {
            comment: string;
            price: string;
            quantity: string;
            timestamp: number;
        }) => {
            await ioc.actionViewService.commitCreate(dto);
            pickAlert().then(() => sleep(1_000).then(ioc.layoutService.reloadOutlet));
        },
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        },
    );

    const handleBuy = async () => {
        const confirm = await pickPrompt().toPromise();
        if (confirm !== ADMIN_PASS) {
            ioc.alertService.notify("Неверный пароль");
            return;
        }
        const data = await pickOne().toPromise();
        if (!data) {
            return;
        }
        const momentstamp = datetime.parseDate(data.date);
        const timestamp = datetime.parseTime(data.time);

        let date = dayjs();
        date = date.set("year", momentstamp.year);
        date = date.set("month", momentstamp.month - 1);
        date = date.set("date", momentstamp.day);
        date = date
            .set("hour", timestamp.hour)
            .set("minute", timestamp.minute)
            .set("second", 0)
            .set("millisecond", 0);

        await executeBuy({
            price: data.price,
            quantity: data.quantity,
            comment: data.comment,
            timestamp: date.toDate().getTime(),
        });
    };

    const handleAction = async (action: string) => {
        if (action === "create-action") {
            handleBuy();
        }
        if (action === "back-action") {
            ioc.routerService.push("/dashboard");
        }
        if (action === "pick-closed") {
            ioc.routerService.push("/other/order_closed");
        }
        if (action === "pick-short-status") {
            ioc.layoutService.pickShortRangeStatus();
        }
        if (action === "pick-swing-status") {
            ioc.layoutService.pickSwingRangeStatus();
        }
        if (action === "pick-long-status") {
            ioc.layoutService.pickLongRangeStatus();
        }
        if (action === "pick-volume-status") {
            ioc.layoutService.pickVolumeDataStatus();
        }
        if (action === "update-now") {
            execute();
        }
    };

    const renderInner = () => {
        if (!measure || loading) {
            return (
                <LoaderView
                    size={LOADER_SIZE}
                    sx={{ height: "calc(100dvh - 200px)" }}
                />
            );
        }
        return (
            <>
                <One handler={() => measure} fields={revenue_fields} />
                <Box sx={{ paddingBottom: "65px" }} />
            </>
        );
    };

    return (
        <Container>
            <Breadcrumbs2
                items={options}
                actions={actions}
                onAction={handleAction}
            />
            {renderInner()}
            <Background />
        </Container>
    );
};

export default RevenueView;
