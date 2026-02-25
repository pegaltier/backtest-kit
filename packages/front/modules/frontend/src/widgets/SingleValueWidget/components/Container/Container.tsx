import { useMemo } from "react";

import { makeStyles } from "../../../../styles";

import classNames from "clsx";

import { Footer } from "../Footer/Footer";
import { IChunk } from "../../model/IChunk";
import usePropsContext from "../../context/PropsContext";
import { Content } from "../Content/Content";

import { Header } from "../Header/Header";
import { Paper } from "@mui/material";

interface IContainerProps {
    className?: string;
    style?: React.CSSProperties;
}

const useStyles = makeStyles()({
    root: {
        overflow: "hidden",
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch",
        flexDirection: "column",
    },
    click: {
        cursor: "pointer",
    },
    header: { minHeight: "36px" },
    content: { flex: 1 },
    footer: { minHeight: "32px" },
});

export const Container = ({ className, style }: IContainerProps) => {
    const { classes } = useStyles();
    const { backgroundColor, onClick, footerLabel } = usePropsContext();
    return (
        <Paper
            className={classNames(className, classes.root, {
                [classes.click]: !!onClick,
            })}
            onClick={onClick}
            style={style}
        >
            <Header backgroundColor={backgroundColor} />
            <Content
                backgroundColor={backgroundColor}
                className={classes.content}
            />
            {!!footerLabel && (
                <Footer
                    backgroundColor={backgroundColor}
                    className={classes.footer}
                />
            )}
        </Paper>
    );
};

export default Container;
