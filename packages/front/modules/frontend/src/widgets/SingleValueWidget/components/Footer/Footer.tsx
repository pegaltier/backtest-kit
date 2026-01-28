import { useMemo } from "react";

import { makeStyles } from '../../../../styles';

import classNames from "clsx";

import usePropsContext from "../../context/PropsContext";
import { BackgroundMode } from "../../model/BackgroundMode";

interface IFooterProps {
  className?: string;
  style?: React.CSSProperties;
  backgroundColor: string;
}

const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    alignItems: "center",
    justifyContent: "stretch",
    whiteSpace: "nowrap",
    gap: "8px",
    overflow: "hidden",
    padding: "10px",
    borderTop: `1px solid ${theme.palette.divider}`,
    "& > *": { flex: 1 }
  },
  solidBackground: {
    color: "#fff",
    "& svg": { fill: "#fff" }
  },
  unsetBackground: {
    color: theme.palette.text.primary,
    "& svg": { fill: theme.palette.text.primary, }
  },
  semiBackground: {
    color: theme.palette.text.primary,
    "& svg": { fill: theme.palette.text.primary, }
  }
}));

export const Footer = ({
  className,
  style: upperStyle,
  backgroundColor,
}: IFooterProps) => {

  const { classes } = useStyles();

  const { footerLabel, backgroundMode = BackgroundMode.Solid } =
    usePropsContext();

  const style = useMemo(
    () => ({
      ...upperStyle,
      ...(backgroundMode === BackgroundMode.Solid && {
        backgroundColor,
      }),
    }),
    [backgroundColor, backgroundMode, upperStyle]
  );

  return (
    <div
      className={classNames(className, classes.root, {
        [classes.solidBackground]: backgroundMode === BackgroundMode.Solid,
        [classes.unsetBackground]: backgroundMode === BackgroundMode.Unset,
        [classes.semiBackground]: backgroundMode === BackgroundMode.Semi,
      })}
      style={style}
    >
      {footerLabel}
    </div>
  );
};

export default Footer;
