import { Typography } from "@mui/material";
import { makeStyles } from "../../../../styles";

const useStyles = makeStyles()({
    root: {
        position: "relative",
        width: "100%",
        height: "0px",
    },
    container: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    }
});

interface ICaptionProps {
    caption: string;
}

export const Caption = ({
    caption,
}: ICaptionProps) => {
    const { classes } = useStyles();
    return (
        <div className={classes.root}>
            <div className={classes.container}>
                <Typography
                    variant="caption"
                    sx={{
                        opacity: 0.5,
                        fontSize: 12,
                        textAlign: "center",
                        padding: "0 8px",
                    }}
                >
                    {caption}
                </Typography>
            </div>
        </div>
    );
}

export default Caption;
