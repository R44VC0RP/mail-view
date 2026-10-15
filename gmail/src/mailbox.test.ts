import { describe, expect, test } from "bun:test";
import { initialEmails, initialLabels } from "./data";
import { applyMailAction, draftFromEmail, draftToEmail, saveDraftMailbox, sendDraftMailbox, undoMailbox } from "./mailbox";
import { matchesView } from "./search";

const mailbox = { emails: initialEmails, labels: initialLabels };
const first = initialEmails.find((email) => email.folder === "inbox")!;

describe("mock mailbox actions", () => {
  test("two independent compose drafts retain rich content, copies, and labels", () => {
    const a = { id: "compose-a", to: '"Chen, Maya" <maya@example.com>', cc: "copy@example.com", bcc: "hidden@example.com", subject: "First", body: "BoldSample", html: '<b>BoldSample</b>', labels: [initialLabels[0].id], attachments: [] };
    const b = { id: "compose-b", to: "other@example.com", cc: "", bcc: "", subject: "Second", body: "Keep this", attachments: [] };
    const saved = saveDraftMailbox(saveDraftMailbox(mailbox, a), b);
    const restored = draftFromEmail(saved.emails.find(email => email.id === a.id)!);
    expect(restored.html).toBe(a.html);
    expect(restored.to).toBe(a.to);
    expect(restored.cc).toBe(a.cc);
    expect(restored.bcc).toBe(a.bcc);
    expect(restored.labels).toEqual(a.labels);
    const discarded = applyMailAction(saved, "delete", [b.id]);
    expect(discarded.emails.some(email => email.id === b.id)).toBe(false);
    expect(discarded.emails.find(email => email.id === a.id)?.messages[0].body).toBe(a.html);
  });

  test("a rich reply appears in Inbox and Sent as the same conversation", () => {
    const draft = { id: "reply-draft", replyToId: first.id, replyMode: "replyAll" as const, to: first.senderEmail, cc: "copy@example.com", bcc: "", subject: `Re: ${first.subject}`, body: "A reply", html: '<b>A reply</b>', attachments: [{ id: "file", name: "note.txt", type: "document" as const, size: "1 KB", url: "data:text/plain,note" }] };
    const saved = saveDraftMailbox(mailbox, draft);
    expect(saved.emails.find(email => email.id === first.id)?.hasDraft).toBe(true);
    const sent = sendDraftMailbox(saved, draft);
    const thread = sent.emails.find(email => email.id === first.id)!;
    expect(thread.messages).toHaveLength(first.messages.length + 1);
    expect(thread.messages.at(-1)?.format).toBe("html");
    expect(thread.messages.at(-1)?.body).toBe(draft.html);
    expect(thread.messages.at(-1)?.cc?.[0].email).toBe("copy@example.com");
    expect(thread.messages.at(-1)?.attachments?.[0].url).toBe("data:text/plain,note");
    expect(matchesView(thread, "inbox")).toBe(true);
    expect(matchesView(thread, "sent")).toBe(true);
    expect(thread.hasDraft).toBe(false);
    expect(sent.emails).toHaveLength(mailbox.emails.length);
  });

  test("discarding a reply removes only the draft, never the received parent", () => {
    const draft = { id: "reply-discard", replyToId: first.id, replyMode: "reply" as const, to: first.senderEmail, cc: "", bcc: "", subject: `Re: ${first.subject}`, body: "Unsent", attachments: [] };
    const result = applyMailAction(saveDraftMailbox(mailbox, draft), "delete", [draft.id]);
    expect(result.emails).toHaveLength(mailbox.emails.length);
    expect(result.emails.find(email => email.id === first.id)?.folder).toBe("inbox");
    expect(result.emails.find(email => email.id === first.id)?.messages).toEqual(first.messages);
    expect(result.emails.find(email => email.id === first.id)?.hasDraft).toBe(false);
  });

  test("editing a reply subject starts a separate sent conversation", () => {
    const draft = { id: "new-subject", replyToId: first.id, replyMode: "reply" as const, to: first.senderEmail, cc: "", bcc: "", subject: "A different topic", body: "New topic", attachments: [] };
    const result = sendDraftMailbox(saveDraftMailbox(mailbox, draft), draft);
    expect(result.emails.find(email => email.id === first.id)?.messages).toEqual(first.messages);
    expect(result.emails.find(email => email.id === draft.id)?.folder).toBe("sent");
    expect(result.emails.find(email => email.id === draft.id)?.replyToId).toBeUndefined();
  });

  test("category destinations and atomic category labels update the actual view", () => {
    const moved = applyMailAction(mailbox, "move", [first.id], "category:promotions");
    expect(matchesView(moved.emails.find(email => email.id === first.id)!, "category:promotions")).toBe(true);
    const labeled = applyMailAction(moved, "label", [first.id], JSON.stringify({ add: ["category:social", initialLabels[0].id], remove: ["category:promotions"] }));
    expect(labeled.emails.find(email => email.id === first.id)?.category).toBe("social");
    expect(labeled.emails.find(email => email.id === first.id)?.labels).toContain(initialLabels[0].id);
  });

  test("scheduled drafts stay separate and deleting cancels their scheduled send", () => {
    const scheduled = {
      ...first,
      folder: "drafts" as const,
      scheduledFor: "2099-08-27T08:00:00.000Z",
    };
    expect(matchesView(scheduled, "drafts")).toBe(false);
    expect(matchesView(scheduled, "scheduled")).toBe(true);
    const deleted = applyMailAction(
      { ...mailbox, emails: [scheduled] },
      "delete",
      [scheduled.id],
    ).emails[0];
    expect(deleted.folder).toBe("trash");
    expect(deleted.scheduledFor).toBeUndefined();
    expect(matchesView(deleted, "scheduled")).toBe(false);
  });

  test("rich drafts preserve HTML and parse named recipients", () => {
    const draft = {
      id: "rich-draft",
      to: "Maya Chen <maya@example.com>",
      cc: "",
      bcc: "",
      subject: "Rich content",
      body: "Hello Maya",
      html: "<b>Hello</b> Maya",
      attachments: [],
    };
    const email = draftToEmail(draft, "drafts");
    expect(email.messages[0].to[0]).toEqual({
      name: "Maya Chen",
      email: "maya@example.com",
    });
    expect(email.messages[0].format).toBe("html");
    expect(email.messages[0].body).toBe(draft.html);
    expect(email.snippet).toBe(draft.body);
  });

  test("undo preserves a later star toggle and an unrelated new draft", () => {
    const after = applyMailAction(mailbox, "archive", [first.id]);
    const starred = applyMailAction(after, "star", [first.id]);
    const newDraft = draftToEmail(
      {
        id: "unrelated-draft",
        to: "friend@example.com",
        cc: "",
        bcc: "",
        subject: "Keep this",
        body: "Do not lose this message.",
        attachments: [],
      },
      "drafts",
    );
    const result = undoMailbox(mailbox, after, {
      ...starred,
      emails: [...starred.emails, newDraft],
    });
    expect(result.emails.find((email) => email.id === first.id)?.folder).toBe(
      "inbox",
    );
    expect(result.emails.find((email) => email.id === first.id)?.starred).toBe(
      true,
    );
    expect(
      result.emails.find((email) => email.id === newDraft.id)?.messages[0].body,
    ).toBe("Do not lose this message.");
  });

  test("read, star, and archive update only targeted messages without changing the seed", () => {
    const starred = applyMailAction(mailbox, "star", [first.id]);
    expect(starred.emails.find((email) => email.id === first.id)?.starred).toBe(
      true,
    );
    expect(first.starred).toBe(false);
    const unread = applyMailAction(starred, "unread", [first.id]);
    expect(unread.emails.find((email) => email.id === first.id)?.unread).toBe(
      true,
    );
    const archived = applyMailAction(unread, "archive", [first.id]);
    expect(
      archived.emails.filter((email) => matchesView(email, "inbox")),
    ).toHaveLength(392);
    expect(
      archived.emails
        .filter((email) => matchesView(email, "all"))
        .some((email) => email.id === first.id),
    ).toBe(true);
  });

  test("delete is reversible by moving back to inbox; permanent deletion removes it", () => {
    const deleted = applyMailAction(mailbox, "delete", [first.id]);
    expect(deleted.emails.find((email) => email.id === first.id)?.folder).toBe(
      "trash",
    );
    const restored = applyMailAction(deleted, "move", [first.id], "inbox");
    expect(restored.emails.find((email) => email.id === first.id)?.folder).toBe(
      "inbox",
    );
    expect(
      applyMailAction(deleted, "deleteForever", [first.id]).emails.some(
        (email) => email.id === first.id,
      ),
    ).toBe(false);
  });

  test("bulk labeling preserves unrelated mixed labels and applies in one change", () => {
    const [a, b, c] = initialLabels;
    const seeded = {
      ...mailbox,
      emails: [
        { ...first, labels: [a.id, c.id] },
        { ...first, id: "second", labels: [a.id] },
      ],
    };
    const result = applyMailAction(
      seeded,
      "label",
      [first.id, "second"],
      JSON.stringify({ add: [b.id], remove: [a.id] }),
    );
    expect(result.emails[0].labels).toEqual([c.id, b.id]);
    expect(result.emails[1].labels).toEqual([b.id]);
  });

  test("snoozed mail leaves inbox and returns when unsnoozed", () => {
    const snoozed = applyMailAction(
      mailbox,
      "snooze",
      [first.id],
      "2099-08-27T08:00:00.000Z",
    );
    const email = snoozed.emails.find((email) => email.id === first.id)!;
    expect(matchesView(email, "inbox")).toBe(false);
    expect(matchesView(email, "snoozed")).toBe(true);
    const restored = applyMailAction(snoozed, "unsnooze", [
      first.id,
    ]).emails.find((email) => email.id === first.id)!;
    expect(matchesView(restored, "inbox")).toBe(true);
  });

  test("draft saving retains recipients, copies, body, and attachment payload", () => {
    const draft = {
      id: "draft-new",
      to: "one@example.com, two@example.com",
      cc: "copy@example.com",
      bcc: "hidden@example.com",
      subject: "Hello",
      body: "A local message",
      attachments: [
        {
          id: "file",
          name: "note.txt",
          type: "document" as const,
          size: "1 KB",
          url: "data:text/plain,note",
        },
      ],
    };
    const saved = draftToEmail(draft, "drafts");
    expect(saved.folder).toBe("drafts");
    expect(saved.messages[0].to.map((address) => address.email)).toEqual([
      "one@example.com",
      "two@example.com",
    ]);
    expect(saved.messages[0].cc?.[0].email).toBe("copy@example.com");
    expect(saved.messages[0].bcc?.[0].email).toBe("hidden@example.com");
    expect(saved.messages[0].body).toBe("A local message");
    expect(saved.attachments[0].url).toBe("data:text/plain,note");
    expect(draftToEmail(draft, "sent").folder).toBe("sent");
  });
});
