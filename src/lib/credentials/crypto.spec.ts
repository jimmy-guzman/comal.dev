import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./crypto";

const tamperLastByte = (blob: string): string => {
  const buffer = Buffer.from(blob, "base64");
  const lastIndex = buffer.length - 1;
  const lastByte = buffer.at(-1) ?? 0;

  buffer[lastIndex] = lastByte ^ 0x01;

  return buffer.toString("base64");
};

describe("crypto", () => {
  it("should round-trip a plaintext through encrypt and decrypt", () => {
    const plaintext = "sk-or-1234567890abcdef";
    const encrypted = encryptSecret(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("should produce a different ciphertext for each call (random iv)", () => {
    const plaintext = "same-input";

    expect(encryptSecret(plaintext)).not.toBe(encryptSecret(plaintext));
  });

  it("should reject tampered ciphertext via the gcm auth tag", () => {
    const tamperedBlob = tamperLastByte(encryptSecret("secret-value"));
    const decryptTampered = () => decryptSecret(tamperedBlob);

    expect(decryptTampered).toThrow(/.+/);
  });

  it("should handle unicode plaintext", () => {
    const plaintext = "café-™-🔑";

    expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext);
  });
});
