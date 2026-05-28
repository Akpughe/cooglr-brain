import { describe, it, expect } from "vitest";
import { gmailMessagesToDocs } from "../gmail-ingest";

describe("gmailMessagesToDocs", () => {
  it("parses messages from result.data.messages with subject/from/body", () => {
    const result = {
      data: {
        messages: [
          { messageId: "m1", subject: "Q2 Launch", sender: "ana@x.com", messageText: "Ship in June." },
          { id: "m2", subject: "Invoice", from: "billing@y.com", snippet: "Amount due 500." },
        ],
      },
    };
    const docs = gmailMessagesToDocs(result);
    expect(docs).toHaveLength(2);
    expect(docs[0].id).toBe("m1");
    expect(docs[0].subject).toBe("Q2 Launch");
    expect(docs[0].text).toContain("Subject: Q2 Launch");
    expect(docs[0].text).toContain("From: ana@x.com");
    expect(docs[0].text).toContain("Ship in June.");
    expect(docs[1].text).toContain("Amount due 500.");
  });

  it("handles a bare array and skips empty messages", () => {
    const docs = gmailMessagesToDocs([{ id: "a", body: "hello" }, { id: "b" }]);
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe("a");
  });

  it("returns empty for unrecognized shapes", () => {
    expect(gmailMessagesToDocs({ status: "ok" })).toEqual([]);
    expect(gmailMessagesToDocs(null)).toEqual([]);
  });
});
