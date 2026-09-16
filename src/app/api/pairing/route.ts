import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { lanAddress } from "@/lib/network";

export const runtime = "nodejs";

/**
 * What the desktop shows so the phone can join: the address this machine is
 * reachable at on the home network, plus a QR code for it.
 */
export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "";
  const port = Number(host.split(":")[1] ?? process.env.PORT ?? 3000);
  const base = lanAddress(port);

  if (!base) {
    return NextResponse.json({
      url: null,
      qr: null,
      reason:
        "No home-network address found. This machine may be offline, or only " +
        "connected through a VPN.",
    });
  }

  const url = `${base}/capture`;
  const qr = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return NextResponse.json({ url, qr, reason: null });
}
