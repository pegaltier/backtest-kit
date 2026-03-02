import { test } from "worker-testbed";
import { toProfitLossDto, getEffectivePriceOpen } from "../../build/index.mjs";

const EPS = 1e-6;
const approxEqual = (a, b) => Math.abs(a - b) < EPS;

// ---------------------------------------------------------------------------
// getEffectivePriceOpen — no partials (harmonic mean of _entry prices)
// Each DCA entry = fixed $100, so harmonic mean is the correct average price.
// hm([P1..Pn]) = n / Σ(1/Pi)
// ---------------------------------------------------------------------------

test("getEffectivePriceOpen: no _entry → returns priceOpen", ({ pass, fail }) => {
  const result = getEffectivePriceOpen({ priceOpen: 100 });
  if (result !== 100) { fail(`Expected 100, got ${result}`); return; }
  pass("ok");
});

test("getEffectivePriceOpen: empty _entry → returns priceOpen", ({ pass, fail }) => {
  const result = getEffectivePriceOpen({ priceOpen: 100, _entry: [] });
  if (result !== 100) { fail(`Expected 100, got ${result}`); return; }
  pass("ok");
});

test("getEffectivePriceOpen: single entry → returns that price", ({ pass, fail }) => {
  // hm([100]) = 100
  const result = getEffectivePriceOpen({ priceOpen: 100, _entry: [{ price: 100 }] });
  if (!approxEqual(result, 100)) { fail(`Expected 100, got ${result}`); return; }
  pass("ok");
});

test("getEffectivePriceOpen: two entries → harmonic mean", ({ pass, fail }) => {
  // $100@100 + $100@80 = 2.25 BTC for $200 → avg = 200/2.25 = 88.888...
  // hm([100,80]) = 2/(1/100+1/80) = 88.888...
  const result = getEffectivePriceOpen({ priceOpen: 100, _entry: [{ price: 100 }, { price: 80 }] });
  if (!approxEqual(result, 88.888888889)) { fail(`Expected 88.888888889, got ${result}`); return; }
  pass(`hm([100,80]) = ${result.toFixed(9)}`);
});

test("getEffectivePriceOpen: three entries → harmonic mean", ({ pass, fail }) => {
  // hm([100,80,70]) = 3/(1/100+1/80+1/70) = 81.553398058
  const result = getEffectivePriceOpen({ priceOpen: 100, _entry: [{ price: 100 }, { price: 80 }, { price: 70 }] });
  if (!approxEqual(result, 81.553398058)) { fail(`Expected 81.553398058, got ${result}`); return; }
  pass(`hm([100,80,70]) = ${result.toFixed(9)}`);
});

// ---------------------------------------------------------------------------
// getEffectivePriceOpen — with partial + new DCA after it
// Formula: (oldCoins * effectivePrice + newEntries.length * 100) / (oldCoins + newCoins)
//   oldCoins = remainingPercent * entryCountAtClose * 100 / effectivePrice
//   newCoins = Σ 100/price for each new entry
// ---------------------------------------------------------------------------

test("getEffectivePriceOpen: partial exit then DCA — correct weighted price", ({ pass, fail }) => {
  // entry[100], partial 30% @ 120 (eff=100, cnt=1), DCA @ 80
  // oldCoins = 0.7 * 1 * 100 / 100 = 0.7
  // newCoins = 100/80 = 1.25
  // cost = 0.7*100 + 100 = 170
  // result = 170 / 1.95 = 87.179487179
  const signal = {
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 80 }],
    _partial: [{ type: "profit", percent: 30, price: 120, effectivePrice: 100, entryCountAtClose: 1 }],
  };
  const result = getEffectivePriceOpen(signal);
  if (!approxEqual(result, 87.179487179)) { fail(`Expected 87.179487179, got ${result}`); return; }
  pass(`remEff = ${result.toFixed(9)}`);
});

test("getEffectivePriceOpen: no new DCA after partial → effective price unchanged", ({ pass, fail }) => {
  // entry[100,80], partial 50% (eff=hm[100,80]=88.888, cnt=2), no new entries
  // oldCoins = 0.5 * 2 * 100 / 88.888 = 1.125
  // newCoins = 0 → result = 1.125*88.888 / 1.125 = 88.888 (unchanged)
  const eff = 2 / (1/100 + 1/80); // 88.888...
  const signal = {
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 80 }],
    _partial: [{ type: "profit", percent: 50, price: 110, effectivePrice: eff, entryCountAtClose: 2 }],
  };
  const result = getEffectivePriceOpen(signal);
  if (!approxEqual(result, eff)) { fail(`Expected ${eff.toFixed(9)}, got ${result}`); return; }
  pass(`same eff after partial with no new DCA: ${result.toFixed(9)}`);
});

test("getEffectivePriceOpen: 100% closed → returns lastPartial.effectivePrice", ({ pass, fail }) => {
  // totalCoins = 0 → returns effectivePrice from last partial
  const signal = {
    priceOpen: 100,
    _entry: [{ price: 100 }],
    _partial: [{ type: "profit", percent: 100, price: 120, effectivePrice: 100, entryCountAtClose: 1 }],
  };
  const result = getEffectivePriceOpen(signal);
  if (!approxEqual(result, 100)) { fail(`Expected 100, got ${result}`); return; }
  pass("ok");
});

// ---------------------------------------------------------------------------
// toProfitLossDto — baseline (no partials, no DCA)
// ---------------------------------------------------------------------------

test("toProfitLossDto: LONG no partials, close@110", ({ pass, fail }) => {
  // open=100 (priceOpen, no _entry)
  // pnl = 9.570439560
  const { pnlPercentage, priceOpen, priceClose } = toProfitLossDto({ position: "long", priceOpen: 100 }, 110);
  if (!approxEqual(pnlPercentage, 9.570439560)) { fail(`Expected 9.570439560, got ${pnlPercentage}`); return; }
  if (priceOpen !== 100 || priceClose !== 110) { fail("wrong priceOpen/priceClose"); return; }
  pass(`pnl = ${pnlPercentage.toFixed(9)}%`);
});

test("toProfitLossDto: SHORT no partials, close@90", ({ pass, fail }) => {
  // pnl = 9.629639640
  const { pnlPercentage } = toProfitLossDto({ position: "short", priceOpen: 100 }, 90);
  if (!approxEqual(pnlPercentage, 9.629639640)) { fail(`Expected 9.629639640, got ${pnlPercentage}`); return; }
  pass(`pnl = ${pnlPercentage.toFixed(9)}%`);
});

test("toProfitLossDto: LONG with DCA[100,80], no partials, close@100", ({ pass, fail }) => {
  // eff = hm([100,80]) = 88.888, pnl = 12.062949550
  const signal = { position: "long", priceOpen: 100, _entry: [{ price: 100 }, { price: 80 }] };
  const { pnlPercentage } = toProfitLossDto(signal, 100);
  if (!approxEqual(pnlPercentage, 12.062949550)) { fail(`Expected 12.062949550, got ${pnlPercentage}`); return; }
  pass(`pnl = ${pnlPercentage.toFixed(9)}% (eff=hm[100,80]=88.888)`);
});

// ---------------------------------------------------------------------------
// toProfitLossDto — weight formula verification
//
// Weight = (partial.percent / 100) * (partial.entryCountAtClose * $100) / totalInvested
// totalInvested = _entry.length * $100
//
// S3 key scenario (from your analysis):
//   $100@100 (cnt=1) → partial 50%@120 → DCA $100@80 → close@90
//   totalInvested = 2*100 = $200
//   partial: dollarValue = 50%*1*100 = $50, weight = 50/200 = 0.25
//   remaining: dollarValue = 200-50 = $150, weight = 150/200 = 0.75
//   rough PNL (no fees): 0.25*20% + 0.75*5% = 5%+3.75% = 8.75%  ✓
// ---------------------------------------------------------------------------

test("toProfitLossDto: S3-key weight=0.25/0.75 after partialExit→DCA (LONG)", ({ pass, fail }) => {
  // entry[100,80], partial 50%@120 (eff=100, cnt=1), close@90
  // remEff = 85.714286, pnl = 8.324184565
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 80 }],
    _partial: [{ type: "profit", percent: 50, price: 120, effectivePrice: 100, entryCountAtClose: 1 }],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 90);
  if (!approxEqual(pnlPercentage, 8.324184565)) { fail(`Expected 8.324184565, got ${pnlPercentage}`); return; }
  pass(`pnl = ${pnlPercentage.toFixed(9)}% (weights 0.25/0.75 verified)`);
});

// ---------------------------------------------------------------------------
// Scenario 1: averageBuy → partialProfit (LONG)
//   entry[100,80], partial 50%@110 (eff=hm[100,80]=88.888, cnt=2), close@120
//   weights: dollarValue=50%*2*100=100, totalInvested=200, weight=0.5/0.5
//   pnl = 28.887391983
// ---------------------------------------------------------------------------

test("toProfitLossDto: S1 averageBuy→partialProfit (LONG)", ({ pass, fail }) => {
  const snap = 2 / (1/100 + 1/80); // hm([100,80]) = 88.888...
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 80 }],
    _partial: [{ type: "profit", percent: 50, price: 110, effectivePrice: snap, entryCountAtClose: 2 }],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 120);
  if (!approxEqual(pnlPercentage, 28.887391983)) { fail(`Expected 28.887391983, got ${pnlPercentage}`); return; }
  pass(`S1 pnl = ${pnlPercentage.toFixed(9)}%`);
});

// ---------------------------------------------------------------------------
// Scenario 2: averageBuy → partialLoss (LONG)
//   entry[100,80], partial 30%@75 (eff=hm[100,80]=88.888, cnt=2), close@100
//   weight = 30%*2*100/200 = 0.3, remaining = 0.7
//   pnl = 3.650728334
// ---------------------------------------------------------------------------

test("toProfitLossDto: S2 averageBuy→partialLoss (LONG)", ({ pass, fail }) => {
  const snap = 2 / (1/100 + 1/80);
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 80 }],
    _partial: [{ type: "loss", percent: 30, price: 75, effectivePrice: snap, entryCountAtClose: 2 }],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 100);
  if (!approxEqual(pnlPercentage, 3.650728334)) { fail(`Expected 3.650728334, got ${pnlPercentage}`); return; }
  pass(`S2 pnl = ${pnlPercentage.toFixed(9)}%`);
});

// ---------------------------------------------------------------------------
// Scenario 3: partialProfit → averageBuy (LONG)
//   entry[100,80], partial 30%@120 (eff=100, cnt=1), close@105
//   weight = 30%*1*100/200 = 0.15, remaining = 0.85
//   remEff = 87.179487179 (87 cents cheaper than 100 due to DCA@80)
//   pnl = 19.914356019
// ---------------------------------------------------------------------------

test("toProfitLossDto: S3 partialProfit→averageBuy (LONG)", ({ pass, fail }) => {
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 80 }],
    _partial: [{ type: "profit", percent: 30, price: 120, effectivePrice: 100, entryCountAtClose: 1 }],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 105);
  if (!approxEqual(pnlPercentage, 19.914356019)) { fail(`Expected 19.914356019, got ${pnlPercentage}`); return; }
  pass(`S3 pnl = ${pnlPercentage.toFixed(9)}%`);
});

// ---------------------------------------------------------------------------
// Scenario 4: partialLoss → averageBuy (LONG)
//   entry[100,60], partial 30%@80 (eff=100, cnt=1), close@90
//   weight = 30%*1*100/200 = 0.15, remaining = 0.85
//   remEff = 71.830986 (DCA@60 aggressive)
//   pnl = 18.044973526
// ---------------------------------------------------------------------------

test("toProfitLossDto: S4 partialLoss→averageBuy (LONG)", ({ pass, fail }) => {
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 60 }],
    _partial: [{ type: "loss", percent: 30, price: 80, effectivePrice: 100, entryCountAtClose: 1 }],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 90);
  if (!approxEqual(pnlPercentage, 18.044973526)) { fail(`Expected 18.044973526, got ${pnlPercentage}`); return; }
  pass(`S4 pnl = ${pnlPercentage.toFixed(9)}%`);
});

// ---------------------------------------------------------------------------
// Interleaved sequences
// ---------------------------------------------------------------------------

// S5: partial(25%@115,eff=100,cnt=1) → DCA@80 → partial(25%@112,eff=hm[100,80],cnt=2)
//     → DCA@70 → close(50%@105)
//   totalInvested = 3*100 = 300
//   weight1 = 25%*1*100/300 = 0.0833
//   weight2 = 25%*2*100/300 = 0.1667
//   remDollar = 300 - 25 - 50 = 225, remWeight = 0.75
//   pnl = 30.637341705
test("toProfitLossDto: S5 partial→DCA→partial→DCA→close (LONG)", ({ pass, fail }) => {
  const snap1 = 100;
  const snap2 = 2 / (1/100 + 1/80); // hm([100,80]) = 88.888...
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 80 }, { price: 70 }],
    _partial: [
      { type: "profit", percent: 25, price: 115, effectivePrice: snap1, entryCountAtClose: 1 },
      { type: "profit", percent: 25, price: 112, effectivePrice: snap2, entryCountAtClose: 2 },
    ],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 105);
  if (!approxEqual(pnlPercentage, 30.637341705)) { fail(`Expected 30.637341705, got ${pnlPercentage}`); return; }
  pass(`S5 pnl = ${pnlPercentage.toFixed(9)}%`);
});

// S6: DCA@85 → partial(30%@110, eff=hm[100,85], cnt=2) → DCA@75
//     → partial(20%@88, eff=hm[100,85,75], cnt=3) → close(50%@95)
//   totalInvested = 3*100 = 300
//   weight1 = 30%*2*100/300 = 0.2, weight2 = 20%*3*100/300 = 0.2
//   remWeight = 0.6
//   pnl = 10.785090180
test("toProfitLossDto: S6 DCA→partial→DCA→partial→close (LONG)", ({ pass, fail }) => {
  const snap1 = 2 / (1/100 + 1/85); // hm([100,85]) = 91.891892
  const snap2 = 3 / (1/100 + 1/85 + 1/75); // hm([100,85,75]) = 85.474860
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 85 }, { price: 75 }],
    _partial: [
      { type: "profit", percent: 30, price: 110, effectivePrice: snap1, entryCountAtClose: 2 },
      { type: "loss",   percent: 20, price: 88,  effectivePrice: snap2, entryCountAtClose: 3 },
    ],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 95);
  if (!approxEqual(pnlPercentage, 10.785090180)) { fail(`Expected 10.785090180, got ${pnlPercentage}`); return; }
  pass(`S6 pnl = ${pnlPercentage.toFixed(9)}%`);
});

// S7: partial(20%@85, eff=100, cnt=1) → DCA@70 → DCA@60
//     → partial(30%@95, eff=hm[100,70,60], cnt=3) → close(50%@80)
//   totalInvested = 3*100 = 300
//   weight1 = 20%*1*100/300 = 0.0667, weight2 = 30%*3*100/300 = 0.3
//   remWeight = 0.6333
//   pnl = 13.294697874
test("toProfitLossDto: S7 partial→DCA→DCA→partial→close (LONG)", ({ pass, fail }) => {
  const snap2 = 3 / (1/100 + 1/70 + 1/60); // hm([100,70,60]) = 73.255814
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 70 }, { price: 60 }],
    _partial: [
      { type: "loss",   percent: 20, price: 85, effectivePrice: 100,   entryCountAtClose: 1 },
      { type: "profit", percent: 30, price: 95, effectivePrice: snap2, entryCountAtClose: 3 },
    ],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 80);
  if (!approxEqual(pnlPercentage, 13.294697874)) { fail(`Expected 13.294697874, got ${pnlPercentage}`); return; }
  pass(`S7 pnl = ${pnlPercentage.toFixed(9)}%`);
});

// S8: DCA@80 → partial(40%@100, eff=hm[100,80], cnt=2) → DCA@70
//     → partial(30%@110, eff=getEff(entries,[p1]), cnt=3) → close(30%@95)
//   totalInvested = 3*100 = 300
//   snap2 = getEffPriceOpen([100,80,70], [{eff=hm[100,80],cnt=2,pct=40}])
//         = (oldCoins=0.6*2*100/88.888=1.35, newCoins=100/70=1.4286,
//            cost=1.35*88.888+100=220) / 2.7786 = 79.177378
//   weight1 = 40%*2*100/300 = 0.2667, weight2 = 30%*3*100/300 = 0.3
//   remWeight = 0.4333
//   pnl = 23.201016378
test("toProfitLossDto: S8 DCA→partial→DCA→partial→close each snap distinct (LONG)", ({ pass, fail }) => {
  const snap1 = 2 / (1/100 + 1/80); // hm([100,80]) = 88.888...
  // snap2 = getEffectivePriceOpen at moment of 2nd partial (after DCA@70 added)
  // = (0.6*2*100/snap1 * snap1 + 100) / (0.6*2*100/snap1 + 100/70)
  const oldCoins = 0.6 * 2 * 100 / snap1;
  const snap2 = (oldCoins * snap1 + 100) / (oldCoins + 100/70); // 79.177378
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 80 }, { price: 70 }],
    _partial: [
      { type: "profit", percent: 40, price: 100, effectivePrice: snap1, entryCountAtClose: 2 },
      { type: "profit", percent: 30, price: 110, effectivePrice: snap2, entryCountAtClose: 3 },
    ],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 95);
  if (!approxEqual(pnlPercentage, 23.201016378)) { fail(`Expected 23.201016378, got ${pnlPercentage}`); return; }
  pass(`S8 pnl = ${pnlPercentage.toFixed(9)}%`);
});

// S9: partial(20%@120, eff=100, cnt=1) → partial(20%@90, eff=100, cnt=1) → DCA@70 → close(60%@95)
//   totalInvested = 2*100 = 200
//   weight1 = 20%*1*100/200 = 0.1, weight2 = 20%*1*100/200 = 0.1
//   remDollar = 200-20-20 = 160, remWeight = 0.8
//   remEff = getEff([100,70],[{eff=100,cnt=1,pct=20},{eff=100,cnt=1,pct=20}])
//          = (0.6*1*100/100=0.6 oldCoins, 100/70=1.4286 newCoins,
//             cost=0.6*100+100=160) / 2.0286 = 78.873239
//   pnl = 16.905540388
test("toProfitLossDto: S9 partial→partial→DCA→close (LONG)", ({ pass, fail }) => {
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 70 }],
    _partial: [
      { type: "profit", percent: 20, price: 120, effectivePrice: 100, entryCountAtClose: 1 },
      { type: "loss",   percent: 20, price: 90,  effectivePrice: 100, entryCountAtClose: 1 },
    ],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 95);
  if (!approxEqual(pnlPercentage, 16.905540388)) { fail(`Expected 16.905540388, got ${pnlPercentage}`); return; }
  pass(`S9 pnl = ${pnlPercentage.toFixed(9)}%`);
});

// ---------------------------------------------------------------------------
// SHORT scenarios
// ---------------------------------------------------------------------------

// S10 SHORT: DCA@110 → partial(30%@90, eff=hm[100,110], cnt=2) → DCA@120
//            → partial(30%@85, eff=snap2, cnt=3) → close(40%@88)
//   snap1 = hm([100,110]) = 104.761905
//   snap2 = getEff([100,110,120],[{eff=snap1,cnt=2,pct=30}]) = 110.614525
//   totalInvested = 3*100 = 300
//   weight1 = 30%*2*100/300 = 0.2, weight2 = 30%*3*100/300 = 0.3
//   remWeight = 0.5
//   pnl = 19.647015488
test("toProfitLossDto: S10 SHORT DCA→partial→DCA→partial→close", ({ pass, fail }) => {
  const snap1 = 2 / (1/100 + 1/110); // hm([100,110]) = 104.761905
  // snap2 = getEff at moment of 2nd partial
  const oldC = 0.7 * 2 * 100 / snap1;
  const snap2 = (oldC * snap1 + 100) / (oldC + 100/120); // 110.614525
  const signal = {
    position: "short",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 110 }, { price: 120 }],
    _partial: [
      { type: "profit", percent: 30, price: 90, effectivePrice: snap1, entryCountAtClose: 2 },
      { type: "profit", percent: 30, price: 85, effectivePrice: snap2, entryCountAtClose: 3 },
    ],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 88);
  if (!approxEqual(pnlPercentage, 19.647015488)) { fail(`Expected 19.647015488, got ${pnlPercentage}`); return; }
  pass(`S10 SHORT pnl = ${pnlPercentage.toFixed(9)}%`);
});

// S11 SHORT: partialLoss(25%@105, eff=100, cnt=1) → DCA@115
//            → partial(25%@88, eff=snap2, cnt=2) → close(50%@92)
//   snap2 = getEff([100,115],[{eff=100,cnt=1,pct=25}])
//         = (0.75*100/100=0.75 oldCoins, 100/115=0.8696 newCoins,
//            cost=0.75*100+100=175) / 1.6196 = 108.053691
//   totalInvested = 2*100 = 200
//   weight1 = 25%*1*100/200 = 0.125, weight2 = 25%*2*100/200 = 0.25
//   remWeight = 0.625
//   pnl = 12.940020091
test("toProfitLossDto: S11 SHORT partial(loss)→DCA→partial(profit)→close", ({ pass, fail }) => {
  const oldC = 0.75 * 1 * 100 / 100;
  const snap2 = (oldC * 100 + 100) / (oldC + 100/115); // 108.053691
  const signal = {
    position: "short",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 115 }],
    _partial: [
      { type: "loss",   percent: 25, price: 105, effectivePrice: 100,   entryCountAtClose: 1 },
      { type: "profit", percent: 25, price: 88,  effectivePrice: snap2, entryCountAtClose: 2 },
    ],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 92);
  if (!approxEqual(pnlPercentage, 12.940020091)) { fail(`Expected 12.940020091, got ${pnlPercentage}`); return; }
  pass(`S11 SHORT pnl = ${pnlPercentage.toFixed(9)}%`);
});

// S12 SHORT: partial(30%@80, eff=100, cnt=1) → DCA@120 → close(70%@85)
//   totalInvested = 2*100 = 200
//   weight = 30%*1*100/200 = 0.15, remWeight = 0.85
//   remEff = 110.869565
//   pnl = 22.501524358
test("toProfitLossDto: SHORT S3 partialProfit→averageBuy (SHORT)", ({ pass, fail }) => {
  const signal = {
    position: "short",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 120 }],
    _partial: [{ type: "profit", percent: 30, price: 80, effectivePrice: 100, entryCountAtClose: 1 }],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 85);
  if (!approxEqual(pnlPercentage, 22.501524358)) { fail(`Expected 22.501524358, got ${pnlPercentage}`); return; }
  pass(`SHORT S3 pnl = ${pnlPercentage.toFixed(9)}%`);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("toProfitLossDto: 100% closed via two partials (no remaining)", ({ pass, fail }) => {
  // entry[100], partial1 60%@110 (cnt=1) + partial2 40%@115 (cnt=1)
  // dollarValue1=60, dollarValue2=40, totalInvested=100, sum=100 → remWeight=0
  // pnl = 11.564447552
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }],
    _partial: [
      { type: "profit", percent: 60, price: 110, effectivePrice: 100, entryCountAtClose: 1 },
      { type: "profit", percent: 40, price: 115, effectivePrice: 100, entryCountAtClose: 1 },
    ],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 999); // priceClose irrelevant
  if (!approxEqual(pnlPercentage, 11.564447552)) { fail(`Expected 11.564447552, got ${pnlPercentage}`); return; }
  pass(`100% closed pnl = ${pnlPercentage.toFixed(9)}%`);
});

test("toProfitLossDto: throws when partial dollar value exceeds totalInvested", ({ pass, fail }) => {
  // entry[100] = totalInvested=$100
  // partial 70%@110 (cnt=1) + partial 40%@115 (cnt=1) → dollarValue=70+40=110 > 100
  const signal = {
    id: "test",
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }],
    _partial: [
      { type: "profit", percent: 70, price: 110, effectivePrice: 100, entryCountAtClose: 1 },
      { type: "profit", percent: 40, price: 115, effectivePrice: 100, entryCountAtClose: 1 },
    ],
  };
  try {
    toProfitLossDto(signal, 120);
    fail("Expected error but none thrown");
  } catch (e) {
    pass(`throws: ${e.message.slice(0, 60)}`);
  }
});

test("toProfitLossDto: effectivePrice per-partial independent of current _entry", ({ pass, fail }) => {
  // entry[100,40] → getEff would give ~50 if no partial awareness
  // partial 50%@120 (eff=100, cnt=1) correctly uses eff=100, not 50
  // remEff = 50.000000 (0.5*100/100=0.5 oldCoins, 100/40=2.5 newCoins, cost=150, result=50)
  // pnl = 64.405659341
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 40 }],
    _partial: [{ type: "profit", percent: 50, price: 120, effectivePrice: 100, entryCountAtClose: 1 }],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 90);
  if (!approxEqual(pnlPercentage, 64.405659341)) { fail(`Expected 64.405659341, got ${pnlPercentage}`); return; }
  pass(`effectivePrice isolation confirmed, pnl = ${pnlPercentage.toFixed(9)}%`);
});

// S13: 4 partials with 3 DCA rounds, partial positions still open at final close
//   entry[100,80,72,65] = totalInvested = $400
//   partial1: 20%@115 (eff=100,          cnt=1) → dollarValue=20%*1*100=20,  weight=0.05
//   partial2: 20%@108 (eff=hm[100,80],   cnt=2) → dollarValue=20%*2*100=40,  weight=0.10
//   partial3: 20%@83  (eff=snap3,        cnt=3) → dollarValue=20%*3*100=60,  weight=0.15
//   partial4: 20%@100 (eff=snap4,        cnt=4) → dollarValue=20%*4*100=80,  weight=0.20
//   closedDollar=200, remDollar=200, remWeight=0.50
//   pnl (close@100) = 29.395969130
test("toProfitLossDto: S13 four partials three DCA rounds partial close (LONG)", ({ pass, fail }) => {
  const snap1 = 100;
  const snap2 = 2 / (1/100 + 1/80); // 88.888...
  // snap3 = getEff([100,80,72],[p1,p2]) where last=p2: cnt=2, rem=60%, newEntries=[{72}]
  const oldC3 = 0.6 * 2 * 100 / snap2;
  const snap3 = (oldC3 * snap2 + 100) / (oldC3 + 100/72); // 80.324...
  // snap4 = getEff([100,80,72,65],[p1,p2,p3]) where last=p3: cnt=3, rem=40%, newEntries=[{65}]
  const oldC4 = 0.4 * 3 * 100 / snap3;
  const snap4 = (oldC4 * snap3 + 100) / (oldC4 + 100/65); // 72.549...
  const signal = {
    position: "long",
    priceOpen: 100,
    _entry: [{ price: 100 }, { price: 80 }, { price: 72 }, { price: 65 }],
    _partial: [
      { type: "profit", percent: 20, price: 115, effectivePrice: snap1, entryCountAtClose: 1 },
      { type: "profit", percent: 20, price: 108, effectivePrice: snap2, entryCountAtClose: 2 },
      { type: "loss",   percent: 20, price: 83,  effectivePrice: snap3, entryCountAtClose: 3 },
      { type: "profit", percent: 20, price: 100, effectivePrice: snap4, entryCountAtClose: 4 },
    ],
  };
  const { pnlPercentage } = toProfitLossDto(signal, 100);
  if (!approxEqual(pnlPercentage, 29.395969130)) { fail(`Expected 29.395969130, got ${pnlPercentage}`); return; }
  pass(`S13 pnl = ${pnlPercentage.toFixed(9)}% (4 partials, 3 DCA, 50% remaining)`);
});
