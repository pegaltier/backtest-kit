import { memo } from "react";

import { Container } from "./components/Container/Container";
import { PropsContextProvider } from "./context/PropsContext";
import { IProps } from "./model/IProps";

export type ISpeedDonutWidgetProps = IProps;

export const SpeedDonutWidget = memo(
  ({ className, style, ...otherProps }: IProps) => (
    <PropsContextProvider value={otherProps}>
      <Container className={className} style={style} />
    </PropsContextProvider>
  )
);

export default SpeedDonutWidget;
