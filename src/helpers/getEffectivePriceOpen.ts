import { ISignalRow } from "../interfaces/Strategy.interface";

/**
 * Returns the effective (DCA-weighted) entry price for a signal.
 *
 * Uses cost-weighted harmonic mean: effectivePrice = Σcost / Σ(cost/price)
 * This is the correct formula for fixed-dollar DCA positions where each entry
 * has its own cost (e.g. $100, $200, etc.).
 *
 * When partial closes exist, uses the costBasisAtClose snapshot from the last partial
 * to avoid replaying the full entry history:
 *   1. Compute effectivePrice AT last partial = costBasisAtClose / Σ(cost/price for entries[0..entryCountAtClose])
 *   2. remainingCostBasis = costBasisAtClose * (1 - lastPartial.percent / 100)
 *   3. oldCoins = remainingCostBasis / effectivePriceAtPartial
 *   4. newCoins = Σ(cost/price) for entries added AFTER last partial
 *   5. effectivePrice = (remainingCostBasis + newCost) / (oldCoins + newCoins)
 *
 * @param signal - Signal row with _entry and optional _partial
 * @returns Effective entry price for PNL calculations
 */
export const getEffectivePriceOpen = (signal: ISignalRow): number => {
  const entries = signal._entry;
  if (!entries || entries.length === 0) return signal.priceOpen;

  const partials = signal._partial ?? [];

  if (partials.length === 0) {
    return weightedHarmonicMean(entries);
  }

  const last = partials[partials.length - 1];
  const remainingCostBasis = last.costBasisAtClose * (1 - last.percent / 100);

  // Effective price at the last partial snapshot
  const entriesAtPartial = entries.slice(0, last.entryCountAtClose);
  const coinsAtPartial = entriesAtPartial.reduce((s, e) => s + e.cost / e.price, 0);
  const effectivePriceAtPartial = coinsAtPartial === 0 ? signal.priceOpen : last.costBasisAtClose / coinsAtPartial;

  const oldCoins = remainingCostBasis / effectivePriceAtPartial;

  // New DCA entries added AFTER last partial
  const newEntries = entries.slice(last.entryCountAtClose);
  const newCoins = newEntries.reduce((s, e) => s + e.cost / e.price, 0);
  const newCost = newEntries.reduce((s, e) => s + e.cost, 0);

  const totalCoins = oldCoins + newCoins;
  if (totalCoins === 0) return effectivePriceAtPartial;

  return (remainingCostBasis + newCost) / totalCoins;
};

/**
 * Cost-weighted harmonic mean: Σcost / Σ(cost/price)
 * Equivalent to standard harmonic mean when all costs are equal.
 */
const weightedHarmonicMean = (entries: Array<{ price: number; cost: number }>): number => {
  const totalCost = entries.reduce((s, e) => s + e.cost, 0);
  const totalCoins = entries.reduce((s, e) => s + e.cost / e.price, 0);
  if (totalCoins === 0) return 0;
  return totalCost / totalCoins;
};

export default getEffectivePriceOpen;
