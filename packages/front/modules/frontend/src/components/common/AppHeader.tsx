import {
    alpha,
    Avatar,
    Box,
    darken,
    lighten,
    LinearProgress,
    Typography,
} from "@mui/material";
import { makeStyles } from "../../styles";
import {
    ActionMenu,
    Center,
    FieldType,
    IOption,
    reloadPage,
    sleep,
    TypedField,
    useAlert,
    useOne,
    usePrompt,
    useSinglerunAction,
} from "react-declarative";
import {
    AccountBalance,
    Announcement,
    Logout,
    MonetizationOn,
    Newspaper,
    Refresh,
    ShoppingCart,
    Twitter,
} from "@mui/icons-material";
import { ioc } from "../../lib";
import IconWrapper from "./IconWrapper";
import { defaultSlots } from "../OneSlotFactory";
import AppSettings from "./AppSettings";
import NotificationView from "./NotificationView";

const ADMIN_PASS = "88888888";

const LOADER_HEIGHT = 4;

const LOGO_SRC = "/logo/icon512_maskable.png";
const LOGO_CLASS = "tradegpt-logo";
const LOGO_SIDE = 32;

const useStyles = makeStyles()((theme) => ({
    root: {
        position: "sticky",
        top: 0,
        zIndex: 9,
        height: "80px",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch",
        flexDirection: "column",
    },
    container: {
        flex: 1,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        gap: "8px",
        paddingRight: "8px",
        position: "relative",
        marginBottom: "10px",
        alignItems: "center",
        backdropFilter: "saturate(180%) blur(20px)",
        backgroundColor: alpha(darken(theme.palette.primary.main, 0.2), 0.8),
        "&:hover": {
            [`& .${LOGO_CLASS}`]: {
                opacity: 1.0,
            },
        },
    },
    title: {
        color: "white",
        paddingLeft: theme.spacing(1),
        transition: "opacity 500ms",
        opacity: "0.8",
        cursor: "pointer",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
    },
    loader: {
        position: "absolute",
        bottom: 0,
        left: 0,
        width: "100%",
        minHeight: `${LOADER_HEIGHT}px`,
        maxHeight: `${LOADER_HEIGHT}px`,
        marginTop: `-${LOADER_HEIGHT}px`,
        zIndex: 2,
    },
    logo: {
        transition: "opacity 500ms",
        marginLeft: "8px",
        marginRight: "-6px",
        opacity: "0.5",
    },
    actionMenu: {
        "& svg": {
            color: "white",
        },
    },
    stretch: {
        flex: 1,
    },
}));

interface IAppHeaderProps {
    loading: boolean;
}

const actions: IOption[] = [
    {
        action: "brave-action",
        icon: () => <IconWrapper icon={Newspaper} color="#ff3800" />,
        label: "Просмотреть Brave",
    },
    {
        action: "mastodon-action",
        icon: () => <IconWrapper icon={Twitter} color="#6364ff" />,
        label: "Просмотреть Mastodon",
    },
    {
        divider: true,
    },
    {
        action: "buy-action",
        icon: () => <IconWrapper icon={AccountBalance} color="#ff9100" />,
        label: "Отправить сигнал покупки",
    },
];

const fields: TypedField[] = [
    {
        type: FieldType.Combo,
        noDeselect: true,
        readonly: true,
        name: "action",
        title: "",
        placeholder: "Сигнал",
        itemList: ["buy", "sell"],
        tr: (action) => {
            if (action === "buy") {
                return "Покупка";
            }
            if (action === "sell") {
                return "Продажа";
            }
            return "Неизвестно";
        },
        defaultValue: "buy",
    },
    {
        type: FieldType.Text,
        fieldBottomMargin: "2",
        name: "comment",
        title: "",
        placeholder: "Комментарий",
        inputRows: 5,
        validation: {
            required: true,
        },
    },
];

export const AppHeader = ({ loading }: IAppHeaderProps) => {
    const { classes, cx } = useStyles();

    const pickPrompt = usePrompt({
        title: "Пароль администратора",
        inputType: "password",
    });

    const pickOne = useOne({
        title: "Отправка сигнала",
        canCancel: true,
        large: true,
        slots: defaultSlots,
        fields,
    });

    const pickAlert = useAlert({
        title: "Статус сигнала",
        large: true,
    });

    const { execute } = useSinglerunAction(
        async (data: { comment: string }) => {
            const { isValid, message } = await ioc.actionViewService.commitBuy(
                data.comment,
            );
            pickAlert({
                title: isValid ? "Сигнал отправлен" : "Ошибка сигнала",
                description: message,
            }).then(() => sleep(1_000).then(ioc.layoutService.reloadOutlet));
        },
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        },
    );

    const commitAction = async (dto: { action: string; comment: string }) => {
        const data = await pickPrompt().toPromise();
        if (data === ADMIN_PASS) {
            await execute(dto);
            return;
        }
        ioc.alertService.notify("Неверный пароль");
    };

    const handleBuy = async () => {
        const data = await pickOne().toPromise();
        if (!data) {
            return;
        }
        {
            ioc.layoutService.setAppbarLoader(true);
            await sleep(2_500);
            ioc.layoutService.setAppbarLoader(false);
        }
        commitAction(data);
    };

    const handleAction = async (action: string) => {
        if (action === "buy-action") {
            await handleBuy();
        }
        if (action === "brave-action") {
            await ioc.layoutService.pickBraveInfo();
        }
        if (action === "mastodon-action") {
            await ioc.layoutService.pickMastodonInfo();
        }
    };

    return (
        <Box className={classes.root}>
            <Box className={classes.container}>
                <Center
                    onClick={() => ioc.routerService.push("/dashboard")}
                    className={cx(classes.logo, LOGO_CLASS)}
                >
                    <Avatar
                        style={{ height: LOGO_SIDE, width: LOGO_SIDE }}
                        src={LOGO_SRC}
                    />
                </Center>
                <Typography
                    variant="h4"
                    onClick={() => ioc.routerService.push("/dashboard")}
                    className={cx(classes.title, LOGO_CLASS)}
                    sx={{ display: { xs: "none", sm: "flex" } }}
                >
                    TradeGPT
                </Typography>
                <div className={classes.stretch} />
                <AppSettings />
                <NotificationView />
                <ActionMenu
                    className={classes.actionMenu}
                    transparent
                    onAction={handleAction}
                    options={actions}
                />
                {!!loading && <LinearProgress className={classes.loader} />}
            </Box>
        </Box>
    );
};

export default AppHeader;
