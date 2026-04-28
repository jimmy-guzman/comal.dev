import type { LookupAddress, LookupOptions } from "node:dns";

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import { Agent } from "undici";

const blockedV4 = new BlockList();

blockedV4.addSubnet("0.0.0.0", 8, "ipv4");
blockedV4.addSubnet("10.0.0.0", 8, "ipv4");
blockedV4.addSubnet("100.64.0.0", 10, "ipv4");
blockedV4.addSubnet("127.0.0.0", 8, "ipv4");
blockedV4.addSubnet("169.254.0.0", 16, "ipv4");
blockedV4.addSubnet("172.16.0.0", 12, "ipv4");
blockedV4.addSubnet("192.0.0.0", 24, "ipv4");
blockedV4.addSubnet("192.168.0.0", 16, "ipv4");
blockedV4.addSubnet("198.18.0.0", 15, "ipv4");
blockedV4.addSubnet("224.0.0.0", 4, "ipv4");
blockedV4.addSubnet("240.0.0.0", 4, "ipv4");

const blockedV6 = new BlockList();

blockedV6.addAddress("::1", "ipv6");
blockedV6.addAddress("::", "ipv6");
blockedV6.addSubnet("fc00::", 7, "ipv6");
blockedV6.addSubnet("fe80::", 10, "ipv6");
blockedV6.addSubnet("::ffff:0:0", 96, "ipv6");

const isBlockedIp = (address: string) => {
  const family = isIP(address);

  if (family === 4) return blockedV4.check(address, "ipv4");

  if (family === 6) return blockedV6.check(address, "ipv6") || blockedV4.check(address, "ipv6");

  return true;
};

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  addressOrAddresses: LookupAddress[] | string,
  family?: number,
) => void;

const safeLookup = (
  hostname: string,
  options: LookupOptions,
  callback: LookupCallback,
): void => {
  const family = options.family === 4 || options.family === 6 ? options.family : 0;

  lookup(hostname, { all: true, family, verbatim: true })
    .then((records) => {
      const allowed = records.filter(({ address }) => !isBlockedIp(address));

      if (allowed.length === 0) {
        callback(new Error("URL resolves to a blocked address"), "");

        return;
      }

      if (options.all) {
        callback(null, allowed);

        return;
      }

      const [first] = allowed;

      callback(null, first.address, first.family);
    })
    .catch((error: unknown) => {
      callback(error as NodeJS.ErrnoException, "");
    });
};

const safeDispatcher = new Agent({ connect: { lookup: safeLookup } });

export const getSafeDispatcher = () => {
  return safeDispatcher;
};

export const assertSafeUrl = (target: string) => {
  let parsed: URL;

  try {
    parsed = new URL(target);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must start with http:// or https://");
  }

  const { hostname } = parsed;

  if (isIP(hostname) && isBlockedIp(hostname)) {
    throw new Error("URL resolves to a blocked address");
  }

  return parsed;
};
