import type { Email, Label } from "./types";

export function matchesView(email: Email, view: string): boolean {
  const hidden = email.folder === "spam" || email.folder === "trash";
  switch (view) {
    case "inbox":
      return email.folder === "inbox" && !email.snoozedUntil && !email.muted;
    case "sent":
      return !hidden && (email.folder === "sent" || !!email.sent);
    case "archive":
    case "spam":
    case "trash":
      return email.folder === view;
    case "drafts":
      return email.folder === "drafts" && !email.scheduledFor;
    case "scheduled":
      return Boolean(email.scheduledFor);
    case "all":
    case "all-mail":
    case "allmail":
      return !hidden;
    case "anywhere":
      return true;
    case "starred":
      return !hidden && email.starred;
    case "important":
      return !hidden && email.important;
    case "unread":
      return !hidden && email.unread;
    case "snoozed":
      return !hidden && Boolean(email.snoozedUntil);
    default:
      if (view.startsWith("category:"))
        return (
          matchesView(email, "inbox") &&
          (email.category ?? "primary") === view.slice(9)
        );
      return (
        !hidden &&
        email.labels.includes(view.startsWith("label:") ? view.slice(6) : view)
      );
  }
}

type Token = {
  type: "term" | "or" | "not" | "open" | "close";
  value: string;
  literal?: boolean;
};
type Expression =
  | { kind: "term"; value: string; literal?: boolean }
  | { kind: "not"; child: Expression }
  | { kind: "and" | "or"; children: Expression[] };

// Quotes stay inside one token, including quoted operator values such as label:"Handle Later".
function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  while (position < query.length) {
    const character = query[position]!;
    if (/\s/.test(character)) {
      position++;
      continue;
    }
    if (character === "{" || character === "(") {
      tokens.push({ type: "open", value: character });
      position++;
      continue;
    }
    if (character === "}" || character === ")") {
      tokens.push({ type: "close", value: character });
      position++;
      continue;
    }
    if (character === "-") {
      tokens.push({ type: "not", value: "-" });
      position++;
      continue;
    }
    let value = "";
    let quoted = false;
    let hadQuote = false;
    while (position < query.length) {
      const next = query[position]!;
      if (
        next === "\\" &&
        position + 1 < query.length &&
        (query[position + 1] === '"' || query[position + 1] === "\\")
      ) {
        value += query[position + 1];
        position += 2;
      } else if (next === '"') {
        quoted = !quoted;
        hadQuote = true;
        position++;
      } else if (!quoted && (/\s/.test(next) || "{}()".includes(next))) {
        break;
      } else {
        value += next;
        position++;
      }
    }
    if (value)
      tokens.push({
        type: value === "OR" && !hadQuote ? "or" : "term",
        value,
        literal: character === '"',
      });
  }
  return tokens;
}

function parse(tokens: Token[]): Expression {
  let position = 0;
  function group(any = false): Expression {
    const alternatives: Expression[] = [];
    let conjunction: Expression[] = [];
    while (position < tokens.length && tokens[position]!.type !== "close") {
      if (tokens[position]!.type === "or") {
        if (conjunction.length)
          alternatives.push({ kind: "and", children: conjunction });
        conjunction = [];
        position++;
        continue;
      }
      let negate = false;
      while (tokens[position]?.type === "not") {
        negate = !negate;
        position++;
      }
      const token = tokens[position];
      if (!token || token.type === "close") break;
      if (token.type === "or") continue;
      position++;
      let expression: Expression;
      if (token.type === "open") {
        expression = group(token.value === "{");
        if (tokens[position]?.type === "close") position++;
      } else {
        expression = {
          kind: "term",
          value: token.value,
          literal: token.literal,
        };
      }
      if (negate) expression = { kind: "not", child: expression };
      if (any) alternatives.push(expression);
      else conjunction.push(expression);
    }
    if (conjunction.length)
      alternatives.push({ kind: "and", children: conjunction });
    if (!alternatives.length) return { kind: any ? "or" : "and", children: [] };
    return alternatives.length === 1
      ? alternatives[0]!
      : { kind: "or", children: alternatives };
  }
  return group();
}

export function plainText(body: string): string {
  return body
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(
      /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|rarr|times);/gi,
      (_, entity: string) => {
        const normalized = entity.toLowerCase();
        if (normalized.startsWith("#")) {
          const code = normalized.startsWith("#x")
            ? parseInt(normalized.slice(2), 16)
            : parseInt(normalized.slice(1), 10);
          return code > 0 && code <= 0x10ffff
            ? String.fromCodePoint(code)
            : " ";
        }
        return (
          (
            {
              amp: "&",
              lt: "<",
              gt: ">",
              quot: '"',
              apos: "'",
              nbsp: " ",
              rarr: " ",
              times: "x",
            } as Record<string, string>
          )[normalized] ?? " "
        );
      },
    )
    .replace(/\s+/g, " ")
    .trim();
}

function byteSize(value: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)\s*(b|k|kb|m|mb|g|gb)?$/i.exec(value.trim());
  if (!match) return undefined;
  const unit = (match[2] ?? "").toLowerCase()[0];
  return (
    Number(match[1]) *
    (unit === "k"
      ? 1024
      : unit === "m"
        ? 1024 ** 2
        : unit === "g"
          ? 1024 ** 3
          : 1)
  );
}

function dateValue(value: string): number | undefined {
  if (/^\d{10}$/.test(value)) return Number(value) * 1000;
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
    ? date.getTime()
    : undefined;
}

export function searchEmails(
  emails: Email[],
  query: string,
  labels: Label[],
  now = new Date(),
): Email[] {
  const expression = parse(tokenize(query.trim()));
  const normalize = (value: string) =>
    value.toLowerCase().replace(/\s+/g, " ").trim();
  const labelNames = new Map(labels.map((label) => [label.id, label.name]));
  const labelPaths = new Map(
    labels.map((label) => {
      const parts = [label.name];
      const visited = new Set([label.id]);
      let parent = label.parentId;
      while (parent && !visited.has(parent)) {
        visited.add(parent);
        const parentLabel = labels.find((candidate) => candidate.id === parent);
        if (!parentLabel) break;
        parts.unshift(parentLabel.name);
        parent = parentLabel.parentId;
      }
      return [label.id, parts.join("/")];
    }),
  );
  let allowSpam = false;
  let allowTrash = false;
  function inspectScope(node: Expression, positive = true): void {
    if (node.kind === "not") inspectScope(node.child, !positive);
    else if (node.kind === "term") {
      if (!positive || node.literal) return;
      const colon = node.value.indexOf(":");
      if (normalize(node.value.slice(0, colon)) !== "in") return;
      const argument = normalize(node.value.slice(colon + 1));
      if (argument === "anywhere" || argument === "spam") allowSpam = true;
      if (argument === "anywhere" || argument === "trash") allowTrash = true;
    } else node.children.forEach((child) => inspectScope(child, positive));
  }
  inspectScope(expression);

  return emails.filter((email) => {
    if (
      (email.folder === "spam" && !allowSpam) ||
      (email.folder === "trash" && !allowTrash)
    )
      return false;
    const names = email.labels.flatMap((id) => [
      id,
      labelNames.get(id) ?? "",
      labelPaths.get(id) ?? "",
    ]);
    const bodies = email.messages.map((message) =>
      message.format === "html" ? plainText(message.body) : message.body,
    );
    const senders = normalize(
      [
        email.sender,
        email.senderEmail,
        ...email.messages.flatMap((message) => [
          message.from.name,
          message.from.email,
        ]),
      ].join(" "),
    );
    const recipients = normalize(
      email.messages
        .flatMap((message) =>
          message.to.flatMap((address) => [address.name, address.email]),
        )
        .join(" "),
    );
    const text = normalize(
      [
        email.sender,
        email.senderEmail,
        email.subject,
        email.snippet,
        ...bodies,
        ...names,
        senders,
        recipients,
      ].join(" "),
    );
    const attachments = [
      ...email.attachments,
      ...email.messages.flatMap((message) => message.attachments ?? []),
    ].filter(
      (attachment, index, all) =>
        all.findIndex((candidate) => candidate.id === attachment.id) === index,
    );
    const timestamp = new Date(email.date).getTime();
    let totalSize: number | undefined;

    function matchesTerm(value: string): boolean {
      const colon = value.indexOf(":");
      const operator = colon > 0 ? value.slice(0, colon).toLowerCase() : "";
      const argument = normalize(colon > 0 ? value.slice(colon + 1) : value);
      switch (operator) {
        case "from":
          return Boolean(argument) && senders.includes(argument);
        case "to":
          return Boolean(argument) && recipients.includes(argument);
        case "subject":
          return (
            Boolean(argument) && normalize(email.subject).includes(argument)
          );
        case "label":
        case "l":
          return (
            Boolean(argument) &&
            names.some(
              (name) =>
                normalize(name) === argument ||
                normalize(name).split("/").at(-1) === argument,
            )
          );
        case "in": {
          if (argument === "anywhere") return true;
          if (
            argument === "all" ||
            argument === "all-mail" ||
            argument === "allmail"
          )
            return matchesView(email, "all");
          if (argument === "draft") return email.folder === "drafts";
          if (
            [
              "inbox",
              "sent",
              "drafts",
              "archive",
              "spam",
              "trash",
              "starred",
              "important",
              "snoozed",
              "scheduled",
            ].includes(argument)
          )
            return matchesView(email, argument);
          return false;
        }
        case "is":
          switch (argument) {
            case "unread":
              return email.unread;
            case "read":
              return !email.unread;
            case "starred":
              return email.starred;
            case "important":
              return email.important;
            case "snoozed":
              return Boolean(email.snoozedUntil);
            case "muted":
              return Boolean(email.muted);
            case "draft":
              return email.folder === "drafts";
            default:
              return false;
          }
        case "has":
          return argument === "attachment" && attachments.length > 0;
        case "filename":
          return (
            Boolean(argument) &&
            attachments.some((attachment) =>
              normalize(attachment.name).includes(argument),
            )
          );
        case "category":
          return (email.category ?? "primary") === argument;
        case "after":
        case "newer":
        case "before":
        case "older": {
          const boundary = dateValue(argument);
          return (
            boundary !== undefined &&
            (operator === "after" || operator === "newer"
              ? timestamp > boundary
              : timestamp < boundary)
          );
        }
        case "newer_than":
        case "older_than": {
          const match = /^(\d+)([dmy])$/.exec(argument);
          if (!match) return false;
          const days =
            Number(match[1]) *
            (match[2] === "m" ? 30 : match[2] === "y" ? 365 : 1);
          const boundary = now.getTime() - days * 86_400_000;
          return operator === "newer_than"
            ? timestamp > boundary
            : timestamp < boundary;
        }
        case "larger":
        case "smaller":
        case "size": {
          const boundary = byteSize(argument);
          if (boundary === undefined) return false;
          // The UI stores formatted attachment sizes, so search estimates message bytes locally.
          totalSize ??=
            new TextEncoder().encode(
              [
                email.subject,
                ...email.messages.map((message) => message.body),
              ].join("\n"),
            ).byteLength +
            attachments.reduce(
              (sum, attachment) => sum + (byteSize(attachment.size) ?? 0),
              0,
            );
          return operator === "smaller"
            ? totalSize < boundary
            : totalSize > boundary;
        }
        default:
          return text.includes(normalize(value));
      }
    }

    function evaluate(node: Expression): boolean {
      if (node.kind === "term")
        return node.literal
          ? text.includes(normalize(node.value))
          : matchesTerm(node.value);
      if (node.kind === "not") return !evaluate(node.child);
      return node.kind === "and"
        ? node.children.every(evaluate)
        : node.children.some(evaluate);
    }
    return evaluate(expression);
  });
}
