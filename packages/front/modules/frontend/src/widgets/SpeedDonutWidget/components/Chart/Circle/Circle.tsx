import classNames from "clsx";

import { makeStyles } from '../../../../../styles';

interface IFooterProps {
  className?: string;
  style?: React.CSSProperties;
  lineWidth: number;
  rotate: number;
  color: string;
  side: number;
}

const useStyles = makeStyles()(() => ({
  circle: {
    position: "absolute",
    transform: "translate(-50%, 50%)",
    bottom: "0",
    left: "50%",
    "& > div": { borderRadius: "50%" }
  }
}));

export const Circle = ({
  className,
  style,
  lineWidth,
  side,
  color,
  rotate,
}: IFooterProps) => {
  const { classes } = useStyles();
  return (
    <div className={classNames(className, classes.circle)} style={{ ...style }}>
      <div
        style={{
          borderTop: `${lineWidth}px solid ${color}`,
          borderLeft: `${lineWidth}px solid ${color}`,
          borderRight: `${lineWidth}px solid transparent`,
          borderBottom: `${lineWidth}px solid transparent`,
          transform: `rotate(${rotate}deg)`,
          height: side,
          width: side,
        }}
      />
    </div>
  );
}

export default Circle;
