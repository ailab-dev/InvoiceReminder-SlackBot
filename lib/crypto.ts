import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ENCRYPTION_KEY: openssl rand -hex 32 で生成した64文字の16進数文字列
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY is not set");
  return Buffer.from(hex, "hex");
}

// AES-256-GCM で暗号化。形式: "iv_hex:tag_hex:encrypted_hex"
export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(data: string): string {
  const key = getKey();
  const [ivHex, tagHex, encHex] = data.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return (
    decipher.update(Buffer.from(encHex, "hex")).toString("utf8") +
    decipher.final("utf8")
  );
}
