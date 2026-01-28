import { Box, Paper } from "@mui/material";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
    ChatController,
    ChatView,
    PaperView,
    queued,
    randomString,
    sleep,
    useForceUpdate,
    useOnce,
    usePreventAction,
    usePreventNavigate,
} from "react-declarative";
import { ioc } from "../../lib";
import Markdown from "../../components/common/Markdown";

const CODE_NORMAL = 1_000;

export const ChatWidget = () => {

    const [chatCtl, setChatCtl] = useState(new ChatController());
    const [actReq, setActReq] = useState(chatCtl.getActionRequest());

    const disposeRef = useRef<Function | undefined>(undefined);

    const {
        handleLoadStart,
        handleLoadEnd,
    } = usePreventAction({
        onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
        onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
    })

    useOnce(() =>
        ioc.layoutService.reloadOutletSubject.subscribe(() => {
            const chatCtl = new ChatController();
            setChatCtl(chatCtl);
            setActReq(chatCtl.getActionRequest());
        }),
    );

    useOnce(
        async () => {
            
            let isDisposed = false;

            disposeRef.current && disposeRef.current();

            chatCtl.addOnActionChanged(() =>
                setActReq(chatCtl.getActionRequest()),
            );

            const clientId = randomString();
            const url = new URL(`/api/v2/session/${clientId}`, location.origin);
            url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

            const socket = new WebSocket(url);

            socket.onopen = async () => {
                await chatCtl.setActionRequest({ type: "text" });
            };

            socket.onerror = () => {
                throw new Error("Socket closed (error)");
            };

            let pendingMessage: number | null = null;
            let pendingText = "";

            const handleToken = async (token: string) => {
                if (isDisposed) {
                    return;
                }
                pendingText = pendingText + token;
                await chatCtl.updateMessage(pendingMessage, {
                    type: "text",
                    content: <Markdown content={pendingText} />,
                    self: false,
                });
            }

            const handleMessage = async (completion: string) => {
                if (isDisposed) {
                    return;
                }
                if (pendingText?.trim()) {
                    pendingMessage = null;
                    pendingText = "";
                    handleLoadEnd(true);
                    await chatCtl.setActionRequest({ type: "text" });
                    return;
                }
                if (pendingMessage === null) {
                    pendingMessage = await chatCtl.addMessage({
                        type: "text",
                        content: <Markdown content={completion} />,
                        self: false,
                    });
                } else {
                    await chatCtl.updateMessage(pendingMessage, {
                        type: "text",
                        content: <Markdown content={completion} />,
                        self: false,
                    });
                }
                {    
                    pendingMessage = null;
                    pendingText = "";
                }
                handleLoadEnd(true);
                await chatCtl.setActionRequest({ type: "text" });
            }

            socket.onmessage = queued(async (event) => {
                const data = JSON.parse(event.data);
                if (data.type === "token") {
                    await handleToken(data.token);
                    return;
                }
                if (data.type === "completion") {
                    await handleMessage(data.completion);
                    return;
                }
            });

            socket.onclose = () => {
                if (isDisposed) {
                    return;
                }
                throw new Error("Socket closed")
            }

            chatCtl.addOnMessagesChanged(async () => {
                const [{ content, self }] = chatCtl.getMessages().slice(-1);
                if (!self) {
                    return;
                }
                {
                    pendingMessage = await chatCtl.addMessage({
                        type: "text",
                        content: "Генерация ответа...",
                        self: false,
                    });
                    pendingText = ""
                }
                socket.send(JSON.stringify({ data: content }));
                handleLoadStart();
            });

            disposeRef.current = () => {
                if (isDisposed) {
                    return;
                }
                isDisposed = true;
                handleLoadEnd(true);
                socket.close(CODE_NORMAL);
            };
        },
        {
            deps: [chatCtl],
        },
    );

    useEffect(() => () => {
        disposeRef.current && disposeRef.current();
    }, []);

    return (
        <Paper
            sx={{
                position: "relative",
                height: "calc(100dvh - 160px)",
                width: "100%",
                overflow: "hidden",
                background: "#33eb91",
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: "100%",
                    zIndex: 1,
                    p: 1,
                }}
            >
                <ChatView chatController={chatCtl} />
            </Box>
            {!!actReq && (
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        width: "100%",
                        height: "72px",
                        background: "white",
                        zIndex: 0,
                    }}
                />
            )}
        </Paper>
    );
};

export default ChatWidget;
