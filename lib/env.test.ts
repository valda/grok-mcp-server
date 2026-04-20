import { describe, expect, it } from "vitest";
import { readEnv, listWhitespaceIssues } from "./env";

function withEnv(name: string, value: string | undefined, fn: () => void) {
  const original = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    fn();
  } finally {
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
}

describe("readEnv", () => {
  it("AUTHORIZE_PASSWORD は前後空白を trim し、警告フラグを立てる", () => {
    withEnv("AUTHORIZE_PASSWORD", "secret\n", () => {
      expect(readEnv("AUTHORIZE_PASSWORD")).toEqual({
        value: "secret",
        hasWhitespace: true,
      });
    });
  });

  it("XAI_API_KEY は前後空白を trim し、警告フラグを立てる", () => {
    withEnv("XAI_API_KEY", "  xai-key  ", () => {
      expect(readEnv("XAI_API_KEY")).toEqual({
        value: "xai-key",
        hasWhitespace: true,
      });
    });
  });

  it("JWT_SECRET は警告だけ出し、署名鍵としての raw 値は保持する", () => {
    withEnv("JWT_SECRET", "jwt-secret\n", () => {
      expect(readEnv("JWT_SECRET")).toEqual({
        value: "jwt-secret\n",
        hasWhitespace: true,
      });
    });
  });

  it("空白混入なしの値は hasWhitespace=false", () => {
    withEnv("AUTHORIZE_PASSWORD", "clean", () => {
      expect(readEnv("AUTHORIZE_PASSWORD")).toEqual({
        value: "clean",
        hasWhitespace: false,
      });
    });
  });

  it("未設定の変数は value=undefined を返す", () => {
    withEnv("AUTHORIZE_PASSWORD", undefined, () => {
      expect(readEnv("AUTHORIZE_PASSWORD")).toEqual({
        value: undefined,
        hasWhitespace: false,
      });
    });
  });
});

describe("listWhitespaceIssues", () => {
  it("前後空白がある変数名のみを返す", () => {
    withEnv("JWT_SECRET", "jwt-secret", () => {
      withEnv("XAI_API_KEY", "xai-key\n", () => {
        withEnv("AUTHORIZE_PASSWORD", "pass", () => {
          expect(listWhitespaceIssues()).toEqual(["XAI_API_KEY"]);
        });
      });
    });
  });
});
