import type { InternSalarySubmission } from "@/types/intern-salary";
import { redis } from "./redis";
import { encrypt, decrypt } from "./crypto";

function encryptSubmission(s: InternSalarySubmission): InternSalarySubmission {
  return {
    ...s,
    intern_address: encrypt(s.intern_address),
    bank_info: encrypt(s.bank_info),
  };
}

function decryptSubmission(s: InternSalarySubmission): InternSalarySubmission {
  return {
    ...s,
    intern_address: decrypt(s.intern_address),
    bank_info: decrypt(s.bank_info),
  };
}

export async function saveSubmission(
  submission: InternSalarySubmission
): Promise<void> {
  await Promise.all([
    redis.set(`intern:salary:${submission.id}`, encryptSubmission(submission)),
    redis.sadd(`intern:salary:months:${submission.month}`, submission.id),
    redis.sadd(
      `intern:salary:submitted_users:${submission.month}`,
      submission.intern_id
    ),
  ]);
}

export async function getSubmission(
  id: string
): Promise<InternSalarySubmission | null> {
  const s = await redis.get<InternSalarySubmission>(`intern:salary:${id}`);
  if (!s) return null;
  return decryptSubmission(s);
}

export async function getSubmissionsForMonth(
  month: string
): Promise<InternSalarySubmission[]> {
  const ids = await redis.smembers(`intern:salary:months:${month}`);
  if (ids.length === 0) return [];

  const submissions = await Promise.all(
    ids.map((id) => getSubmission(id as string))
  );

  return submissions.filter(
    (s): s is InternSalarySubmission => s !== null
  );
}

export async function getSubmittedUserIds(month: string): Promise<string[]> {
  return redis.smembers(`intern:salary:submitted_users:${month}`);
}

export async function markAsPaid(id: string): Promise<void> {
  const submission = await getSubmission(id);
  if (!submission) return;

  // getSubmission が復号済みのデータを返すため、再暗号化して保存する
  const updated: InternSalarySubmission = {
    ...submission,
    status: "paid",
    paid_at: new Date().toISOString(),
  };

  await redis.set(`intern:salary:${id}`, encryptSubmission(updated));
}
