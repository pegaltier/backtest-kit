import { test } from "worker-testbed";
import { setColumns, getColumns, getDefaultColumns } from "../../build/index.mjs";

test("ColumnValidationService: valid default columns pass", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    pass("Default columns validation passed");
  } catch (error) {
    fail(`Default columns validation failed: ${error.message}`);
  }
});

test("getColumns: returns a copy of current configuration", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  const columns1 = getColumns();
  const columns2 = getColumns();

  if (columns1 !== columns2 && JSON.stringify(columns1) === JSON.stringify(columns2)) {
    pass("getColumns returns independent copies");
  } else {
    fail("getColumns should return different object references");
  }
});

test("getDefaultColumns: returns immutable default configuration", async ({ pass, fail }) => {
  const defaultColumns = getDefaultColumns();

  if (Object.isFrozen(defaultColumns)) {
    pass("getDefaultColumns returns frozen object");
  } else {
    fail("getDefaultColumns should return immutable object");
  }
});

test("getDefaultColumns: contains all expected column collections", async ({ pass, fail }) => {
  const defaultColumns = getDefaultColumns();
  const expectedKeys = [
    "backtest_columns",
    "heat_columns",
    "live_columns",
    "partial_columns",
    "performance_columns",
    "risk_columns",
    "schedule_columns",
    "walker_pnl_columns",
    "walker_strategy_columns",
  ];

  const hasAllKeys = expectedKeys.every((key) => key in defaultColumns);

  if (hasAllKeys) {
    pass("getDefaultColumns contains all expected collections");
  } else {
    fail(`Missing expected columns: ${expectedKeys.filter((k) => !(k in defaultColumns)).join(", ")}`);
  }
});

test("ColumnValidationService: missing key field fails", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            // key is missing
            label: "Test",
            format: (data) => "test",
            isVisible: () => true,
          },
        ],
      },
      false
    );
    fail("Should have thrown error for missing key field");
  } catch (error) {
    if (error.message.includes('Missing required field "key"')) {
      pass("Correctly rejected missing key field");
    } else {
      fail(`Wrong error message: ${error.message}`);
    }
  }
});

test("ColumnValidationService: missing label field fails", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "test",
            // label is missing
            format: (data) => "test",
            isVisible: () => true,
          },
        ],
      },
      false
    );
    fail("Should have thrown error for missing label field");
  } catch (error) {
    if (error.message.includes('Missing required field "label"')) {
      pass("Correctly rejected missing label field");
    } else {
      fail(`Wrong error message: ${error.message}`);
    }
  }
});

test("ColumnValidationService: missing format field fails", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "test",
            label: "Test",
            // format is missing
            isVisible: () => true,
          },
        ],
      },
      false
    );
    fail("Should have thrown error for missing format field");
  } catch (error) {
    if (error.message.includes('Missing required field "format"')) {
      pass("Correctly rejected missing format field");
    } else {
      fail(`Wrong error message: ${error.message}`);
    }
  }
});

test("ColumnValidationService: missing isVisible field fails", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "test",
            label: "Test",
            format: (data) => "test",
            // isVisible is missing
          },
        ],
      },
      false
    );
    fail("Should have thrown error for missing isVisible field");
  } catch (error) {
    if (error.message.includes('Missing required field "isVisible"')) {
      pass("Correctly rejected missing isVisible field");
    } else {
      fail(`Wrong error message: ${error.message}`);
    }
  }
});

test("ColumnValidationService: empty key string fails", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "",
            label: "Test",
            format: (data) => "test",
            isVisible: () => true,
          },
        ],
      },
      false
    );
    fail("Should have thrown error for empty key");
  } catch (error) {
    if (error.message.includes("key must be a non-empty string")) {
      pass("Correctly rejected empty key");
    } else {
      fail(`Wrong error message: ${error.message}`);
    }
  }
});

test("ColumnValidationService: empty label string fails", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "test",
            label: "",
            format: (data) => "test",
            isVisible: () => true,
          },
        ],
      },
      false
    );
    fail("Should have thrown error for empty label");
  } catch (error) {
    if (error.message.includes("label must be a non-empty string")) {
      pass("Correctly rejected empty label");
    } else {
      fail(`Wrong error message: ${error.message}`);
    }
  }
});

test("ColumnValidationService: format not a function fails", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "test",
            label: "Test",
            format: "not a function",
            isVisible: () => true,
          },
        ],
      },
      false
    );
    fail("Should have thrown error for format not being a function");
  } catch (error) {
    if (error.message.includes("format must be a function")) {
      pass("Correctly rejected format as non-function");
    } else {
      fail(`Wrong error message: ${error.message}`);
    }
  }
});

test("ColumnValidationService: isVisible not a function fails", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "test",
            label: "Test",
            format: (data) => "test",
            isVisible: true,
          },
        ],
      },
      false
    );
    fail("Should have thrown error for isVisible not being a function");
  } catch (error) {
    if (error.message.includes("isVisible must be a function")) {
      pass("Correctly rejected isVisible as non-function");
    } else {
      fail(`Wrong error message: ${error.message}`);
    }
  }
});

test("ColumnValidationService: duplicate key in same collection fails", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "duplicate",
            label: "First",
            format: (data) => "test1",
            isVisible: () => true,
          },
          {
            key: "duplicate",
            label: "Second",
            format: (data) => "test2",
            isVisible: () => true,
          },
        ],
      },
      false
    );
    fail("Should have thrown error for duplicate key");
  } catch (error) {
    if (error.message.includes('Duplicate key "duplicate"')) {
      pass("Correctly rejected duplicate key");
    } else {
      fail(`Wrong error message: ${error.message}`);
    }
  }
});

test("ColumnValidationService: valid custom column passes", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "customSignal",
            label: "Custom Signal",
            format: (data) => `Signal: ${data.signal.id}`,
            isVisible: () => true,
          },
        ],
      },
      false
    );
    pass("Valid custom column accepted");
  } catch (error) {
    fail(`Should have accepted valid custom column: ${error.message}`);
  }
});

test("setColumns: rollback on validation error", async ({ pass, fail }) => {
  const originalColumns = getColumns();
  setColumns(originalColumns, true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "test",
            label: "Test",
            format: "not a function",
            isVisible: () => true,
          },
        ],
      },
      false
    );
    fail("Should have thrown validation error");
  } catch (error) {
    const columnsAfterError = getColumns();
    if (
      JSON.stringify(columnsAfterError) === JSON.stringify(originalColumns)
    ) {
      pass("Columns rolled back after validation error");
    } else {
      fail("Columns should have been rolled back after error");
    }
  }
});

test("setColumns: accepts partial configuration updates", async ({ pass, fail }) => {
  const defaultColumns = getDefaultColumns();
  setColumns(defaultColumns, true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "newCustom",
            label: "New Custom",
            format: (data) => "custom",
            isVisible: () => false,
          },
        ],
      },
      false
    );

    const current = getColumns();
    if (current.backtest_columns && current.backtest_columns[0].key === "newCustom") {
      pass("Partial configuration update accepted");
    } else {
      fail("Partial update did not apply correctly");
    }
  } catch (error) {
    fail(`Should have accepted partial update: ${error.message}`);
  }
});

test("ColumnValidationService: key type is not string fails", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: 123,
            label: "Test",
            format: (data) => "test",
            isVisible: () => true,
          },
        ],
      },
      false
    );
    fail("Should have thrown error for non-string key");
  } catch (error) {
    if (error.message.includes("key must be a non-empty string")) {
      pass("Correctly rejected non-string key");
    } else {
      fail(`Wrong error message: ${error.message}`);
    }
  }
});

test("ColumnValidationService: label type is not string fails", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "test",
            label: 456,
            format: (data) => "test",
            isVisible: () => true,
          },
        ],
      },
      false
    );
    fail("Should have thrown error for non-string label");
  } catch (error) {
    if (error.message.includes("label must be a non-empty string")) {
      pass("Correctly rejected non-string label");
    } else {
      fail(`Wrong error message: ${error.message}`);
    }
  }
});

test("ColumnValidationService: multiple errors are aggregated", async ({ pass, fail }) => {
  setColumns(getDefaultColumns(), true);

  try {
    setColumns(
      {
        backtest_columns: [
          {
            key: "",
            label: "",
            format: "invalid",
            isVisible: "invalid",
          },
        ],
      },
      false
    );
    fail("Should have thrown error for multiple invalid fields");
  } catch (error) {
    const errorCount = (error.message.match(/\d+\./g) || []).length;
    if (errorCount >= 4) {
      pass(`Correctly aggregated ${errorCount} column validation errors`);
    } else {
      fail(`Should have aggregated multiple errors, got: ${error.message}`);
    }
  }
});

