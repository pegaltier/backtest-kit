import { queued, sleep } from "functools-kit";

const BUSY_DELAY = 100;

const SET_BUSY_SYMBOL = Symbol("setBusy");
const GET_BUSY_SYMBOL = Symbol("getBusy");

const ACQUIRE_LOCK_SYMBOL = Symbol("acquireLock");
const RELEASE_LOCK_SYMBOL = Symbol("releaseLock");

const ACQUIRE_LOCK_FN = async (self: Lock) => {
  while (self[GET_BUSY_SYMBOL]()) {
    await sleep(BUSY_DELAY);
  }
  self[SET_BUSY_SYMBOL](true);
};

export class Lock {
  private _isBusy = 0;

  [SET_BUSY_SYMBOL](isBusy: boolean) {
    this._isBusy += isBusy ? 1 : -1;
    if (this._isBusy < 0) {
      throw new Error("Extra release in finally block");
    }
  }

  [GET_BUSY_SYMBOL](): boolean {
    return !!this._isBusy;
  }

  [ACQUIRE_LOCK_SYMBOL] = queued(ACQUIRE_LOCK_FN);
  [RELEASE_LOCK_SYMBOL] = () => this[SET_BUSY_SYMBOL](false);

  public acquireLock = async () => {
    await this[ACQUIRE_LOCK_SYMBOL](this);
  };

  public releaseLock = async () => {
    await this[RELEASE_LOCK_SYMBOL]();
  };
}
