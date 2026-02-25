import * as React from "react";
import { createContext, useContext } from "react";

import { IProps } from "../model/IProps";

const PropsContext = createContext<IProps>(null as never);

interface IPropsContextProviderProps {
  value: IProps;
  children: React.ReactNode;
}

export const PropsContextProvider = ({
  value,
  children,
}: IPropsContextProviderProps) => (
  <PropsContext.Provider value={value}>{children}</PropsContext.Provider>
);

export const usePropsContext = () => useContext(PropsContext);

export default usePropsContext;
