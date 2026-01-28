import {
    Box,
    ButtonBase,
    Chip,
    Container,
    lighten,
    Paper,
    Stack,
} from "@mui/material";
import {
    Breadcrumbs2,
    Breadcrumbs2Type,
    Center,
    FieldType,
    IBreadcrumbs2Action,
    IBreadcrumbs2Option,
    IOutletProps,
    One,
    TypedField,
    typo,
    useAsyncValue,
} from "react-declarative";
import { ioc } from "../../../../lib";
import { makeStyles } from "../../../../styles";
import IconWrapper from "../../../../components/common/IconWrapper";
import { Quickreply } from "@mui/icons-material";

const GROUP_HEADER = "trade-gpt__groupHeader";
const GROUP_ROOT = "trade-gpt__groupRoot";

const useStyles = makeStyles()({
    root: {
        [`& .${GROUP_ROOT}:hover .${GROUP_HEADER}`]: {
            opacity: "1 !important",
        },
    },
});

interface IRoute {
    label: string;
    to: string;
}

const options: IBreadcrumbs2Option[] = [
    {
        type: Breadcrumbs2Type.Link,
        label: "Дэшборд",
    },
    {
        type: Breadcrumbs2Type.Link,
        label: "Меню",
    },
];

const actions: IBreadcrumbs2Action[] = [
    {
        action: "open-chat-action",
        icon: () => <IconWrapper icon={Quickreply} color="#4caf50" />,
        label: "Открыть чат",
    },
];

const createButton = (to: string, label: React.ReactNode): TypedField => ({
    type: FieldType.Component,
    desktopColumns: "6",
    tabletColumns: "12",
    phoneColumns: "12",
    fieldRightMargin: "1",
    fieldBottomMargin: "1",
    element: () => (
        <Paper
            component={ButtonBase}
            onClick={() => {
                ioc.routerService.push(to);
            }}
            sx={{
                width: "100%",
                background: (theme) => theme.palette.primary.main,
                color: "white",
                fontWeight: "bold",
                fontSize: "18px",
                height: "75px",
                minHeight: "125px",
                textWrap: "wrap",
                padding: "16px",
                "&:hover": {
                    background: (theme) =>
                        lighten(theme.palette.primary.main, 0.23),
                },
                transition: "background 500ms",
            }}
        >
            {label}
        </Paper>
    ),
});

const admin_routes: IRoute[] = [
    {
        label: "Панель администратора",
        to: "/dashboard/admin_panel",
    },
];

const data_routes: IRoute[] = [
    {
        label: "Long Range (RSI)",
        to: "/dashboard/long_range",
    },
    {
        label: "Swing Range (MACD)",
        to: "/dashboard/swing_range",
    },
    {
        label: "Short Range (EMA)",
        to: "/dashboard/short_range",
    },
];

const news_routes: IRoute[] = [
    {
        label: "Mastodon",
        to: "/dashboard/news_mastodon",
    },
    {
        label: "Веб поиск",
        to: "/dashboard/news_brave",
    },
    {
        label: "Стратегия торгов",
        to: "/dashboard/strategy_report",
    },
];

const other_routes: IRoute[] = [
    {
        label: "Объём рынка (SMA)",
        to: "/dashboard/volume_data",
    },
    {
        label: "Калькулятор стратегии",
        to: "/dashboard/calculate",
    },
    {
        label: "Лицензия",
        to: "/dashboard/license",
    },
];

const createGroup = (label: string, routes: IRoute[]): TypedField => ({
    type: FieldType.Group,
    className: GROUP_ROOT,
    sx: {
        p: 2,
    },
    desktopColumns: "6",
    tabletColumns: "6",
    phoneColumns: "12",
    fields: [
        {
            type: FieldType.Component,
            className: GROUP_HEADER,
            style: {
                transition: "opacity 500ms",
                opacity: 0.5,
            },
            element: () => (
                <Stack direction="row">
                    <Chip
                        variant="outlined"
                        size="medium"
                        color="info"
                        label={`${typo.bullet} ${label}`}
                        onClick={() => ioc.alertService.notify("Пасхалка")}
                        sx={{
                            mb: 1,
                            pr: 0.5,
                            fontSize: "16px",
                            background: "white",
                            cursor: "not-allowed",
                        }}
                    />
                    <Box flex={1} />
                </Stack>
            ),
        },
        {
            type: FieldType.Group,
            fields: routes.map(({ label, to }) => createButton(to, label)),
        },
    ],
});

const fields: TypedField[] = [
    createGroup("Приложение", admin_routes),
    createGroup("Индикаторы", data_routes),
    createGroup("Новости", news_routes),
    createGroup("Прочее", other_routes),
];

export const MainPage = ({ history, payload }: IOutletProps) => {
    const { classes } = useStyles();

    const {} = useLoader();

    const [] = useAsyncValue(async () => {

    }, {

    })

    const handleAction = async (action: string) => {
        if (action === "open-chat-action") {
            ioc.routerService.push("/other/chat")
        }
    };

    return (
        <Container>
            <Breadcrumbs2
                items={options}
                actions={actions}
                onAction={handleAction}
            />
            <One
                className={classes.root}
                fields={fields}
                payload={() => ({
                    ...payload,
                    history,
                })}
            />
        </Container>
    );
};

export default MainPage;
