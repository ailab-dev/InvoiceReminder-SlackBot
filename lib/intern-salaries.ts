import type {
  InternSalaryPending,
  InternSalarySubmission,
} from "@/types/intern-salary";

import { redis } from "./redis";

export async function saveSubmission(
  submission: InternSalarySubmission
): Promise<void> {
  await Promise.all([
    redis.set(`intern:salary:${submission.id}`, submission),
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
  return redis.get<InternSalarySubmission>(`intern:salary:${id}`);
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
    (submission): submission is InternSalarySubmission => submission !== null
  );
}

export async function getSubmittedUserIds(month: string): Promise<string[]> {
  return redis.smembers(`intern:salary:submitted_users:${month}`);
}

export async function markAsPaid(id: string): Promise<void> {
  const submission = await getSubmission(id);
  if (!submission) return;

  const updated: InternSalarySubmission = {
    ...submission,
    status: "paid",
    paid_at: new Date().toISOString(),
  };

  await redis.set(`intern:salary:${id}`, updated);
}

export async function savePending(
  userId: string,
  pending: InternSalaryPending
): Promise<void> {
  await redis.set(`intern:salary:pending:${userId}`, pending);
}

export async function getPending(
  userId: string
): Promise<InternSalaryPending | null> {
  return redis.get<InternSalaryPending>(`intern:salary:pending:${userId}`);
}

export async function deletePending(userId: string): Promise<void> {
  await redis.del(`intern:salary:pending:${userId}`);
}
