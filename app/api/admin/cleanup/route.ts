import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { google } from "googleapis";
import { Readable } from "stream";

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Google Drive credentials not configured");

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

async function deleteAllDriveFiles(folderId: string): Promise<number> {
  const drive = getDriveClient();
  let deleted = 0;
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = res.data.files ?? [];
    await Promise.all(
      files.map((f) =>
        drive.files.delete({ fileId: f.id!, supportsAllDrives: true })
      )
    );
    deleted += files.length;
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return deleted;
}

async function deleteAllRedisSubmissions(): Promise<number> {
  let deleted = 0;

  // month ごとのセットを全スキャン
  let cursor = 0;
  const monthKeys: string[] = [];
  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: "intern:salary:months:*",
      count: 100,
    });
    cursor = Number(nextCursor);
    monthKeys.push(...(keys as string[]));
  } while (cursor !== 0);

  for (const monthKey of monthKeys) {
    const ids = await redis.smembers(monthKey) as string[];
    for (const id of ids) {
      await redis.del(`intern:salary:${id}`);
      deleted++;
    }
    await redis.del(monthKey);
  }

  // submitted_users セットも削除
  cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: "intern:salary:submitted_users:*",
      count: 100,
    });
    cursor = Number(nextCursor);
    for (const key of keys as string[]) {
      await redis.del(key);
    }
  } while (cursor !== 0);

  return deleted;
}

export async function POST(request: NextRequest) {
  const secret = process.env.CLEANUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLEANUP_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("x-cleanup-secret");
  if (authHeader !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json({ error: "GOOGLE_DRIVE_FOLDER_ID not configured" }, { status: 500 });
  }

  const [driveDeleted, redisDeleted] = await Promise.all([
    deleteAllDriveFiles(folderId),
    deleteAllRedisSubmissions(),
  ]);

  return NextResponse.json({
    ok: true,
    driveFilesDeleted: driveDeleted,
    redisSubmissionsDeleted: redisDeleted,
  });
}
