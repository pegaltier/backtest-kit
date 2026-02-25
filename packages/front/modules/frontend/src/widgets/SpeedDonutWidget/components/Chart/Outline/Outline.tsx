import { makeStyles } from '../../../../../styles';

interface IOutlineProps {
  side: number;
}

const useStyles = makeStyles()((theme) => ({
  dot: {
    position: "absolute",
    transform: "translate(-50%, 50%)",
    bottom: "0",
    left: "50%",
    borderRadius: "50%",
    outline: `100vmax solid ${theme.palette.background.paper}`,
  }
}));

export const Outline = ({ side }: IOutlineProps) => {
  const { classes } = useStyles();
  return <div className={classes.dot} style={{ height: side, width: side }} />;
};

export default Outline;
