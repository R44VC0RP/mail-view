import { describe, expect, test } from "bun:test";
import { initialEmails, initialLabels } from "./data";
import { matchesView, searchEmails } from "./search";
import type { Email } from "./types";

const now = new Date("2026-08-26T23:59:59.000Z");
const search = (query: string) =>
  searchEmails(initialEmails, query, initialLabels, now);
const ids = (emails: Email[]) => emails.map((email) => email.id);
const get = (id: string) => initialEmails.find((email) => email.id === id)!;

describe("mock mailbox", () => {
  test("starts with exactly 393 inbox threads and 255 unread", () => {
    const inbox = initialEmails.filter((email) => matchesView(email, "inbox"));
    expect(inbox).toHaveLength(393);
    expect(inbox.filter((email) => email.unread)).toHaveLength(255);
    expect(ids(inbox)).toEqual(
      Array.from(
        { length: 393 },
        (_, index) => `inbox-${String(index + 1).padStart(3, "0")}`,
      ),
    );
    expect(search("in:inbox is:unread")).toHaveLength(255);
    expect(search("in:inbox is:read")).toHaveLength(138);
  });

  test("has usable drafts, sent mail, snoozed threads, labels and attachments", () => {
    expect(search("in:drafts")).toHaveLength(3);
    expect(search("in:sent")).toHaveLength(8);
    expect(search("is:snoozed")).toHaveLength(3);
    expect(
      search("is:snoozed").every(
        (email) =>
          email.folder === "archive" &&
          new Date(email.snoozedUntil!).getTime() > now.getTime(),
      ),
    ).toBe(true);
    expect(
      get("inbox-020").attachments.map((attachment) => attachment.type),
    ).toEqual(["document", "pdf"]);
    expect(get("inbox-012").attachments[0]!.type).toBe("calendar");
    expect(get("inbox-008").messages).toHaveLength(4);
    expect(
      new Set(get("inbox-008").messages.map((message) => message.body)).size,
    ).toBe(4);
    expect(
      new Set(get("inbox-008").messages.map((message) => message.date)).size,
    ).toBe(4);
    expect(
      initialEmails
        .filter((email) => email.folder === "inbox")
        .slice(0, 25)
        .some((email) => email.starred),
    ).toBe(false);
    expect(
      initialLabels.filter(
        (label) => label.parentId === "focus" && label.visible,
      ),
    ).toHaveLength(3);
  });

  test("contains distinct dated threads and safe mock addresses", () => {
    expect(new Set(initialEmails.map((email) => email.id)).size).toBe(
      initialEmails.length,
    );
    expect(
      initialEmails.every(
        (email, index) =>
          index === 0 ||
          Date.parse(initialEmails[index - 1]!.date) >= Date.parse(email.date),
      ),
    ).toBe(true);
    expect(
      initialEmails.every((email) =>
        email.messages.every(
          (message) =>
            message.from.email.endsWith("@example.com") &&
            message.to.every((address) =>
              address.email.endsWith("@example.com"),
            ),
        ),
      ),
    ).toBe(true);
  });
});

describe("views", () => {
  test("keeps snoozed and muted messages out of inbox without deleting their labels", () => {
    const inbox = get("inbox-001");
    expect(
      matchesView({ ...inbox, snoozedUntil: "2026-08-31T09:00:00Z" }, "inbox"),
    ).toBe(false);
    expect(matchesView({ ...inbox, muted: true }, "inbox")).toBe(false);
    expect(matchesView(inbox, "label:social")).toBe(true);
    expect(matchesView(inbox, "category:social")).toBe(true);
    expect(matchesView(get("snoozed-001"), "archive")).toBe(true);
    expect(matchesView(get("snoozed-001"), "snoozed")).toBe(true);
  });

  test("all mail and starred exclude spam and trash", () => {
    expect(matchesView(get("spam-001"), "all")).toBe(false);
    expect(matchesView(get("trash-001"), "all")).toBe(false);
    expect(matchesView({ ...get("spam-001"), starred: true }, "starred")).toBe(
      false,
    );
    expect(
      matchesView({ ...get("trash-001"), important: true }, "important"),
    ).toBe(false);
    expect(matchesView(get("spam-001"), "spam")).toBe(true);
    expect(matchesView(get("trash-001"), "trash")).toBe(true);
  });
});

describe("Gmail-style search", () => {
  test("ANDs words across sender, subject, snippets, bodies and label names", () => {
    expect(ids(search("Choir melody Marketing"))).toEqual(["inbox-002"]);
    expect(ids(search("from:odile@example.com layers"))).toEqual([
      "inbox-005",
    ]);
    expect(search("in:inbox Sketchpad breathing").length).toBeGreaterThan(5);
    expect(search("Choir impossibleword")).toHaveLength(0);
  });

  test("supports quoted phrases and sender and recipient operators", () => {
    expect(ids(search('from:"Odile from Inkwell Sketch"'))).toEqual(["inbox-005"]);
    expect(
      ids(
        search(
          'subject:"Sourdough Saturday" -subject:"handwritten note" -subject:"menu card"',
        ),
      ),
    ).toEqual(["inbox-004", "inbox-008"]);
    expect(ids(search('"Learn a round in one evening"'))).toEqual(["inbox-002"]);
    expect(
      search("in:sent from:avery@example.com to:maya@example.com"),
    ).toHaveLength(1);
    expect(ids(search("in:drafts to:amara@example.com"))).toEqual([
      "draft-002",
    ]);
    expect(
      ids(
        search('subject:"\\"Best way to keep basil alive indoors?\\""'),
      ),
    ).toEqual(["inbox-001"]);
  });

  test("supports OR, braces, nested groups and exclusions", () => {
    expect(
      ids(search("from:music@example.com OR from:odile@example.com")),
    ).toEqual(["inbox-002", "inbox-005"]);
    expect(
      ids(search("{from:music@example.com from:odile@example.com} is:unread")),
    ).toEqual(["inbox-002", "inbox-005"]);
    expect(
      ids(search("from:music@example.com OR from:odile@example.com is:read")),
    ).toEqual(["inbox-002"]);
    expect(
      ids(
        search(
          "(from:music@example.com OR from:odile@example.com) -subject:shortcuts",
        ),
      ),
    ).toEqual(["inbox-002"]);
    expect(
      ids(
        search(
          "in:inbox after:2026/08/26 -{from:drafts@example.com from:digest@example.com from:live@example.com}",
        ),
      ),
    ).toEqual(["inbox-002", "inbox-005"]);
  });

  test("matches label IDs, quoted names, nested paths and category", () => {
    expect(search("label:social")).toEqual(
      search('label:"[Superhuman]/AI/Social"'),
    );
    expect(search("label:Marketing")).toEqual(search("label:marketing"));
    expect(search('label:"Handle Later"')).toEqual(
      search("label:handle-later"),
    );
    expect(search('label:"Focus/Backlog Cleared"')).toEqual(
      search("label:backlog-cleared"),
    );
    expect(search('label:"Backlog Cleared"').length).toBeGreaterThan(5);
    expect(search("in:inbox category:social")).toEqual(
      search("in:inbox label:social"),
    );
    expect(search("label:not-a-label")).toHaveLength(0);
  });

  test("finds attachments by filename and estimates message sizes", () => {
    expect(
      ids(search("from:orders@example.com has:attachment filename:pdf")),
    ).toEqual(["inbox-020"]);
    expect(ids(search("filename:piano-tuning.ics"))).toEqual([
      "inbox-012",
    ]);
    expect(ids(search('subject:"with GIF" larger:800K smaller:1M'))).toEqual([
      "inbox-004",
    ]);
    expect(search("has:attachment larger:2M").length).toBeGreaterThan(5);
    expect(search("size:2097152")).toEqual(search("larger:2M"));
    expect(search("smaller:1K larger:2M")).toHaveLength(0);
    expect(search("larger:invalid")).toHaveLength(0);
  });

  test("applies date ranges, aliases and anchored relative age", () => {
    expect(search("in:inbox after:2026/08/26 before:2026/08/27")).toHaveLength(
      8,
    );
    expect(search("in:inbox newer:2026-08-26 older:2026-08-27")).toHaveLength(
      8,
    );
    expect(search("in:inbox newer_than:1d")).toHaveLength(8);
    expect(search("in:inbox older_than:1d")).toHaveLength(385);
    expect(search("in:inbox newer_than:1m").length).toBeGreaterThan(25);
    expect(search("in:inbox older_than:1y")).toHaveLength(0);
    expect(search("after:2026/02/30")).toHaveLength(0);
    expect(search("before:banana")).toHaveLength(0);
    expect(search("newer_than:2q")).toHaveLength(0);
  });

  test("excludes spam and trash unless explicitly requested", () => {
    expect(
      search("").some((email) => ["spam", "trash"].includes(email.folder)),
    ).toBe(false);
    expect(
      search("in:all").some((email) =>
        ["spam", "trash"].includes(email.folder),
      ),
    ).toBe(false);
    expect(search("in:anywhere")).toHaveLength(initialEmails.length);
    expect(ids(search("in:spam"))).toEqual([
      "spam-001",
      "spam-002",
      "spam-003",
    ]);
    expect(search("in:trash")).toHaveLength(3);
    expect(search("in:spam OR in:trash")).toHaveLength(6);
    expect(search("in:spam OR from:music@example.com")).toHaveLength(4);
    expect(
      search("-in:spam").some(
        (email) => email.folder === "spam" || email.folder === "trash",
      ),
    ).toBe(false);
    expect(search("in:anywhere -{in:spam in:trash}")).toEqual(search(""));
    expect(
      search('"in:anywhere"').some(
        (email) => email.folder === "spam" || email.folder === "trash",
      ),
    ).toBe(false);
  });

  test("queries are literal and tolerate incomplete input without regex injection", () => {
    expect(search('subject:"[DRAFT]"')).toHaveLength(4);
    expect(search("subject:.*")).toHaveLength(0);
    expect(search("from:[a-z]+")).toHaveLength(0);
    expect(search('subject:"Sourdough Saturday')).toHaveLength(4);
    expect(
      search("{from:music@example.com from:odile@example.com"),
    ).toHaveLength(2);
    expect(search("from:")).toHaveLength(0);
    expect(search("   ")).toEqual(search(""));
  });

  test("does not mutate the mailbox and preserves date order", () => {
    const before = JSON.stringify(initialEmails);
    const result = search("is:starred OR is:important");
    expect(result.length).toBeGreaterThan(10);
    expect(
      result.every(
        (email, index) =>
          index === 0 ||
          Date.parse(result[index - 1]!.date) >= Date.parse(email.date),
      ),
    ).toBe(true);
    expect(JSON.stringify(initialEmails)).toBe(before);
  });
});
