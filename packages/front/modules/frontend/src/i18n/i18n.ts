import { Translate } from "react-declarative";
import { t } from "./tools/t";
import { LOCALE } from "./locale/locale";
import { ioc } from "../lib";

Translate.install(LOCALE, t, {
  rawCondition: (c) => /[ЁёА-я]/.test(c),
  useRawMark: !!process.env.CC_I18N_FLAG,
});

ioc.routerService.listen(({ action }) => {
  if (action === "PUSH") {
    window.Translate.clear();
  }
});
