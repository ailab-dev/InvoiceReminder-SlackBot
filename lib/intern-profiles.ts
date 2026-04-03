import type { InternProfile } from "@/types/intern-salary";
import { redis } from "./redis";
import { encrypt, decrypt } from "./crypto";

function encryptProfile(profile: InternProfile): InternProfile {
  return {
    ...profile,
    address: encrypt(profile.address),
    phone: encrypt(profile.phone),
    bank_info: encrypt(profile.bank_info),
  };
}

function decryptProfile(profile: InternProfile): InternProfile {
  return {
    ...profile,
    address: decrypt(profile.address),
    phone: decrypt(profile.phone),
    bank_info: decrypt(profile.bank_info),
  };
}

export async function getInternProfile(
  userId: string
): Promise<InternProfile | null> {
  const profile = await redis.get<InternProfile>(`intern:profile:${userId}`);
  if (!profile) return null;
  return decryptProfile(profile);
}

export async function saveInternProfile(profile: InternProfile): Promise<void> {
  await Promise.all([
    redis.set(`intern:profile:${profile.slack_user_id}`, encryptProfile(profile)),
    redis.sadd("intern:known_users", profile.slack_user_id),
  ]);
}

export async function getKnownInternIds(): Promise<string[]> {
  return redis.smembers("intern:known_users");
}
