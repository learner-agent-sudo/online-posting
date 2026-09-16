import os from "node:os";

/**
 * The address the phone should open.
 *
 * Whichever laptop is running the app is the hub, so this is detected at
 * runtime rather than configured — it works the same on a different machine or
 * after the router hands out a new address.
 */
export function lanAddress(port: number): string | null {
  const candidates: string[] = [];

  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      candidates.push(address.address);
    }
  }

  // Home networks hand out 192.168.x.x far more often than the other private
  // ranges, so prefer those when a machine has several interfaces (VPNs and
  // container bridges routinely add more).
  const preferred =
    candidates.find((ip) => ip.startsWith("192.168.")) ??
    candidates.find((ip) => ip.startsWith("10.")) ??
    candidates[0];

  return preferred ? `http://${preferred}:${port}` : null;
}
