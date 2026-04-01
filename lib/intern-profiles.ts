import type { InternProfile } from "@/types/intern-salary";

import { redis } from "./redis";

export async function getInternProfile(
  userId: string
): Promise<InternProfile | null> {
  return redis.get<InternProfile>(`intern:profile:${userId}`);
}

export async function saveInternProfile(profile: InternProfile): Promise<void> {
  await Promise.all([
    redis.set(`intern:profile:${profile.slack_user_id}`, profile),
    redis.sadd("intern:known_users", profile.slack_user_id),
  ]);
}

export async function getKnownInternIds(): Promise<string[]> {
  return redis.smembers("intern:known_users");
}
