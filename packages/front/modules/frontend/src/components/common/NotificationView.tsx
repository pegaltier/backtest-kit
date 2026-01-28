import {
    ActionIcon,
    Async,
    HtmlView,
    LoaderView,
    Source,
    Subject,
    VirtualView,
    createLsManager,
    openBlank,
    useSinglerunAction,
} from "react-declarative";
import {
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemText,
    ListSubheader,
    Stack,
    Tab,
    alpha,
} from "@mui/material";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import { useState } from "react";
import Typography from "@mui/material/Typography";
import WarningIcon from "@mui/icons-material/Warning";
import clsx from "clsx";
import dayjs from "dayjs";

import TabList from "@mui/lab/TabList";
import TabContext from "@mui/lab/TabContext";
import {
    AccessAlarm,
    AirlineStops,
    ManageSearch,
    MonetizationOn,
    PhoneForwarded,
    ShoppingCart,
} from "@mui/icons-material";
import Recycling from "@mui/icons-material/Recycling";
import sanitize from "../../config/sanitize";
import { makeStyles } from "../../styles";
import { useAsyncAction, useOnce } from "react-declarative";

import MatBadge from "@mui/material/Badge";
import NotificationIcon from "@mui/icons-material/Notifications";
import ioc from "../../lib/ioc";

const reloadSubject = new Subject<void>();

const UPDATE_INTERVAL = 30_000;
const NOTIFY_COUNT_STORAGE = createLsManager<number>(
    "trade-notify-count-badge",
);

interface IBagdeProps {
    loading: boolean;
}

const Badge = ({ loading }: IBagdeProps) => {
    const [counter, setCounter] = useState(0);

    const { execute } = useSinglerunAction(
        async () => {
            const lastCount = NOTIFY_COUNT_STORAGE.getValue();
            const currentCount = await ioc.notifyViewService.getCount();
            if (lastCount === null) {
                NOTIFY_COUNT_STORAGE.setValue(currentCount);
                return;
            }
            if (lastCount !== currentCount) {
                setCounter(Math.max(currentCount - lastCount, 1));
                return;
            }
            setCounter(0);
        },
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
            fallback: ioc.errorService.handleGlobalError,
        },
    );

    useOnce(() =>
        Source.fromInterval(UPDATE_INTERVAL).connect(() => {
            execute();
        }),
    );

    useOnce(() => reloadSubject.subscribe(execute));

    return (
        <MatBadge badgeContent={counter} color="info">
            <NotificationIcon
                sx={{ color: "white !important", opacity: loading ? 0.8 : 1.0 }}
            />
        </MatBadge>
    );
};

const Loader = () => (
    <LoaderView
        sx={{
            width: 350,
            height: "calc(100% - 96px)",
        }}
    />
);

const useStyles = makeStyles()((theme) => ({
    list: {
        pt: 1,
        pb: 1,
        "& > *": {
            paddingTop: 0,
            paddingBottom: 0,
            "& > *": {
                paddingTop: 0,
                paddingBottom: 0,
            },
        },
    },
    listItemAccient: {
        background: alpha(
            theme.palette.getContrastText(theme.palette.background.paper),
            0.018,
        ),
    },
}));

export const NotificationView = () => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>();
    const { classes } = useStyles();

    const [loading, setLoading] = useState(0);
    const [tab, setTab] = useState<"all" | "sell">("all");

    let open = false;

    return (
        <>
            <ActionIcon
                onClick={async ({ currentTarget }) => {
                    NOTIFY_COUNT_STORAGE.setValue(
                        await ioc.notifyViewService.getCount(),
                    );
                    reloadSubject.next();
                    setAnchorEl(currentTarget);
                }}
                onLoadStart={() => setLoading((loading) => loading + 1)}
                onLoadEnd={() => setLoading((loading) => loading - 1)}
                color="inherit"
                sx={{
                    ml: {
                        xs: 1,
                        md: 2,
                    },
                }}
            >
                <Badge key={anchorEl ? 1 : 0} loading={!!loading} />
            </ActionIcon>
            <Popover
                open={!!anchorEl}
                anchorEl={anchorEl}
                hidden={open}
                onClose={() => {
                    setAnchorEl(null);
                    setTab("all");
                }}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
            >
                <TabContext value={tab}>
                    <List
                        sx={{
                            width: 350,
                            height: 448,
                        }}
                        subheader={
                            <Stack
                                direction="row"
                                justifyContent="space-between"
                            >
                                <ListSubheader
                                    component={Typography}
                                    sx={{ fontWeight: "bold" }}
                                >
                                    {tab === "all"
                                        ? "Все"
                                        : "Покупки"}
                                </ListSubheader>
                                <TabList
                                    onChange={(_, tab) => setTab(tab)}
                                    sx={{
                                        "& .MuiTabs-indicator": {
                                            background: "#3F51B5 !important",
                                        },
                                    }}
                                    color="secondary"
                                    variant="standard"
                                >
                                    <Tab icon={<ManageSearch />} value="all" />
                                    <Tab icon={<AirlineStops />} value="sell" />
                                </TabList>
                            </Stack>
                        }
                    >
                        {tab === "all" && (
                            <Async Loader={Loader}>
                                {async () => {
                                    const { rows: items } =
                                        await ioc.notifyViewService.paginate(
                                            {
                                                $or: [
                                                    { action: "buy" },
                                                    {
                                                        action:
                                                            "close",
                                                    },
                                                    {
                                                        action:
                                                            "wait",
                                                    },
                                                ],
                                            },
                                            { limit: 25, offset: 0 },
                                        );
                                    return (
                                        <VirtualView
                                            className={classes.list}
                                            sx={{
                                                width: 350,
                                                height: "calc(100% - 48px)",
                                            }}
                                        >
                                            {items.map((item, idx) => (
                                                <ListItem
                                                    className={clsx({
                                                        [classes.listItemAccient]:
                                                            idx % 2 === 0,
                                                    })}
                                                    key={item.$id}
                                                    disableGutters
                                                >
                                                    <ListItemButton
                                                        onClick={() => {
                                                            if (
                                                                item.orderCloseId
                                                            ) {
                                                                ioc.layoutService.pickOrderCloseInfo(
                                                                    item.orderCloseId,
                                                                );
                                                                setAnchorEl(
                                                                    null,
                                                                );
                                                                return;
                                                            }
                                                            if (item.orderId) {
                                                                ioc.layoutService.pickOrderInfo(
                                                                    item.orderId,
                                                                );
                                                                setAnchorEl(
                                                                    null,
                                                                );
                                                                return;
                                                            }
                                                            ioc.layoutService.pickNotifyInfo(
                                                                item.id,
                                                            );
                                                            setAnchorEl(null);
                                                        }}
                                                    >
                                                        <ListItemAvatar>
                                                            <Avatar
                                                                sx={{
                                                                    background:
                                                                        item.action ===
                                                                        "close"
                                                                            ? "green"
                                                                            : item.action ===
                                                                                "buy"
                                                                              ? "orange"
                                                                              : undefined,
                                                                }}
                                                            >
                                                                {item.action ===
                                                                "close" ? (
                                                                    <MonetizationOn
                                                                        sx={{
                                                                            mt: "-1px",
                                                                            mr: "-0.5px",
                                                                        }}
                                                                    />
                                                                ) : item.action ===
                                                                  "buy" ? (
                                                                    <ShoppingCart
                                                                        sx={{
                                                                            mt: "0.5px",
                                                                            mr: "-0.5px",
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <WarningIcon
                                                                        sx={{
                                                                            color: "white",
                                                                            mt: "-2px",
                                                                        }}
                                                                    />
                                                                )}
                                                            </Avatar>
                                                        </ListItemAvatar>
                                                        <ListItemText
                                                            primary={
                                                                <HtmlView
                                                                    config={
                                                                        sanitize
                                                                    }
                                                                    handler={() => {
                                                                        if (
                                                                            item.action ===
                                                                            "buy"
                                                                        ) {
                                                                            return "Покупка";
                                                                        }
                                                                        if (
                                                                            item.action ===
                                                                            "close"
                                                                        ) {
                                                                            return "Продажа";
                                                                        }
                                                                        if (
                                                                            item.action ===
                                                                            "wait"
                                                                        ) {
                                                                            return "Ожидание";
                                                                        }
                                                                        return "Неизвестно";
                                                                    }}
                                                                />
                                                            }
                                                            secondary={dayjs(
                                                                item.date,
                                                            ).format(
                                                                "HH:mm DD/MM/YYYY",
                                                            )}
                                                        />
                                                        <IconButton
                                                            disableRipple
                                                        >
                                                            <ArrowForwardIcon />
                                                        </IconButton>
                                                    </ListItemButton>
                                                </ListItem>
                                            ))}
                                        </VirtualView>
                                    );
                                }}
                            </Async>
                        )}
                        {tab === "sell" && (
                            <Async Loader={Loader}>
                                {async () => {
                                    const { rows: items } =
                                        await ioc.notifyViewService.paginate(
                                            {
                                                $or: [
                                                    { action: "buy" },
                                                    {
                                                        action:
                                                            "close",
                                                    },
                                                ],
                                            },
                                            { limit: 25, offset: 0 },
                                        );
                                    return (
                                        <VirtualView
                                            className={classes.list}
                                            sx={{
                                                width: 350,
                                                height: "calc(100% - 48px)",
                                            }}
                                        >
                                            {items.map((item, idx) => (
                                                <ListItem
                                                    className={clsx({
                                                        [classes.listItemAccient]:
                                                            idx % 2 === 0,
                                                    })}
                                                    key={item.$id}
                                                    disableGutters
                                                >
                                                    <ListItemButton
                                                        onClick={() => {
                                                            if (
                                                                item.orderCloseId
                                                            ) {
                                                                ioc.layoutService.pickOrderCloseInfo(
                                                                    item.orderCloseId,
                                                                );
                                                                setAnchorEl(
                                                                    null,
                                                                );
                                                                return;
                                                            }
                                                            if (item.orderId) {
                                                                ioc.layoutService.pickOrderInfo(
                                                                    item.orderId,
                                                                );
                                                                setAnchorEl(
                                                                    null,
                                                                );
                                                                return;
                                                            }
                                                            ioc.layoutService.pickNotifyInfo(
                                                                item.id,
                                                            );
                                                            setAnchorEl(null);
                                                        }}
                                                    >
                                                        <ListItemAvatar>
                                                            <Avatar
                                                                sx={{
                                                                    background:
                                                                        item.action ===
                                                                        "close"
                                                                            ? "green"
                                                                            : item.action ===
                                                                                "buy"
                                                                              ? "orange"
                                                                              : undefined,
                                                                }}
                                                            >
                                                                {item.action ===
                                                                "close" ? (
                                                                    <MonetizationOn
                                                                        sx={{
                                                                            mt: "-1px",
                                                                            mr: "-0.5px",
                                                                        }}
                                                                    />
                                                                ) : item.action ===
                                                                  "buy" ? (
                                                                    <ShoppingCart
                                                                        sx={{
                                                                            mt: "0.5px",
                                                                            mr: "-0.5px",
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <WarningIcon
                                                                        sx={{
                                                                            color: "white",
                                                                            mt: "-2px",
                                                                        }}
                                                                    />
                                                                )}
                                                            </Avatar>
                                                        </ListItemAvatar>
                                                        <ListItemText
                                                            primary={
                                                                <HtmlView
                                                                    config={
                                                                        sanitize
                                                                    }
                                                                    handler={() => {
                                                                        if (
                                                                            item.action ===
                                                                            "buy"
                                                                        ) {
                                                                            return "Покупка";
                                                                        }
                                                                        if (
                                                                            item.action ===
                                                                            "close"
                                                                        ) {
                                                                            return "Продажа";
                                                                        }
                                                                        if (
                                                                            item.action ===
                                                                            "wait"
                                                                        ) {
                                                                            return "Ожидание";
                                                                        }
                                                                        return "Неизвестно";
                                                                    }}
                                                                />
                                                            }
                                                            secondary={dayjs(
                                                                item.date,
                                                            ).format(
                                                                "HH:mm DD/MM/YYYY",
                                                            )}
                                                        />
                                                        <IconButton
                                                            disableRipple
                                                        >
                                                            <ArrowForwardIcon />
                                                        </IconButton>
                                                    </ListItemButton>
                                                </ListItem>
                                            ))}
                                        </VirtualView>
                                    );
                                }}
                            </Async>
                        )}
                    </List>
                </TabContext>
            </Popover>
            {/*render()*/}
        </>
    );
};

export default NotificationView;
