import classNames from "clsx";

import { makeStyles } from '../../../../../styles';

interface IPointerProps extends React.SVGProps<SVGSVGElement> {
  angle: number;
  scale?: number;
}

const useStyles = makeStyles()((theme) => ({
  pointer: {
    position: "absolute",
    left: "21%",
    width: "29%",
    bottom: "0%",
    zIndex: 1,
    transformOrigin: "right center",
    fill: theme.palette.text.primary,
  }
}));

export const Pointer = ({
  className,
  style,
  angle,
  scale = 1.0,
  ...otherProps
}: IPointerProps) => {
  const { classes } = useStyles();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 87 8"
      className={classNames(className, classes.pointer)}
      style={{ ...style, transform: `rotate(${angle}deg) scale(${scale}) translateX(5px)` }}
      {...otherProps}
    >
      <rect x="0.5" y="2.5" width="79" height="3" />
      <circle cx="82.5" cy="4" r="4" />
    </svg>
  );
};

export default Pointer;
