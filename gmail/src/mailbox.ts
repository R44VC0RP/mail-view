import type { Address, ComposeDraft, Email, Folder, Label, MailAction } from "./types";
import { plainText } from "./search";

export type Mailbox = { emails: Email[]; labels: Label[] };
export const threadSubject = (value: string) => value.replace(/^(?:(?:re|fwd?):\s*)+/i, "").trim().toLowerCase();

export function undoMailbox(
  before: Mailbox,
  after: Mailbox,
  current: Mailbox,
): Mailbox {
  function restore<T extends { id: string }>(
    previous: T[],
    changed: T[],
    latest: T[],
  ): T[] {
    const previousById = new Map(previous.map((item) => [item.id, item]));
    const changedById = new Map(changed.map((item) => [item.id, item]));
    const restored = latest
      .filter((item) => previousById.has(item.id) || !changedById.has(item.id))
      .map((item) => {
        const old = previousById.get(item.id);
        const next = changedById.get(item.id);
        if (!old || !next || old === next) return item;
        const result = { ...item };
        for (const key of new Set([
          ...Object.keys(old),
          ...Object.keys(next),
        ])) {
          const property = key as keyof T;
          if (
            JSON.stringify(old[property]) !== JSON.stringify(next[property])
          ) {
            if (property in old) result[property] = old[property];
            else delete result[property];
          }
        }
        return result;
      });
    const restoredIds = new Set(restored.map((item) => item.id));
    return [
      ...restored,
      ...previous.filter(
        (item) => !changedById.has(item.id) && !restoredIds.has(item.id),
      ),
    ];
  }
  // Undo only this action's changes, not unrelated drafts or later star toggles.
  return {
    emails: restore(before.emails, after.emails, current.emails),
    labels: restore(before.labels, after.labels, current.labels),
  };
}

export function applyMailAction(
  mailbox: Mailbox,
  action: MailAction,
  ids: string[],
  value?: string,
): Mailbox {
  const targets = new Set(ids);
  const category = (value?: string) => {
    const name = value?.replace(/^category:/, "");
    return ["primary", "social", "promotions", "updates", "forums", "purchases"].includes(name || "") ? name as Email["category"] : undefined;
  };
  if (action === "delete" && mailbox.emails.some(email => targets.has(email.id) && email.folder === "drafts" && !email.scheduledFor)) {
    const drafts = mailbox.emails.filter(email => targets.has(email.id) && email.folder === "drafts" && !email.scheduledFor).map(email => email.id);
    return applyMailAction(discardDrafts(mailbox, drafts), action, ids.filter(id => !drafts.includes(id)), value);
  }
  if (action === "deleteForever")
    return {
      ...mailbox,
      emails: mailbox.emails.filter((email) => !targets.has(email.id)),
    };
  const emails = mailbox.emails.map((email): Email => {
    if (!targets.has(email.id)) return email;
    switch (action) {
      case "read":
        return { ...email, unread: false };
      case "unread":
        return { ...email, unread: true };
      case "star":
        return { ...email, starred: true };
      case "unstar":
        return { ...email, starred: false };
      case "important":
        return { ...email, important: true };
      case "unimportant":
        return { ...email, important: false };
      case "archive":
        return {
          ...email,
          folder: "archive" as Folder,
          scheduledFor: undefined,
        };
      case "delete":
        return {
          ...email,
          folder: "trash" as Folder,
          snoozedUntil: undefined,
          scheduledFor: undefined,
        };
      case "spam":
        return {
          ...email,
          folder: "spam" as Folder,
          snoozedUntil: undefined,
          scheduledFor: undefined,
        };
      case "mute":
        return {
          ...email,
          muted: true,
          folder: "archive" as Folder,
          scheduledFor: undefined,
        };
      case "snooze":
        return {
          ...email,
          snoozedUntil: value || new Date(Date.now() + 86400000).toISOString(),
        };
      case "unsnooze":
        return { ...email, snoozedUntil: undefined, folder: "inbox" as Folder };
      case "move": {
        if (value?.startsWith("category:") && category(value)) return { ...email, folder: "inbox" as Folder, category: category(value), snoozedUntil: undefined, scheduledFor: undefined, muted: false };
        const folder = value?.replace(/^in:/, "");
        if (
          ["inbox", "sent", "drafts", "archive", "spam", "trash"].includes(
            folder || "",
          )
        ) {
          return {
            ...email,
            folder: folder as Folder,
            snoozedUntil: undefined,
            scheduledFor: undefined,
            muted: false,
          };
        }
        const labelId = value?.replace(/^label:/, "");
        if (labelId && mailbox.labels.some((label) => label.id === labelId)) {
          return {
            ...email,
            folder: "archive" as Folder,
            snoozedUntil: undefined,
            scheduledFor: undefined,
            labels: [...new Set([...email.labels, labelId])],
          };
        }
        return email;
      }
      case "label": {
        if (value?.startsWith("category:") && category(value)) return { ...email, category: category(value) };
        if (value?.startsWith("{")) {
          const changes = JSON.parse(value) as {
            add: string[];
            remove: string[];
          };
          const add = changes.add.filter((id) =>
            mailbox.labels.some((label) => label.id === id),
          );
          return {
            ...email,
            category: category(changes.add.find(id => id.startsWith("category:"))) || (changes.remove.includes(`category:${email.category}`) ? "primary" : email.category),
            labels: [
              ...new Set([
                ...email.labels.filter((id) => !changes.remove.includes(id)),
                ...add,
              ]),
            ],
          };
        }
        if (value?.startsWith("[")) {
          const labels: unknown = JSON.parse(value);
          if (Array.isArray(labels))
            return {
              ...email,
              labels: labels.filter((id) =>
                mailbox.labels.some((label) => label.id === id),
              ),
            };
        }
        const labelId = value?.replace(/^label:/, "");
        return labelId && mailbox.labels.some((label) => label.id === labelId)
          ? { ...email, labels: [...new Set([...email.labels, labelId])] }
          : email;
      }
      case "unlabel":
        if (value?.startsWith("category:") && email.category === category(value)) return { ...email, category: "primary" };
        return {
          ...email,
          labels: email.labels.filter(
            (id) => id !== value?.replace(/^label:/, ""),
          ),
        };
      default:
        return email;
    }
  });
  return { ...mailbox, emails };
}

export function draftToEmail(
  draft: ComposeDraft,
  folder: "drafts" | "sent",
): Email {
  const date = new Date().toISOString();
  const addresses = (field: string) => {
    const parts: string[] = [];
    let value = "", quoted = false, angle = 0;
    for (let index = 0; index < field.length; index++) {
      const character = field[index];
      if (character === '"' && field[index - 1] !== "\\") quoted = !quoted;
      if (character === "<" && !quoted) angle++;
      if (character === ">" && !quoted) angle = Math.max(0, angle - 1);
      if ((character === "," || character === ";") && !quoted && !angle) { parts.push(value); value = ""; }
      else value += character;
    }
    parts.push(value);
    return parts.map((value) => {
        const match = /^(.*?)<([^<>]+)>$/.exec(value.trim());
        return {
          name: match ? match[1].trim().replace(/^"|"$/g, "").replace(/\\"/g, '"') : value.trim(),
          email: match ? match[2].trim() : value.trim(),
        };
      })
      .filter((address) => address.email);
  };
  return {
    id: draft.id || crypto.randomUUID(),
    sender: folder === "drafts" ? draft.to || "Draft" : "me",
    senderEmail: "avery@example.com",
    subject: draft.subject || "(no subject)",
    snippet: draft.body.replace(/\s+/g, " ").slice(0, 200),
    date,
    time: new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    folder,
    unread: false,
    starred: false,
    important: false,
    labels: draft.labels || [],
    replyToId: draft.replyToId,
    replyMode: draft.replyMode,
    attachments: draft.attachments,
    confidential: draft.confidential,
    mailMerge: draft.mailMerge,
    messages: [
      {
        id: `${draft.id || "draft"}-message`,
        from: { name: "Avery Lane", email: "avery@example.com" },
        to: addresses(draft.to),
        cc: addresses(draft.cc),
        bcc: addresses(draft.bcc),
        date,
        body: draft.html || draft.body,
        format: draft.html ? "html" : "plain",
        attachments: draft.attachments,
      },
    ],
  };
}

export function draftFromEmail(email: Email): ComposeDraft {
  const message = email.messages.at(-1);
  const addresses = (values: Address[] | undefined) => values?.map(address => address.name && address.name !== address.email ? `"${address.name.replace(/"/g, '\\"')}" <${address.email}>` : address.email).join(", ") || "";
  return {
    id: email.id, replyToId: email.replyToId, replyMode: email.replyMode, labels: email.labels,
    to: addresses(message?.to), cc: addresses(message?.cc), bcc: addresses(message?.bcc),
    subject: email.subject === "(no subject)" ? "" : email.subject,
    body: message?.format === "html" ? plainText(message.body) : message?.body || "",
    html: message?.format === "html" ? message.body : undefined,
    attachments: email.attachments, confidential: email.confidential, mailMerge: email.mailMerge,
  };
}

export function saveDraftMailbox(mailbox: Mailbox, draft: ComposeDraft, scheduledFor?: string): Mailbox {
  const previous = mailbox.emails.find(email => email.id === draft.id);
  if (!previous && !draft.to && !draft.cc && !draft.bcc && !draft.subject && !draft.body.trim() && !draft.attachments.length && !draft.confidential && !draft.labels?.length) return mailbox;
  const saved = draftToEmail(draft, "drafts");
  return {
    ...mailbox,
    emails: [{ ...saved, labels: draft.labels ?? previous?.labels ?? [], starred: previous?.starred || false, important: previous?.important || false, scheduledFor },
      ...mailbox.emails.filter(email => email.id !== saved.id).map(email => email.id === draft.replyToId ? { ...email, hasDraft: !scheduledFor } : email)],
  };
}

export function discardDrafts(mailbox: Mailbox, ids: string[]): Mailbox {
  const targets = new Set(ids);
  const discarded = mailbox.emails.filter(email => targets.has(email.id) && email.folder === "drafts");
  const parents = new Set(discarded.map(email => email.replyToId));
  const emails = mailbox.emails.filter(email => !discarded.some(draft => draft.id === email.id));
  return { ...mailbox, emails: emails.map(email => parents.has(email.id) ? { ...email, hasDraft: emails.some(draft => draft.replyToId === email.id && draft.folder === "drafts" && !draft.scheduledFor) } : email) };
}

export function sendDraftMailbox(mailbox: Mailbox, draft: ComposeDraft): Mailbox {
  const sent = draftToEmail(draft, "sent");
  const parent = mailbox.emails.find(email => email.id === draft.replyToId);
  const remaining = mailbox.emails.filter(email => email.id !== draft.id);
  if (parent && threadSubject(parent.subject) === threadSubject(draft.subject)) {
    const message = { ...sent.messages[0], id: crypto.randomUUID() };
    return { ...mailbox, emails: remaining.map(email => email.id === parent.id ? {
      ...email, messages: [...email.messages, message], unread: false, hasDraft: remaining.some(candidate => candidate.replyToId === email.id && candidate.folder === "drafts" && !candidate.scheduledFor), sent: true,
      snippet: sent.snippet, date: sent.date, time: sent.time,
      attachments: [...new Map([...email.attachments, ...draft.attachments].map(attachment => [attachment.id, attachment])).values()],
    } : email) };
  }
  return { ...mailbox, emails: [{ ...sent, replyToId: undefined, replyMode: undefined }, ...remaining.map(email => email.id === parent?.id ? { ...email, hasDraft: false } : email)] };
}
