export interface IReduceResult<T> {
  symbol: string;
  accumulator: T;
  totalTicks: number;
}

export type ReduceCallback<T> = (
  accumulator: T,
  index: number,
  when: Date,
  symbol: string
) => T | Promise<T>;

export async function reduce<T>(
  symbol: string,
  timeframes: Date[],
  callback: ReduceCallback<T>,
  initialValue: T
): Promise<IReduceResult<T>> {
  let accumulator = initialValue;

  for (let i = 0; i < timeframes.length; i++) {
    const when = timeframes[i];
    accumulator = await callback(accumulator, i, when, symbol);
  }

  return {
    symbol,
    accumulator,
    totalTicks: timeframes.length,
  };
}

export default reduce;
