import { google } from "googleapis";

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error("Google Drive credentials are not configured");
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  return google.drive({ version: "v3", auth });
}

export async function uploadToDrive(
  pdfBuffer: Buffer,
  fileName: string,
  folderId: string
): Promise<string> {
  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "application/pdf",
    },
    media: {
      mimeType: "application/pdf",
      body: Buffer.from(pdfBuffer),
    },
    fields: "id",
  });

  if (!res.data.id) {
    throw new Error("Google Drive upload failed: missing file id");
  }

  return res.data.id;
}
