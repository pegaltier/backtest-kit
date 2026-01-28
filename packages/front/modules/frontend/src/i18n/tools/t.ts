import { LOCALE } from "../locale/locale";

export function t(str: string) {
  return LOCALE[str] || str;
}

export default t;
