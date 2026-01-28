import { Button, Stack } from "@mui/material";
import { ActionButton } from "react-declarative";
import getMarkdownUrl from "../../utils/getMarkdownUrl";
import { makeStyles } from "../../styles";
import { ioc } from "../../lib";

interface IInfoButtonProps {
    info?: string;
}

const useStyles = makeStyles()({
    button: {
        opacity: 0.5,
        transition: "opacity 500ms",
        '&:hover': {
            opacity: 1.0,
        },
    },
})

export const InfoButton = ({
    info,
}: IInfoButtonProps) => {

    const { classes } = useStyles();

    if (!info) {
        return null;
    }

    return (
        <Stack
            className={classes.button}
            direction="row"
            justifyContent="flex-end"
            width="100%"
            spacing={2}
            padding={2}
            pt={8}
            pr={3}
        >
            <ActionButton
                size="large"
                variant="text"
                color="primary"
                onClick={async () => {
                    const url = await getMarkdownUrl(info);
                    if (url) {
                        ioc.layoutService.downloadFile(url, "debug.md");
                    }
                }}
            >
                Диагностика
            </ActionButton>
        </Stack>
    );
};

export default InfoButton;
