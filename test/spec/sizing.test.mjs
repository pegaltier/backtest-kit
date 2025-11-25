import { test } from "worker-testbed";

import {
  addSizing,
  PositionSize,
} from "../../build/index.mjs";

test("PositionSize.fixedPercentage calculates position size", async ({ pass, fail }) => {

  addSizing({
    sizingName: "test-fixed-percentage",
    method: "fixed-percentage",
    riskPercentage: 2,
  });

  const quantity = await PositionSize.fixedPercentage(
    "BTCUSDT",
    10000,
    50000,
    49000,
    { sizingName: "test-fixed-percentage" }
  );

  if (typeof quantity === "number" && quantity > 0) {
    pass(`Fixed percentage sizing calculated: ${quantity}`);
    return;
  }

  fail("Fixed percentage sizing did not return valid quantity");

});

test("PositionSize.kellyCriterion calculates position size", async ({ pass, fail }) => {

  addSizing({
    sizingName: "test-kelly",
    method: "kelly-criterion",
    kellyMultiplier: 0.25,
  });

  const quantity = await PositionSize.kellyCriterion(
    "BTCUSDT",
    10000,
    50000,
    0.55,
    1.5,
    { sizingName: "test-kelly" }
  );

  if (typeof quantity === "number" && quantity > 0) {
    pass(`Kelly Criterion sizing calculated: ${quantity}`);
    return;
  }

  fail("Kelly Criterion sizing did not return valid quantity");

});

test("PositionSize.atrBased calculates position size", async ({ pass, fail }) => {

  addSizing({
    sizingName: "test-atr",
    method: "atr-based",
    riskPercentage: 2,
    atrMultiplier: 2,
  });

  const quantity = await PositionSize.atrBased(
    "BTCUSDT",
    10000,
    50000,
    500,
    { sizingName: "test-atr" }
  );

  if (typeof quantity === "number" && quantity > 0) {
    pass(`ATR-based sizing calculated: ${quantity}`);
    return;
  }

  fail("ATR-based sizing did not return valid quantity");

});

test("PositionSize.fixedPercentage throws on method mismatch", async ({ pass, fail }) => {

  addSizing({
    sizingName: "test-mismatch",
    method: "kelly-criterion",
    kellyMultiplier: 0.25,
  });

  try {
    await PositionSize.fixedPercentage(
      "BTCUSDT",
      10000,
      50000,
      49000,
      { sizingName: "test-mismatch" }
    );
    fail("Did not throw error on method mismatch");
  } catch (error) {
    if (error.message.includes("method mismatch")) {
      pass("Correctly threw error on method mismatch");
      return;
    }
    fail(`Unexpected error message: ${error.message}`);
  }

});

test("PositionSize.fixedPercentage throws on missing sizing", async ({ pass, fail }) => {

  try {
    await PositionSize.fixedPercentage(
      "BTCUSDT",
      10000,
      50000,
      49000,
      { sizingName: "nonexistent-sizing" }
    );
    fail("Did not throw error on missing sizing");
  } catch (error) {
    if (error.message.includes("not found")) {
      pass("Correctly threw error on missing sizing");
      return;
    }
    fail(`Unexpected error message: ${error.message}`);
  }

});

test("PositionSize.fixedPercentage respects maxPositionPercentage", async ({ pass, fail }) => {

  addSizing({
    sizingName: "test-max-percentage",
    method: "fixed-percentage",
    riskPercentage: 50, // High risk to trigger max constraint
    maxPositionPercentage: 10, // Max 10% of account
  });

  const quantity = await PositionSize.fixedPercentage(
    "BTCUSDT",
    10000,
    50000,
    49000,
    { sizingName: "test-max-percentage" }
  );

  // Max position = 10% of 10000 = 1000 USDT / 50000 price = 0.02 BTC
  const maxQuantity = (10000 * 0.1) / 50000;

  if (quantity <= maxQuantity) {
    pass(`Position size respects maxPositionPercentage: ${quantity} <= ${maxQuantity}`);
    return;
  }

  fail(`Position size exceeds maxPositionPercentage: ${quantity} > ${maxQuantity}`);

});

test("PositionSize.fixedPercentage respects minPositionSize", async ({ pass, fail }) => {

  addSizing({
    sizingName: "test-min-size",
    method: "fixed-percentage",
    riskPercentage: 0.01, // Very low risk to trigger min constraint
    minPositionSize: 0.001, // Min 0.001 BTC
  });

  const quantity = await PositionSize.fixedPercentage(
    "BTCUSDT",
    10000,
    50000,
    49900, // Very tight stop loss
    { sizingName: "test-min-size" }
  );

  if (quantity >= 0.001) {
    pass(`Position size respects minPositionSize: ${quantity} >= 0.001`);
    return;
  }

  fail(`Position size below minPositionSize: ${quantity} < 0.001`);

});

test("PositionSize.fixedPercentage respects maxPositionSize", async ({ pass, fail }) => {

  addSizing({
    sizingName: "test-max-size",
    method: "fixed-percentage",
    riskPercentage: 50, // High risk to trigger max constraint
    maxPositionSize: 0.01, // Max 0.01 BTC
  });

  const quantity = await PositionSize.fixedPercentage(
    "BTCUSDT",
    10000,
    50000,
    49000,
    { sizingName: "test-max-size" }
  );

  if (quantity <= 0.01) {
    pass(`Position size respects maxPositionSize: ${quantity} <= 0.01`);
    return;
  }

  fail(`Position size exceeds maxPositionSize: ${quantity} > 0.01`);

});

test("PositionSize.kellyCriterion with zero kellyMultiplier", async ({ pass, fail }) => {

  addSizing({
    sizingName: "test-kelly-zero",
    method: "kelly-criterion",
    kellyMultiplier: 0, // Zero multiplier
  });

  const quantity = await PositionSize.kellyCriterion(
    "BTCUSDT",
    10000,
    50000,
    0.55,
    1.5,
    { sizingName: "test-kelly-zero" }
  );

  if (quantity === 0) {
    pass("Kelly Criterion with zero multiplier returns zero");
    return;
  }

  fail(`Kelly Criterion with zero multiplier should return 0, got ${quantity}`);

});

test("addSizing throws on duplicate sizing name", async ({ pass, fail }) => {

  addSizing({
    sizingName: "test-duplicate",
    method: "fixed-percentage",
    riskPercentage: 2,
  });

  try {
    addSizing({
      sizingName: "test-duplicate",
      method: "kelly-criterion",
      kellyMultiplier: 0.25,
    });
    fail("Did not throw error on duplicate sizing name");
  } catch (error) {
    if (error.message.includes("already exist")) {
      pass("Correctly threw error on duplicate sizing name");
      return;
    }
    fail(`Unexpected error message: ${error.message}`);
  }

});

test("PositionSize.fixedPercentage with callback", async ({ pass, fail }) => {

  let callbackCalled = false;
  let callbackQuantity = null;

  addSizing({
    sizingName: "test-callback",
    method: "fixed-percentage",
    riskPercentage: 2,
    callbacks: {
      onCalculate: (quantity, params) => {
        callbackCalled = true;
        callbackQuantity = quantity;
      },
    },
  });

  const quantity = await PositionSize.fixedPercentage(
    "BTCUSDT",
    10000,
    50000,
    49000,
    { sizingName: "test-callback" }
  );

  if (callbackCalled && callbackQuantity === quantity) {
    pass(`Callback was called with correct quantity: ${quantity}`);
    return;
  }

  if (!callbackCalled) {
    fail("Callback was not called");
    return;
  }

  fail(`Callback quantity mismatch: ${callbackQuantity} !== ${quantity}`);

});
