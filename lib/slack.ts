import { WebClient } from "@slack/web-api";
import crypto from "crypto";

export const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export function verifySlackSignature(
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  if (!signature || !timestamp || !process.env.SLACK_SIGNING_SECRET) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  // 5分以上前のリクエストはリプレイアタック対策で拒否
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", process.env.SLACK_SIGNING_SECRET!)
    .update(baseString)
    .digest("hex");

  const expected = Buffer.from(`v0=${hmac}`, "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}
