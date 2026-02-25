import { useMemo } from "react";

import { makeStyles } from '../../../../styles';

import classNames from "clsx";

import usePropsContext from "../../context/PropsContext";
import { BackgroundMode } from "../../model/BackgroundMode";

interface IHeaderProps {
  className?: string;
  style?: React.CSSProperties;
  backgroundColor: string;
}

const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    fontWeight: 700,
    fontSize: "18px",
    paddingLeft: "8px",
    gap: "8px",
    overflow: "hidden",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  solidBackground: {
    color: "#fff",
    padding: "10px",
    "& svg": { fill: "#fff" }
  },
  semiBackground: {
    color: "#fff",
    padding: "10px",
    "& svg": { fill: "#fff" }
  },
  unsetBackground: {
    color: theme.palette.text.primary,
    padding: "10px",
    "& svg": { fill: theme.palette.text.primary }
  }
}));

export const Header = ({
  className,
  style: upperStyle,
  backgroundColor,
}: IHeaderProps) => {

  const { classes } = useStyles();

  const { headerLabel, backgroundMode = BackgroundMode.Solid } =
    usePropsContext();

  const style = useMemo(
    () => ({
      ...upperStyle,
      ...((backgroundMode === BackgroundMode.Solid ||
        backgroundMode === BackgroundMode.Semi) && {
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
      {headerLabel}
    </div>
  );
};

export default Header;
