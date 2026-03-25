const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const SHEETS_API = "https://sheets.googleapis.com/v4";

async function googleFetch<T>(token: string, url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message || `Google API error: ${res.status}`);
  }
  return res.json();
}

export async function sendEmail(
  token: string,
  to: string,
  subject: string,
  body: string
): Promise<{ id: string; threadId: string }> {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  const encoded = Buffer.from(message).toString("base64url");

  return googleFetch(token, `${GMAIL_API}/users/me/messages/send`, {
    method: "POST",
    body: JSON.stringify({ raw: encoded }),
  });
}

export async function listSentEmails(token: string, maxResults = 10) {
  const list = await googleFetch<{ messages?: { id: string }[] }>(
    token,
    `${GMAIL_API}/users/me/messages?labelIds=SENT&maxResults=${maxResults}`
  );

  if (!list.messages?.length) return [];

  const detailed = await Promise.all(
    list.messages.map(async (m) => {
      const detail = await googleFetch<{
        id: string;
        snippet: string;
        payload?: { headers: { name: string; value: string }[] };
        internalDate?: string;
      }>(
        token,
        `${GMAIL_API}/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=To`
      );
      const headers = detail.payload?.headers || [];
      return {
        id: detail.id,
        snippet: detail.snippet,
        subject: headers.find((h) => h.name === "Subject")?.value || "(no subject)",
        to: headers.find((h) => h.name === "To")?.value || "",
        date: detail.internalDate ? new Date(parseInt(detail.internalDate)).toISOString() : "",
      };
    })
  );

  return detailed;
}

export async function createSheet(
  token: string,
  title: string,
  headers: string[],
  rows: unknown[][]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  return googleFetch(token, `${SHEETS_API}/spreadsheets`, {
    method: "POST",
    body: JSON.stringify({
      properties: { title },
      sheets: [{
        data: [{
          rowData: [
            { values: headers.map((h) => ({ userEnteredValue: { stringValue: h } })) },
            ...rows.map((row) => ({
              values: row.map((cell) => ({
                userEnteredValue: { stringValue: String(cell ?? "") },
              })),
            })),
          ],
        }],
      }],
    }),
  });
}
