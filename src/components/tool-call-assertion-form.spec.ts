import { describe, expect, it } from "vitest";

import {
  toFormAssertion,
  toServerAssertion,
  validateAssertionForm,
} from "./tool-call-assertion-form";

describe("toFormAssertion", () => {
  it("should produce an empty form for an undefined assertion", () => {
    expect(toFormAssertion(undefined)).toStrictEqual({
      mustCall: [],
      mustCallWithArgsJson: "",
      mustNotCall: [],
    });
  });

  it("should stringify mustCallWithArgs into the JSON field", () => {
    const form = toFormAssertion({
      mustCallWithArgs: [{ argsMatch: { query: "x" }, tool: "web-search" }],
    });

    expect(JSON.parse(form.mustCallWithArgsJson)).toStrictEqual([
      { argsMatch: { query: "x" }, tool: "web-search" },
    ]);
  });
});

describe("toServerAssertion", () => {
  it("should drop empty fields", () => {
    expect(
      toServerAssertion({ mustCall: ["web-search"], mustCallWithArgsJson: "", mustNotCall: [] }),
    ).toStrictEqual({ mustCall: ["web-search"] });
  });

  it("should parse the JSON field into mustCallWithArgs", () => {
    const server = toServerAssertion({
      mustCall: [],
      mustCallWithArgsJson: '[{ "tool": "web-search", "argsMatch": { "q": 1 } }]',
      mustNotCall: [],
    });

    expect(server.mustCallWithArgs).toStrictEqual([{ argsMatch: { q: 1 }, tool: "web-search" }]);
  });
});

describe("validateAssertionForm", () => {
  it("should return no issues for a valid form", () => {
    expect(
      validateAssertionForm({
        mustCall: ["web-search"],
        mustCallWithArgsJson: "",
        mustNotCall: [],
      }),
    ).toStrictEqual([]);
  });

  it("should report invalid JSON in the args field", () => {
    const issues = validateAssertionForm({
      mustCall: [],
      mustCallWithArgsJson: "{not json",
      mustNotCall: [],
    });

    expect(issues.length).toBeGreaterThan(0);
  });

  it("should report a form with no constraints", () => {
    const issues = validateAssertionForm({
      mustCall: [],
      mustCallWithArgsJson: "",
      mustNotCall: [],
    });

    expect(issues.length).toBeGreaterThan(0);
  });
});
