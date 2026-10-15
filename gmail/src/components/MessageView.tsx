import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  Address,
  Attachment,
  ConfidentialSettings,
  Email,
  Label,
  Message,
  OnAction,
} from "../types";
import { Icon } from "../ui/Icon";
import { RichTextEditor } from "./RichTextEditor";
import type { RichTextEditorHandle } from "./RichTextEditor";
import { FormattingToolbar } from "./FormattingToolbar";
import { labelPath } from "./MailMenus";
import {
  RecipientField,
  recipientAddress,
  splitRecipients,
} from "./RecipientField";
import {
  ComposeAlert,
  ComposeFilePicker,
  ComposeModal,
  ConfidentialDialog,
  EmojiPicker,
  InsertLinkPopover,
  ScheduleSendDialog,
} from "./ComposeDialogs";
import "./message.css";
import "./message-fidelity.css";

type ReplyMode = "reply" | "replyAll" | "forward";
export type ReplyOptions = {
  cc?: string;
  bcc?: string;
  confidential?: ConfidentialSettings;
  scheduledFor?: string;
};
type MessageViewProps = {
  email: Email;
  labels: Label[];
  onAction: OnAction;
  onSendReply: (
    emailId: string,
    body: string,
    mode: ReplyMode,
    to?: string,
    html?: string,
    attachments?: Attachment[],
    options?: ReplyOptions,
  ) => void;
  initialReply?: ReplyMode;
  replyRequestId?: number;
  replyDocked?: boolean;
  replyDockExpanded?: boolean;
  onFocusDockedReply?: () => void;
  replyDraft?: {
    body: string;
    to: string;
    mode: ReplyMode;
    html?: string;
    attachments?: Attachment[];
    cc?: string;
    bcc?: string;
    confidential?: ConfidentialSettings;
  };
  onSaveReply: (
    emailId: string,
    body: string,
    mode: ReplyMode,
    to: string,
    html?: string,
    attachments?: Attachment[],
    options?: ReplyOptions,
  ) => void;
  onDiscardReply: (emailId: string) => void;
  onPopoutReply?: (
    emailId: string,
    body: string,
    mode: ReplyMode,
    to: string,
    html: string,
    attachments: Attachment[],
    editSubject?: boolean,
    options?: ReplyOptions,
  ) => void;
};

function isMe(address: Address) {
  return (
    ["avery@example.com", "avery@example.org"].includes(
      address.email.toLowerCase(),
    ) || /^(me|you)$/i.test(address.name)
  );
}

function displayDate(value: string, full = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const now = new Date();
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (full)
    return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, ${time}`;
  const elapsed = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(minutes / 60);
  const days =
    hours >= 24
      ? Math.max(
          1,
          Math.round(
            (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
              Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
              86400000,
          ),
        )
      : 0;
  const count =
    days >= 365
      ? Math.floor(days / 365)
      : days >= 30
        ? Math.floor(days / 30)
        : days || hours || minutes;
  const unit =
    days >= 365
      ? "year"
      : days >= 30
        ? "month"
        : days
          ? "day"
          : hours
            ? "hour"
            : "minute";
  const age =
    minutes < 1
      ? "0 minutes ago"
      : `${count} ${unit}${count === 1 ? "" : "s"} ago`;
  const calendar =
    date.toDateString() === now.toDateString()
      ? time
      : `${date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) })}, ${time}`;
  return `${calendar} (${age})`;
}

function textHtml(text: string) {
  const element = document.createElement("div");
  element.textContent = text;
  return element.innerHTML.replace(/"/g, "&quot;").replace(/\r?\n/g, "<br>");
}

function quotedMessage(
  email: Email,
  message: Message | undefined,
  mode: ReplyMode,
) {
  if (!message) return "<div><br></div>";
  const from = message.from;
  const date = new Date(message.date);
  const calendar = Number.isFinite(date.getTime())
    ? `${date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : message.date;
  const body =
    message.format === "html"
      ? new DOMParser()
          .parseFromString(message.body, "text/html")
          .body.outerHTML.replace(/^<body/i, "<div")
          .replace(/<\/body>$/i, "</div>")
      : `<div>${textHtml(message.body)}</div>`;
  const link = `<a href="mailto:${textHtml(from.email)}">${textHtml(from.email)}</a>`;
  if (mode === "forward")
    return `<br><br><div class="gmail_quote gmail_quote_container"><div class="gmail_attr">---------- Forwarded message ---------<br>From: <strong class="gmail_sendername">${textHtml(from.name)}</strong> <span>&lt;${textHtml(from.email)}&gt;</span><br>Date: ${textHtml(calendar)}<br>Subject: ${textHtml(email.subject)}<br>To: ${message.to.map((address) => `${textHtml(isMe(address) ? "" : address.name)} &lt;${textHtml(address.email)}&gt;`).join(", ")}<br>${message.cc?.length ? `Cc: ${message.cc.map((address) => `${textHtml(address.name)} &lt;${textHtml(address.email)}&gt;`).join(", ")}<br>` : ""}</div><br><br>${body}</div>`;
  return `<div><br></div><br><div class="gmail_quote gmail_quote_container"><div class="gmail_attr">On ${textHtml(calendar)} ${textHtml(from.name)} &lt;${link}&gt; wrote:<br></div><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${body}</blockquote></div>`;
}

function replyRecipients(
  email: Email,
  message: Message | undefined,
  mode: ReplyMode,
) {
  if (mode === "forward") return { to: "", cc: "", bcc: "" };
  const sender =
    message && isMe(message.from)
      ? message.to.filter((address) => !isMe(address))
      : [message?.from || { name: email.sender, email: email.senderEmail }];
  const seen = new Set<string>();
  const unique = (addresses: Address[]) =>
    addresses
      .filter((address) => {
        const key = address.email.toLowerCase();
        if (isMe(address) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((address) => address.email)
      .join(", ");
  const to = unique(sender);
  const cc =
    mode === "replyAll"
      ? unique([...(message?.to || []), ...(message?.cc || [])])
      : "";
  return { to, cc, bcc: "" };
}

function HtmlMessage({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(120);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed
    .querySelectorAll(
      "script, iframe, frame, frameset, object, embed, form, input, button, textarea, select, link, meta, base, svg, math, video, audio",
    )
    .forEach((node) => node.remove());
  parsed.querySelectorAll("*").forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      if (
        /^on/i.test(attribute.name) ||
        ["srcset", "srcdoc", "action", "formaction", "background"].includes(
          attribute.name,
        )
      )
        node.removeAttribute(attribute.name);
    }
    if (
      node.hasAttribute("src") &&
      !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(
        node.getAttribute("src") || "",
      )
    )
      node.removeAttribute("src");
    if (
      node.hasAttribute("href") &&
      !/^(https?:\/\/|mailto:)/i.test(node.getAttribute("href") || "")
    )
      node.removeAttribute("href");
  });
  parsed.querySelectorAll("a").forEach((link) => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
  parsed
    .querySelectorAll<HTMLElement>(".gmail_quote, .gmail_extra")
    .forEach((quote) => {
      if (
        quote.parentElement?.closest(".gmail_quote, .gmail_extra") ||
        /^\s*-+ Forwarded message/.test(quote.textContent || "")
      )
        return;
      quote.hidden = true;
      quote.setAttribute("data-message-trimmed", "true");
      const button = parsed.createElement("button");
      button.type = "button";
      button.className = "message-trimmed-content";
      button.setAttribute("aria-label", "Show trimmed content");
      button.title = "Show trimmed content";
      button.setAttribute("contenteditable", "false");
      quote.before(button);
    });
  const trimAsset = new URL("/icons/trim.png", window.location.origin).href;
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${trimAsset}; style-src 'unsafe-inline'; font-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;padding:0;background:#fff;color:#222;font:13px/1.5 Arial,sans-serif;overflow-wrap:break-word}body{display:flow-root}img{max-width:100%;height:auto}table{max-width:100%}a{color:#1155cc;text-decoration:underline}p{margin:0 0 19.5px}[data-message-trimmed][hidden]{display:none!important}.message-trimmed-content{display:block;width:24px;height:11px;border:0;padding:0;margin:16px 0 0;border-radius:5.5px;background:#e8eaed url('${trimAsset}') center/20px no-repeat;cursor:pointer}.message-trimmed-content:hover{background-color:#dadce0}</style>${parsed.head.innerHTML}</head>${parsed.body.outerHTML}</html>`;

  function measure() {
    observer.current?.disconnect();
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const resize = () =>
      setHeight(Math.max(24, doc.body.getBoundingClientRect().height));
    resize();
    observer.current = new ResizeObserver(resize);
    observer.current.observe(doc.body);
    doc.addEventListener("click", (event) => {
      const trim = (event.target as Element).closest(
        ".message-trimmed-content",
      );
      if (trim) {
        const quote = trim.nextElementSibling as HTMLElement | null;
        if (quote?.hasAttribute("data-message-trimmed")) quote.hidden = false;
        trim.remove();
        resize();
        return;
      }
      const link = (event.target as Element).closest("a[href]");
      if (!link) return;
      event.preventDefault();
      const href = link.getAttribute("href") || "";
      if (/^(https?:\/\/|mailto:)/i.test(href))
        window.open(href, "_blank", "noopener,noreferrer");
    });
  }

  useEffect(() => () => observer.current?.disconnect(), []);
  return (
    <iframe
      ref={frame}
      className="message-html"
      title="Email content"
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      onLoad={measure}
      style={{ height }}
    />
  );
}

function AttachmentDriveIcon() {
  return (
    <svg
      viewBox="0 -960 960 960"
      width={20}
      height={20}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M285-216H483L345-456H257l-56,96q-13,23-13,48t13,48t35.55,35.5T285-216ZM480-365l52-91H428l52,91ZM299-528H573l44-76l-54-92q-13-23-34.82-35.5t-48-12.5T432-731.5T397-696L299-528ZM515-144H285q-45.32,0-84.16-22.5T139-228.2t-23-84T139-396L335-732q23-39 61.5-61.5T480-816t83.5,22.5T625-732L814-408q-22-11-46-16.5T718-430L659-532L562-363q-27,29-43,66.59T503-216q0,19 3,37t9,35ZM684-72V-180H576v-72H684V-360h72v108H864v72H756V-72H684ZM659-532Z" />
    </svg>
  );
}

function PlainMessage({ body }: { body: string }) {
  return (
    <div className="message-plain">
      {body.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </div>
  );
}

function localAttachmentUrl(attachment: Attachment) {
  // Data URLs are only used for downloads; previews render raster images or static text.
  if (
    attachment.url?.startsWith("data:") ||
    attachment.url?.startsWith(`blob:${window.location.origin}/`)
  )
    return attachment.url;
  return `data:text/plain;charset=utf-8,${encodeURIComponent(`${attachment.name}\n\nFile type: ${attachment.type}\nSize: ${attachment.size}\n\nThis local attachment preview contains no external file data.`)}`;
}

function AttachmentPreview({
  attachment,
  onClose,
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const image =
    attachment.type === "image" &&
    /^data:image\/(png|jpeg|gif|webp);base64,/i.test(attachment.url || "");
  const local = localAttachmentUrl(attachment);
  return (
    <dialog
      ref={dialog}
      className="message-preview"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header>
        <span>
          <Icon
            name={attachment.type === "image" ? "mimeImage" : attachment.type === "pdf" ? "mimePdf" : attachment.type === "calendar" ? "calendar" : "document"}
            size={20}
          />
          {attachment.name}
        </span>
        <div>
          <a
            className="icon-button"
            title="Download attachment"
            aria-label="Download attachment"
            href={local}
            download={
              attachment.url ? attachment.name : `${attachment.name}.txt`
            }
          >
            <Icon name="downloadAttachment" size={20} />
          </a>
          <button
            className="icon-button"
            title="Close preview"
            aria-label="Close preview"
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
      </header>
      <div className="message-preview-content">
        {image ? (
          <img src={attachment.url} alt={attachment.name} />
        ) : (
          <div className="message-preview-sheet">
            <Icon
              name={attachment.type === "pdf" ? "mimePdf" : "document"}
              size={16}
            />
            <h2>{attachment.name}</h2>
            <p>
              {attachment.size}
              {" \u00b7 "}
              {attachment.type === "calendar"
                ? "Calendar invitation"
                : attachment.type === "pdf"
                  ? "PDF document"
                  : "Document"}
            </p>
            <hr />
            <p className="message-preview-text">
              {attachment.previewText ||
                "Attachment preview\n\nDownload to view the original file locally."}
            </p>
          </div>
        )}
      </div>
    </dialog>
  );
}

export function MessageView(props: MessageViewProps) {
  return <MessageThread key={props.email.id} {...props} />;
}

function MessageThread({
  email,
  labels,
  onAction,
  onSendReply,
  initialReply,
  replyRequestId,
  replyDocked = false,
  replyDockExpanded = true,
  onFocusDockedReply,
  replyDraft,
  onSaveReply,
  onDiscardReply,
  onPopoutReply,
}: MessageViewProps) {
  const latest = email.messages[email.messages.length - 1];
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(latest ? [latest.id] : []),
  );
  const [menu, setMenu] = useState<{
    type: "details" | "more" | "reply";
    id: string;
    left?: number;
  } | null>(null);
  const [replyMode, setReplyMode] = useState<ReplyMode | null>(
    replyDocked ? null : initialReply || replyDraft?.mode || null,
  );
  const replyModeCurrent = useRef(replyMode);
  replyModeCurrent.current = replyMode;
  const replyGeneration = useRef(0);
  const [reply, setReply] = useState(() => {
    const mode = replyDocked ? undefined : initialReply || replyDraft?.mode;
    const recipients = replyRecipients(email, latest, mode || "reply");
    return {
      body: replyDraft?.body || "",
      html:
        replyDraft?.html ??
        (replyDraft
          ? textHtml(replyDraft.body)
          : mode
            ? quotedMessage(email, latest, mode)
            : ""),
      to: replyDraft?.to ?? recipients.to,
      cc: replyDraft?.cc ?? recipients.cc,
      bcc: replyDraft?.bcc || "",
      attachments:
        replyDraft?.attachments ||
        (mode === "forward"
          ? latest
            ? messageAttachments(latest, email.messages.length - 1)
            : email.attachments
          : []),
      confidential: replyDraft?.confidential,
    };
  });
  const replyCurrent = useRef(reply);
  const replySource = useRef(latest);
  const dirty = useRef(Boolean(replyDraft));
  const initializedReply = useRef(
    !replyDocked && Boolean(initialReply || replyDraft),
  );
  const [recipientsExpanded, setRecipientsExpanded] = useState(
    (initialReply || replyDraft?.mode) === "forward",
  );
  const [showCc, setShowCc] = useState(Boolean(reply.cc));
  const [showBcc, setShowBcc] = useState(Boolean(reply.bcc));
  const [formatting, setFormatting] = useState(true);
  const [plainText, setPlainText] = useState(false);
  const [dialog, setDialog] = useState<
    "drive" | "photo" | "confidential" | "signature" | "schedule" | null
  >(null);
  const [toolMenu, setToolMenu] = useState<{
    name: "send" | "emoji" | "signature" | "more" | "label";
    x: number;
    y: number;
  } | null>(null);
  const [link, setLink] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [signature, setSignature] = useState(
    () => localStorage.getItem("gopen-compose-signature") || "",
  );
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [warningReady, setWarningReady] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [notice, setNotice] = useState("");
  const [driveFiles, setDriveFiles] = useState<Attachment[]>(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem("gopen-drive-files") || "[]",
      );
      return Array.isArray(stored)
        ? stored.filter((file): file is Attachment =>
            Boolean(
              file &&
              typeof file.id === "string" &&
              typeof file.name === "string" &&
              typeof file.size === "string" &&
              ["pdf", "document", "image", "calendar"].includes(file.type),
            ),
          )
        : [];
    } catch {
      return [];
    }
  });
  const [labelQuery, setLabelQuery] = useState("");
  const [replyLabels, setReplyLabels] = useState<string[]>(email.labels);
  const replyEditor = useRef<RichTextEditorHandle | null>(null);
  const replyShell = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const toolPanel = useRef<HTMLDivElement>(null);
  const toolTrigger = useRef<HTMLButtonElement | null>(null);
  const alive = useRef(true);
  const menuTrigger = useRef<HTMLElement | null>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  const allExpanded =
    email.messages.length > 0 &&
    email.messages.every((message) => expanded.has(message.id));
  const newsletter =
    email.category === "promotions" || /unsubscribe/i.test(latest?.body || "");
  const external = email.folder !== "sent" && !/^(me|you)$/i.test(email.sender);

  const contacts = email.messages.flatMap((message) => [
    message.from,
    ...message.to,
    ...(message.cc || []),
  ]);
  const canReplyAll = Boolean(
    replyRecipients(email, replySource.current, "replyAll").cc,
  );
  const outsideRecipient = [reply.to, reply.cc, reply.bcc]
    .flatMap(splitRecipients)
    .map(recipientAddress)
    .find(
      (address) =>
        !isMe(address) && !/@example\.(?:com|org)$/i.test(address.email),
    );

  function updateReply(patch: Partial<typeof reply>) {
    const next = { ...replyCurrent.current, ...patch };
    replyCurrent.current = next;
    dirty.current = true;
    setReply(next);
    setReplyError("");
    if (replyModeCurrent.current)
      onSaveReply(
        email.id,
        next.body,
        replyModeCurrent.current,
        next.to,
        next.html,
        next.attachments,
        { cc: next.cc, bcc: next.bcc, confidential: next.confidential },
      );
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (latest) {
      setExpanded((current) => new Set([...current, latest.id]));
      if (!initializedReply.current) replySource.current = latest;
    }
  }, [latest?.id]);

  useEffect(() => {
    if (initialReply) openReply(initialReply);
  }, [initialReply, replyRequestId]);

  useEffect(() => {
    if (!replyMode) return;
    if (replyMode !== "forward") replyEditor.current?.focus("start");
    const timer = window.setTimeout(() => setWarningReady(true), 1200);
    return () => clearTimeout(timer);
  }, [Boolean(replyMode)]);

  useEffect(() => {
    if (!toolMenu) return;
    function outside(event: PointerEvent) {
      if (
        !toolPanel.current?.contains(event.target as Node) &&
        !toolTrigger.current?.contains(event.target as Node)
      )
        setToolMenu(null);
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setToolMenu(null);
        toolTrigger.current?.focus();
      }
      if (
        !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) ||
        (event.target as HTMLElement).tagName === "INPUT"
      )
        return;
      const buttons = Array.from(
        toolPanel.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) || [],
      );
      if (!buttons.length) return;
      event.preventDefault();
      const index = buttons.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      buttons[
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
              buttons.length
      ]?.focus();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, [toolMenu]);

  useEffect(() => {
    if (!menu) return;
    const focusTarget =
      menuPanel.current?.querySelector<HTMLElement>('button, [tabindex="0"]') ||
      menuPanel.current;
    focusTarget?.focus();
    function dismiss(event: PointerEvent) {
      const target = event.target as Element;
      if (!target.closest("[data-message-menu], [data-message-menu-trigger]"))
        setMenu(null);
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu(null);
        menuTrigger.current?.focus();
        event.stopPropagation();
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const buttons = Array.from(
        menuPanel.current?.querySelectorAll<HTMLButtonElement>("button") || [],
      );
      if (!buttons.length) return;
      event.preventDefault();
      const index = buttons.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
              buttons.length;
      buttons[next]?.focus();
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", keyboard);
    };
  }, [menu]);

  function toggleMessage(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openMenu(
    type: "details" | "more" | "reply",
    id: string,
    trigger: HTMLElement,
  ) {
    menuTrigger.current = trigger;
    const row = trigger.closest(".message-sender-row");
    const arrow = trigger.querySelector(".message-details-arrow");
    const left =
      type === "details" && row && arrow
        ? arrow.getBoundingClientRect().left - row.getBoundingClientRect().left
        : undefined;
    setMenu((current) =>
      current?.type === type && current.id === id ? null : { type, id, left },
    );
  }

  function openReply(mode: ReplyMode, message = replySource.current || latest) {
    if (replyDocked) {
      setMenu(null);
      onFocusDockedReply?.();
      return;
    }
    setReplyMode(mode);
    setReplyError("");
    setMenu(null);
    setToolMenu(null);
    replySource.current = message;
    const current =
      !replyMode && replyDraft
        ? {
            ...replyCurrent.current,
            ...replyDraft,
            html: replyDraft.html ?? textHtml(replyDraft.body),
            attachments:
              replyDraft.attachments ?? replyCurrent.current.attachments,
          }
        : replyCurrent.current;
    if (!replyMode && replyDraft) dirty.current = true;
    const first = !initializedReply.current && !replyDraft;
    const initializeForward =
      mode === "forward" &&
      !dirty.current &&
      !current.html.includes("---------- Forwarded message ---------");
    const content =
      first || initializeForward
        ? { body: "", html: quotedMessage(email, message, mode) }
        : replyEditor.current?.getContent() || {
            body: current.body,
            html: current.html,
          };
    const next = {
      ...current,
      ...content,
      ...(!first &&
      (replyMode === mode || (!replyMode && replyDraft?.mode === mode))
        ? {}
        : replyRecipients(email, message, mode)),
      attachments:
        mode === "forward" && (first || initializeForward)
          ? message
            ? messageAttachments(
                message,
                email.messages.findIndex((item) => item.id === message.id),
              )
            : email.attachments
          : current.attachments,
    };
    initializedReply.current = true;
    replyCurrent.current = next;
    setReply(next);
    if (first || initializeForward)
      replyEditor.current?.setContent(next.body, next.html);
    setRecipientsExpanded(mode === "forward");
    setShowCc(Boolean(next.cc));
    setShowBcc(Boolean(next.bcc));
    if (dirty.current)
      onSaveReply(
        email.id,
        next.body,
        mode,
        next.to,
        next.html,
        next.attachments,
        { cc: next.cc, bcc: next.bcc, confidential: next.confidential },
      );
    requestAnimationFrame(() => {
      replyShell.current?.scrollIntoView({ block: "nearest" });
      if (mode === "forward")
        replyShell.current
          ?.querySelector<HTMLInputElement>('input[aria-label="To"]')
          ?.focus();
      else replyEditor.current?.focus(first ? "start" : undefined);
    });
  }

  function sendReply(scheduledFor?: string) {
    if (!replyMode) return;
    const current = replyCurrent.current;
    const addresses = [current.to, current.cc, current.bcc].flatMap(
      splitRecipients,
    );
    if (!addresses.length) {
      setReplyError("Please specify at least one recipient.");
      return;
    }
    const invalid = addresses.find(
      (address) =>
        !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(
          recipientAddress(address).email,
        ),
    );
    if (invalid) {
      setReplyError(
        `The address "${invalid}" in the "To" field was not recognized. Please make sure that all addresses are properly formed.`,
      );
      return;
    }
    if (loadingFiles) {
      setReplyError("Wait for your attachments to finish loading.");
      return;
    }
    const content = replyEditor.current?.getContent() || current;
    onSendReply(
      email.id,
      content.body,
      replyMode,
      current.to,
      content.html,
      current.attachments,
      {
        cc: current.cc,
        bcc: current.bcc,
        confidential: current.confidential,
        scheduledFor,
      },
    );
    clearReply();
    setNotice(scheduledFor ? "Send scheduled" : "Message sent");
  }

  function clearReply() {
    replyGeneration.current += 1;
    replyModeCurrent.current = null;
    setReplyMode(null);
    const empty = {
      body: "",
      html: "",
      to: "",
      cc: "",
      bcc: "",
      attachments: [] as Attachment[],
      confidential: undefined,
    };
    replyCurrent.current = empty;
    setReply(empty);
    dirty.current = false;
    initializedReply.current = false;
    setMenu(null);
    setToolMenu(null);
    setDialog(null);
    setLink(null);
    setReplyError("");
    setWarningReady(false);
    setWarningDismissed(false);
    setLoadingFiles(false);
  }

  function popoutReply(editSubject = false) {
    if (!replyMode || !onPopoutReply) return;
    if (loadingFiles) {
      setReplyError("Wait for your attachments to finish loading.");
      return;
    }
    const current = replyCurrent.current;
    const content = replyEditor.current?.getContent() || current;
    const next = { ...current, ...content };
    replyCurrent.current = next;
    setReply(next);
    dirty.current = true;
    const options = {
      cc: next.cc,
      bcc: next.bcc,
      confidential: next.confidential,
    };
    onSaveReply(
      email.id,
      next.body,
      replyMode,
      next.to,
      next.html,
      next.attachments,
      options,
    );
    onPopoutReply(
      email.id,
      next.body,
      replyMode,
      next.to,
      next.html,
      next.attachments,
      editSubject,
      options,
    );
    setReplyMode(null);
    setMenu(null);
    setToolMenu(null);
  }

  function insertReplyLink() {
    replyEditor.current?.rememberSelection();
    const selection = window.getSelection();
    const editor =
      replyShell.current?.querySelector<HTMLElement>(".gmail-editor");
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const rect =
      range && editor?.contains(range.commonAncestorContainer)
        ? range.getBoundingClientRect()
        : null;
    const fallback = editor?.getBoundingClientRect();
    setToolMenu(null);
    setLink({
      text: replyEditor.current?.getSelectedText() || "",
      x: rect?.width || rect?.height ? rect.left : fallback?.left || 16,
      y: rect?.height ? rect.bottom : (fallback?.top || 130) + 19,
    });
  }

  function openToolMenu(
    name: NonNullable<typeof toolMenu>["name"],
    button: HTMLButtonElement,
  ) {
    replyEditor.current?.rememberSelection();
    toolTrigger.current = button;
    if (name === "label") setReplyLabels(email.labels);
    setMenu(null);
    setLink(null);
    if (toolMenu?.name === name) {
      setToolMenu(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    const [width, height] = {
      send: [157.578, 44],
      emoji: [370, 340],
      signature: [216.906, signature ? 121 : 89],
      more: [227.508, 166],
      label: [240, 190],
    }[name];
    const x =
      name === "send"
        ? rect.left - 72
        : name === "emoji"
          ? rect.left + rect.width / 2 - width / 2 + 20
          : name === "more"
            ? rect.right - width - 6
            : rect.left + 6;
    setToolMenu({
      name,
      x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      y: Math.max(8, rect.top - height + (name === "signature" ? 6 : -2)),
    });
  }

  async function attachFiles(files: FileList | null, inline = false) {
    if (!files?.length || loadingFiles) return;
    const chosen = Array.from(files);
    const generation = replyGeneration.current;
    const size = replyCurrent.current.attachments.reduce(
      (sum, attachment) => sum + (attachment.url?.length || 0) * 0.75,
      0,
    );
    if (chosen.reduce((sum, file) => sum + file.size, size) > 2 * 1024 * 1024) {
      setReplyError(
        "Keep attachments under 2 MB total so your draft can be saved locally.",
      );
      return;
    }
    setLoadingFiles(true);
    try {
      const attachments = await Promise.all(
        chosen.map(
          (file) =>
            new Promise<Attachment>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  id: crypto.randomUUID(),
                  name: file.name,
                  type: file.type.startsWith("image/")
                    ? "image"
                    : file.type === "application/pdf" ||
                        /\.pdf$/i.test(file.name)
                      ? "pdf"
                      : /\.ics$/i.test(file.name)
                        ? "calendar"
                        : "document",
                  size:
                    file.size >= 1024 * 1024
                      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                      : `${Math.max(1, Math.round(file.size / 1024))} KB`,
                  url: String(reader.result),
                  ...(inline && file.type.startsWith("image/")
                    ? { inline: true }
                    : {}),
                });
              reader.onerror = () =>
                reject(new Error(`Could not read ${file.name}`));
              reader.readAsDataURL(file);
            }),
        ),
      );
      if (!alive.current || generation !== replyGeneration.current) return;
      updateReply({
        attachments: [...replyCurrent.current.attachments, ...attachments],
      });
      if (inline)
        attachments
          .filter((attachment) => attachment.inline)
          .forEach((attachment) =>
            replyEditor.current?.command(
              "insertHTML",
              `<img src="${attachment.url}" alt="${textHtml(attachment.name)}" style="max-width:100%;height:auto">`,
            ),
          );
      setDialog(null);
    } catch (cause) {
      if (alive.current && generation === replyGeneration.current)
        setReplyError(
          cause instanceof Error
            ? cause.message
            : "Could not attach these files.",
        );
    } finally {
      if (alive.current && generation === replyGeneration.current)
        setLoadingFiles(false);
      if (fileInput.current) fileInput.current.value = "";
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  function footerTool(
    name: string,
    label: string,
    action: (button: HTMLButtonElement) => void,
    active = false,
  ) {
    return (
      <button
        type="button"
        className={`gmail-compose-tool ${active ? "gmail-compose-tool-active" : ""}`}
        aria-label={label}
        data-tooltip={label}
        aria-pressed={name === "format" ? active : undefined}
        onMouseDown={(event) => {
          if (name === "link") event.preventDefault();
          replyEditor.current?.rememberSelection();
        }}
        onClick={(event) => action(event.currentTarget)}
      >
        <Icon name={name} size={20} />
      </button>
    );
  }

  function messageAttachments(message: Message, index: number) {
    return message.attachments !== undefined
      ? message.attachments
      : index === email.messages.length - 1 &&
          !email.messages.some((item) => item.attachments !== undefined)
        ? email.attachments
        : [];
  }

  function saveToDrive(files: Attachment[]) {
    const next = [...driveFiles, ...files].filter(
      (file, index, items) =>
        items.findIndex((item) => item.id === file.id) === index,
    );
    try {
      localStorage.setItem("gopen-drive-files", JSON.stringify(next));
      setDriveFiles(next);
      setNotice(
        files.length === 1
          ? "Added to My Drive"
          : "Attachments added to My Drive",
      );
    } catch {
      setReplyError("Not enough local storage to save these files.");
    }
  }

  async function downloadAttachments(files: Attachment[]) {
    try {
      const records = await Promise.all(
        files.map(async (file) => ({
          name: new TextEncoder().encode(
            (file.name.split(/[\\/]/).pop() || "attachment").replace(
              /\0/g,
              "_",
            ),
          ),
          data: new Uint8Array(
            await (await fetch(localAttachmentUrl(file))).arrayBuffer(),
          ),
        })),
      );
      const parts: BlobPart[] = [];
      const directory: Uint8Array<ArrayBuffer>[] = [];
      let offset = 0;
      // Store-mode ZIP keeps the original file bytes and needs no compression dependency.
      for (const { name, data } of records) {
        let crc = 0xffffffff;
        for (const byte of data) {
          crc ^= byte;
          for (let bit = 0; bit < 8; bit++)
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
        crc = (crc ^ 0xffffffff) >>> 0;
        const local = new Uint8Array(30 + name.length);
        const header = new DataView(local.buffer);
        header.setUint32(0, 0x04034b50, true);
        header.setUint16(4, 20, true);
        header.setUint16(6, 0x0800, true);
        header.setUint32(14, crc, true);
        header.setUint32(18, data.length, true);
        header.setUint32(22, data.length, true);
        header.setUint16(26, name.length, true);
        local.set(name, 30);
        const central = new Uint8Array(46 + name.length);
        const entry = new DataView(central.buffer);
        entry.setUint32(0, 0x02014b50, true);
        entry.setUint16(4, 20, true);
        entry.setUint16(6, 20, true);
        entry.setUint16(8, 0x0800, true);
        entry.setUint32(16, crc, true);
        entry.setUint32(20, data.length, true);
        entry.setUint32(24, data.length, true);
        entry.setUint16(28, name.length, true);
        entry.setUint32(42, offset, true);
        central.set(name, 46);
        parts.push(local, data);
        directory.push(central);
        offset += local.length + data.length;
      }
      const end = new Uint8Array(22);
      const footer = new DataView(end.buffer);
      footer.setUint32(0, 0x06054b50, true);
      footer.setUint16(8, records.length, true);
      footer.setUint16(10, records.length, true);
      footer.setUint32(
        12,
        directory.reduce((sum, entry) => sum + entry.length, 0),
        true,
      );
      footer.setUint32(16, offset, true);
      const url = URL.createObjectURL(
        new Blob([...parts, ...directory, end], { type: "application/zip" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "attachments.zip";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setReplyError("Could not download these attachments.");
    }
  }

  return (
    <section className={`message${replyDocked ? " message--reply-docked" : ""}${replyDocked && replyDockExpanded ? " message--reply-dock-expanded" : ""}`} aria-label={`Conversation: ${email.subject}`}>
      <div className="message-surface">
        <header
          className={`message-subject-row ${email.messages.length > 1 ? "message-subject-thread" : ""}`}
        >
          <div className="message-subject-content">
            <h1>{email.subject || "(no subject)"}</h1>
            {external && <span className="message-external">External</span>}
            {email.folder === "inbox" && (
              <span className="message-label">
                <button
                  onClick={() => onAction("filter", [email.id], "in:inbox")}
                >
                  Inbox
                </button>
                <button
                  aria-label="Remove Inbox label"
                  title="Remove Inbox label"
                  onClick={() => onAction("archive", [email.id])}
                >
                  {"\u00d7"}
                </button>
              </span>
            )}
            {email.labels.map((id) => {
              const label = labels.find((item) => item.id === id);
              return label ? (
                <span
                  className="message-label"
                  key={id}
                  style={
                    label.color
                      ? { backgroundColor: label.color, color: label.textColor || "#202124" }
                      : undefined
                  }
                >
                  <button
                    onClick={() =>
                      onAction("filter", [email.id], `label:${id}`)
                    }
                  >
                    {labelPath(label, labels)}
                  </button>
                  <button
                    aria-label={`Remove ${label.name} label`}
                    title={`Remove ${label.name} label`}
                    onClick={() => onAction("unlabel", [email.id], id)}
                  >
                    {"\u00d7"}
                  </button>
                </span>
              ) : null;
            })}
          </div>
          <div className="message-subject-actions">
            {email.messages.length > 1 && (
              <button
                className="icon-button"
                aria-label={allExpanded ? "Collapse all" : "Expand all"}
                title={allExpanded ? "Collapse all" : "Expand all"}
                onClick={() =>
                  setExpanded(
                    allExpanded
                      ? new Set(latest ? [latest.id] : [])
                      : new Set(email.messages.map((message) => message.id)),
                  )
                }
              >
                <Icon
                  name={allExpanded ? "collapseAll" : "expandAll"}
                  size={20}
                />
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Print all"
              title="Print all"
              onClick={() => onAction("print", [email.id])}
            >
              <Icon name="print" size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="Open in new window"
              title="Open in new window"
              onClick={() => onAction("newWindow", [email.id])}
            >
              <Icon name="openInNew" size={20} />
            </button>
          </div>
        </header>
        <div className="message-thread">
          {email.messages.map((message, index) => {
            const open = expanded.has(message.id);
            const attachments = messageAttachments(message, index).filter(
              (attachment) => !attachment.inline,
            );
            const snippet =
              message.format === "html"
                ? new DOMParser().parseFromString(message.body, "text/html")
                    .body.textContent || ""
                : message.body;
            return (
              <article
                className={`message-item ${open ? "message-item-open" : "message-item-collapsed"}`}
                key={message.id}
              >
                <div className="message-avatar" aria-hidden="true">
                  <img src="/icons/person.png" alt="" width={40} height={40} />
                </div>
                {!open ? (
                  <>
                    <button
                      className="message-collapsed-button"
                      onClick={() => toggleMessage(message.id)}
                      aria-label={`Expand message from ${message.from.name}`}
                      aria-expanded={false}
                    >
                      <span className="message-collapsed-top">
                        <strong>{message.from.name}</strong>
                        <time
                          dateTime={message.date}
                          title={displayDate(message.date, true)}
                        >
                          {displayDate(message.date)}
                        </time>
                      </span>
                      <span className="message-snippet">
                        {snippet.replace(/\s+/g, " ").trim()}
                      </span>
                    </button>
                    <button
                      className={`icon-button message-collapsed-star ${email.starred ? "message-starred" : ""}`}
                      title={email.starred ? "Unstar" : "Star"}
                      aria-label={
                        email.starred ? "Unstar message" : "Star message"
                      }
                      onClick={() =>
                        onAction(email.starred ? "unstar" : "star", [email.id])
                      }
                    >
                      <Icon
                        name={email.starred ? "starFilled" : "star"}
                        size={20}
                      />
                    </button>
                  </>
                ) : (
                  <>
                    <header className="message-sender-row">
                      <div className="message-sender-main">
                        <div className="message-sender-line">
                          <button
                            className="message-sender-name"
                            title="Collapse message"
                            aria-expanded={true}
                            onClick={() => toggleMessage(message.id)}
                          >
                            {message.from.name}
                          </button>
                          <span className="message-sender-email">
                            &lt;{message.from.email}&gt;
                          </span>
                          {newsletter && index === 0 && (
                            <button
                              className="message-unsubscribe"
                              onClick={() =>
                                onAction("unsubscribe", [email.id])
                              }
                            >
                              Unsubscribe
                            </button>
                          )}
                        </div>
                        <div className="message-details-wrap">
                          <button
                            className="message-recipient"
                            aria-label="Show details"
                            data-message-menu-trigger
                            aria-expanded={
                              menu?.type === "details" && menu.id === message.id
                            }
                            onClick={(event) =>
                              openMenu(
                                "details",
                                message.id,
                                event.currentTarget,
                              )
                            }
                          >
                            to{" "}
                            {message.to
                              .map((address) =>
                                isMe(address)
                                  ? "me"
                                  : address.name || address.email,
                              )
                              .join(", ") || "me"}
                            <span className="message-details-arrow">
                              <Icon name="formatArrow20" size={20} />
                            </span>
                          </button>
                          {menu?.type === "details" &&
                            menu.id === message.id && (
                              <div
                                className="message-popover message-details"
                                data-message-menu
                                ref={menuPanel}
                                tabIndex={0}
                                role="dialog"
                                aria-label="Message details"
                                style={{ left: menu.left }}
                              >
                                <div className="message-details-inner">
                                  <dl>
                                    <dt>from:</dt>
                                    <dd>
                                      <strong>{message.from.name}</strong>{" "}
                                      <span className="message-details-email">
                                        &lt;{message.from.email}&gt;
                                      </span>
                                    </dd>
                                    <dt>to:</dt>
                                    <dd>
                                      {message.to
                                        .map((address) =>
                                          isMe(address) || !address.name
                                            ? address.email
                                            : `${address.name} <${address.email}>`,
                                        )
                                        .join(", ")}
                                    </dd>
                                    {!!message.cc?.length && (
                                      <>
                                        <dt>cc:</dt>
                                        <dd>
                                          {message.cc
                                            .map(
                                              (address) =>
                                                `${address.name} <${address.email}>`,
                                            )
                                            .join(", ")}
                                        </dd>
                                      </>
                                    )}
                                    {!!message.bcc?.length && (
                                      <>
                                        <dt>bcc:</dt>
                                        <dd>
                                          {message.bcc
                                            .map(
                                              (address) =>
                                                `${address.name} <${address.email}>`,
                                            )
                                            .join(", ")}
                                        </dd>
                                      </>
                                    )}
                                    <dt>date:</dt>
                                    <dd>{displayDate(message.date, true)}</dd>
                                    <dt>subject:</dt>
                                    <dd>{email.subject}</dd>
                                    <dt>mailed-by:</dt>
                                    <dd>{message.from.email.split("@")[1]}</dd>
                                    <dt>signed-by:</dt>
                                    <dd>{message.from.email.split("@")[1]}</dd>
                                    <dt>security:</dt>
                                    <dd>
                                      <Icon name="lockPlain" size={16} />
                                      <span>
                                        Standard encryption (TLS){" "}
                                        <a
                                          href="https://support.google.com/mail/answer/6330403"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          Learn more
                                        </a>
                                      </span>
                                    </dd>
                                  </dl>
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                      <div className="message-sender-actions">
                        {attachments.length > 0 && (
                          <Icon
                            name="attachmentHorizontal"
                            size={20}
                            className="message-header-attachment"
                          />
                        )}
                        <time
                          dateTime={message.date}
                          title={displayDate(message.date, true)}
                        >
                          {displayDate(message.date)}
                        </time>
                        <button
                          className={`icon-button ${email.starred ? "message-starred" : ""}`}
                          aria-label={
                            email.starred ? "Unstar message" : "Star message"
                          }
                          title={email.starred ? "Unstar" : "Star"}
                          onClick={() =>
                            onAction(email.starred ? "unstar" : "star", [
                              email.id,
                            ])
                          }
                        >
                          <Icon
                            name={email.starred ? "starFilled" : "star"}
                            size={20}
                          />
                        </button>
                        <button
                          className="icon-button message-reaction-disabled"
                          aria-label="Add emoji reaction"
                          title="You can't react to this message"
                          disabled
                        >
                          <Icon name="emoji" size={20} />
                        </button>
                        <button
                          className="icon-button message-header-reply"
                          aria-label="Reply"
                          title="Reply"
                          onClick={() => openReply("reply", message)}
                        >
                          <Icon name="reply" size={20} />
                        </button>
                        <div className="message-more-wrap">
                          <button
                            className="icon-button"
                            aria-label="More message options"
                            title="More"
                            data-message-menu-trigger
                            aria-haspopup="menu"
                            aria-expanded={
                              menu?.type === "more" && menu.id === message.id
                            }
                            onClick={(event) =>
                              openMenu("more", message.id, event.currentTarget)
                            }
                          >
                            <Icon name="more" size={20} />
                          </button>
                          {menu?.type === "more" && menu.id === message.id && (
                            <div
                              className="message-popover message-more-menu"
                              data-message-menu
                              ref={menuPanel}
                              role="menu"
                              aria-label="Message options"
                            >
                              <button
                                role="menuitem"
                                onClick={() => openReply("reply", message)}
                              >
                                <Icon name="reply" size={18} />
                                Reply
                              </button>
                              <button
                                role="menuitem"
                                onClick={() => openReply("replyAll", message)}
                              >
                                <Icon name="replyAll" size={18} />
                                Reply all
                              </button>
                              <button
                                role="menuitem"
                                onClick={() => openReply("forward", message)}
                              >
                                <Icon name="forward" size={18} />
                                Forward
                              </button>
                              <hr />
                              <button
                                role="menuitem"
                                onClick={() => {
                                  setMenu(null);
                                  onAction("print", [email.id]);
                                }}
                              >
                                <Icon name="print" size={18} />
                                Print
                              </button>
                              <button
                                role="menuitem"
                                onClick={() => {
                                  setMenu(null);
                                  onAction("delete", [email.id]);
                                }}
                              >
                                <Icon name="trash" size={18} />
                                Delete conversation
                              </button>
                              <button
                                role="menuitem"
                                onClick={() => {
                                  setMenu(null);
                                  onAction("unread", [email.id]);
                                }}
                              >
                                Mark as unread
                              </button>
                              <button
                                role="menuitem"
                                onClick={() => {
                                  setMenu(null);
                                  onAction(
                                    "filterSender",
                                    [email.id],
                                    message.from.email,
                                  );
                                }}
                              >
                                Filter messages like this
                              </button>
                              <button
                                role="menuitem"
                                onClick={() => {
                                  setMenu(null);
                                  onAction(
                                    "spam",
                                    [email.id],
                                    message.from.email,
                                  );
                                }}
                              >
                                Block {message.from.name}
                              </button>
                              {newsletter && (
                                <button
                                  role="menuitem"
                                  onClick={() => {
                                    setMenu(null);
                                    onAction("unsubscribe", [email.id]);
                                  }}
                                >
                                  Unsubscribe
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </header>
                    <div className="message-body">
                      {message.format === "html" ? (
                        <HtmlMessage html={message.body} />
                      ) : (
                        <PlainMessage body={message.body} />
                      )}
                    </div>
                    {attachments.length > 0 && (
                      <div className="message-attachments">
                        <div className="message-attachment-heading">
                          <strong>
                            {attachments.length === 1
                              ? "One attachment"
                              : `${attachments.length} Attachments`}
                          </strong>
                          <span>{"\u00b7"}</span>
                          <span>Scanned by Gmail</span>
                          <span
                            className="message-scan-info"
                            title="Attachments are scanned for viruses"
                            aria-label="Attachments are scanned for viruses"
                          >
                            <Icon name="scanInfo" size={16} />
                          </span>
                          <button
                            className="icon-button"
                            aria-label="Download all attachments"
                            title="Download all attachments"
                            onClick={() =>
                              void downloadAttachments(attachments)
                            }
                          >
                            <Icon name="downloadAttachment" size={20} />
                          </button>
                          <button
                            className="message-add-all-drive"
                            onClick={() => saveToDrive(attachments)}
                          >
                            <AttachmentDriveIcon />
                            Add all to Drive
                          </button>
                        </div>
                        <div className="message-attachment-grid">
                          {attachments.map((attachment) => (
                            <div
                              className={`message-attachment message-attachment-${attachment.type} ${/\.csv$/i.test(attachment.name) ? "message-attachment-spreadsheet" : ""}`}
                              key={attachment.id}
                            >
                              <button
                                className="message-attachment-preview"
                                onClick={() => setPreview(attachment)}
                                aria-label={`Preview ${attachment.name}`}
                              >
                                {attachment.type === "image" &&
                                /^data:image\/(png|jpeg|gif|webp);base64,/i.test(
                                  attachment.url || "",
                                ) ? (
                                  <span className="message-attachment-thumbnail">
                                    <img src={attachment.url} alt="" />
                                  </span>
                                ) : (
                                  <span className="message-attachment-thumbnail">
                                    <span className="message-attachment-paper">
                                      <strong>{attachment.name}</strong>
                                      <span>
                                        {attachment.previewText || ""}
                                      </span>
                                    </span>
                                  </span>
                                )}
                                <span className="message-attachment-meta">
                                  <Icon
                                    name={
                                      attachment.type === "pdf"
                                        ? "mimePdf"
                                        : attachment.type === "image" ? "mimeImage" : "document"
                                    }
                                    size={16}
                                  />
                                  <span className="message-attachment-name">
                                    {attachment.name}
                                  </span>
                                </span>
                                <span className="message-attachment-size">
                                  {attachment.size}
                                </span>
                              </button>
                              <div className="message-attachment-actions">
                                <a
                                  className="icon-button"
                                  aria-label={`Download ${attachment.name}`}
                                  title="Download"
                                  href={localAttachmentUrl(attachment)}
                                  download={
                                    attachment.url
                                      ? attachment.name
                                      : `${attachment.name}.txt`
                                  }
                                >
                                  <Icon name="downloadAttachment" size={20} />
                                </a>
                                <button
                                  className="icon-button"
                                  aria-label={`Add attachment to Drive ${attachment.name}`}
                                  title={
                                    driveFiles.some(
                                      (file) => file.id === attachment.id,
                                    )
                                      ? "Added to My Drive"
                                      : "Add to Drive"
                                  }
                                  onClick={() => saveToDrive([attachment])}
                                >
                                  <AttachmentDriveIcon />
                                </button>
                                {/\.csv$/i.test(attachment.name) && (
                                  <button
                                    className="icon-button"
                                    aria-label={`Edit attachment with Google Sheets ${attachment.name}`}
                                    title="Edit with Google Sheets"
                                    onClick={() => setPreview(attachment)}
                                  >
                                    <svg
                                      viewBox="0 -960 960 960"
                                      width={20}
                                      height={20}
                                      fill="currentColor"
                                      aria-hidden="true"
                                    >
                                      <path d="M216-216h51L642-591l-51-51L216-267v51Zm-72,72V-297L642-795q11-11 23.84-16t27-5T720-811t24,16l51,51q11,11 16,24t5,26.54q0,14.44-5.02,27.53T795-642L297-144H144ZM744-693l-51-51l51,51ZM616.05-616.05L591-642l51,51l-25.95-25.05Z" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
        <div className="message-bottom">
          {replyMode && !replyDocked ? (
            <div
              className={`message-inline-reply ${reply.html.includes("---------- Forwarded message ---------") ? "message-inline-forward" : ""}`}
              ref={replyShell}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  sendReply();
                }
                if (
                  (event.metaKey || event.ctrlKey) &&
                  event.key.toLowerCase() === "k"
                ) {
                  event.preventDefault();
                  insertReplyLink();
                }
              }}
            >
              <div
                className="message-avatar message-reply-avatar"
                aria-hidden="true"
              >
                R
              </div>
              <div className="message-reply-recipient">
                <div className="message-reply-mode">
                  <button
                    className="icon-button"
                    data-message-menu-trigger
                    title="Type of response"
                    aria-label="Type of response"
                    aria-haspopup="menu"
                    aria-expanded={menu?.type === "reply"}
                    onClick={(event) =>
                      openMenu("reply", email.id, event.currentTarget)
                    }
                  >
                    <Icon name={replyMode} size={20} />
                    <Icon name="arrowDropDown" size={20} />
                  </button>
                  {menu?.type === "reply" && (
                    <div
                      className="message-popover message-reply-menu"
                      data-message-menu
                      ref={menuPanel}
                      role="menu"
                    >
                      {(
                        [
                          "reply",
                          ...(canReplyAll ? ["replyAll"] : []),
                          "forward",
                        ] as ReplyMode[]
                      ).map((mode) => (
                        <button
                          key={mode}
                          role="menuitem"
                          onClick={() => openReply(mode)}
                        >
                          <Icon name={mode} size={20} />
                          {mode === "replyAll"
                            ? "Reply all"
                            : mode === "forward"
                              ? "Forward"
                              : "Reply"}
                        </button>
                      ))}
                      <div className="gmail-compose-menu-divider" />
                      <button
                        role="menuitem"
                        className="message-response-text"
                        onClick={() => popoutReply(true)}
                      >
                        Edit subject
                      </button>
                      <button
                        role="menuitem"
                        className="message-response-text"
                        onClick={() => popoutReply()}
                      >
                        Pop out reply
                      </button>
                    </div>
                  )}
                </div>
                {recipientsExpanded ? (
                  <RecipientField
                    label="To"
                    value={reply.to}
                    contacts={contacts}
                    autoFocus={replyMode === "forward"}
                    onChange={(to) => updateReply({ to })}
                  />
                ) : (
                  <button
                    className="message-reply-summary"
                    aria-label="Open recipients"
                    onClick={() => {
                      setRecipientsExpanded(true);
                      requestAnimationFrame(() =>
                        replyShell.current
                          ?.querySelector<HTMLInputElement>(
                            'input[aria-label="To"]',
                          )
                          ?.focus(),
                      );
                    }}
                  >
                    {[reply.to, reply.cc, reply.bcc]
                      .flatMap(splitRecipients)
                      .map((value) => {
                        const address = recipientAddress(value);
                        const name =
                          address.name ||
                          contacts.find(
                            (contact) =>
                              contact.email.toLowerCase() ===
                              address.email.toLowerCase(),
                          )?.name;
                        return name
                          ? `${name} (${address.email})`
                          : address.email;
                      })
                      .join(", ") || "Recipients"}
                  </button>
                )}
                {recipientsExpanded && (
                  <div className="message-reply-recipient-toggles">
                    {!showCc && (
                      <button
                        onClick={() => {
                          setShowCc(true);
                          requestAnimationFrame(() =>
                            replyShell.current
                              ?.querySelector<HTMLInputElement>(
                                'input[aria-label="Cc"]',
                              )
                              ?.focus(),
                          );
                        }}
                      >
                        Cc
                      </button>
                    )}
                    {!showBcc && (
                      <button
                        onClick={() => {
                          setShowBcc(true);
                          requestAnimationFrame(() =>
                            replyShell.current
                              ?.querySelector<HTMLInputElement>(
                                'input[aria-label="Bcc"]',
                              )
                              ?.focus(),
                          );
                        }}
                      >
                        Bcc
                      </button>
                    )}
                  </div>
                )}
                <button
                  className="icon-button message-reply-popout"
                  aria-label="Open in a pop-up"
                  title="Open in a pop-up"
                  onClick={() => popoutReply()}
                >
                  <Icon name="replyPopout" size={20} />
                </button>
              </div>
              {recipientsExpanded && (
                <div className="message-reply-extra-recipients">
                  {showCc && (
                    <RecipientField
                      label="Cc"
                      value={reply.cc}
                      contacts={contacts}
                      onChange={(cc) => updateReply({ cc })}
                    />
                  )}
                  {showBcc && (
                    <RecipientField
                      label="Bcc"
                      value={reply.bcc}
                      contacts={contacts}
                      onChange={(bcc) => updateReply({ bcc })}
                    />
                  )}
                </div>
              )}
              <div
                className="message-reply-editor-wrap"
                onFocus={() => {
                  if (reply.to.trim()) setRecipientsExpanded(false);
                }}
                onClick={(event) => {
                  const button = (event.target as Element).closest(
                    ".gmail-trimmed-button",
                  );
                  if (button?.getAttribute("aria-expanded") === "false") {
                    const content = replyEditor.current?.getContent();
                    if (content) updateReply(content);
                  }
                }}
              >
                <RichTextEditor
                  editorRef={replyEditor}
                  label="Reply body"
                  body={reply.body}
                  html={reply.html}
                  className="message-reply-editor"
                  plainText={plainText}
                  trimQuote={
                    !reply.html.includes(
                      "---------- Forwarded message ---------",
                    )
                  }
                  onChange={(body, html) => updateReply({ body, html })}
                  onFiles={(files) => void attachFiles(files)}
                />
              </div>
              {reply.attachments.some((attachment) => !attachment.inline) && (
                <div className="message-reply-attachments gmail-compose-attachments">
                  {reply.attachments
                    .filter((attachment) => !attachment.inline)
                    .map((attachment) => (
                      <div
                        className="gmail-compose-attached-file"
                        key={attachment.id}
                      >
                        <Icon name="attachment" size={20} />
                        <span>{attachment.name}</span>
                        <small>({attachment.size})</small>
                        <button
                          aria-label={`Remove ${attachment.name}`}
                          onClick={() =>
                            updateReply({
                              attachments: reply.attachments.filter(
                                (item) => item.id !== attachment.id,
                              ),
                            })
                          }
                        >
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                    ))}
                </div>
              )}
              {loadingFiles && (
                <p className="message-reply-loading" role="status">
                  Attaching files...
                </p>
              )}
              {formatting && (
                <FormattingToolbar
                  editorRef={replyEditor}
                  disabled={plainText}
                />
              )}
              <div className="message-reply-controls">
                {reply.confidential && (
                  <div className="gmail-compose-confidential-banner">
                    <span className="gmail-confidential-banner-icon">
                      <Icon name="lock" size={24} />
                    </span>
                    <div>
                      <span>
                        Content expires{" "}
                        {new Date(
                          reply.confidential.expiresAt,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <p>
                        Recipients won&apos;t have the option to forward, copy,
                        print, or download this email.
                      </p>
                    </div>
                    <button
                      className="gmail-dialog-text"
                      onClick={() => setDialog("confidential")}
                    >
                      Edit
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Remove confidential mode"
                      onClick={() => updateReply({ confidential: undefined })}
                    >
                      <Icon name="close" size={20} />
                    </button>
                  </div>
                )}
                {warningReady && outsideRecipient && !warningDismissed && (
                  <div className="message-reply-warning">
                    <Icon
                      name="recipientWarning"
                      size={24}
                      className="message-warning-glyph"
                    />
                    <span>
                      <strong>
                        Be cautious about sharing sensitive information.
                      </strong>{" "}
                      {outsideRecipient.email} is outside of your organization
                      and isn&apos;t in your contacts.
                    </span>
                    <button
                      aria-label="Dismiss warning"
                      onClick={() => setWarningDismissed(true)}
                    >
                      <Icon name="close" size={20} />
                    </button>
                  </div>
                )}
                <div className="message-reply-toolbar">
                  <div
                    className={`gmail-compose-send-group ${reply.confidential ? "gmail-compose-send-single" : ""}`}
                  >
                    <button
                      className="gmail-compose-send"
                      onClick={() => sendReply()}
                    >
                      Send
                    </button>
                    {!reply.confidential && (
                      <button
                        className="gmail-compose-send-caret"
                        aria-label="More send options"
                        title="More send options"
                        aria-haspopup="menu"
                        aria-expanded={toolMenu?.name === "send"}
                        onClick={(event) =>
                          openToolMenu("send", event.currentTarget)
                        }
                      >
                        <Icon name="arrowDropDown" size={20} />
                      </button>
                    )}
                  </div>
                  <div className="gmail-compose-tools">
                    {footerTool(
                      "format",
                      "Formatting options",
                      () => setFormatting((value) => !value),
                      formatting,
                    )}
                    {footerTool("attachment", "Attach files", () =>
                      fileInput.current?.click(),
                    )}
                    {footerTool("link", "Insert link", insertReplyLink)}
                    {footerTool("emoji", "Insert emoji", (button) =>
                      openToolMenu("emoji", button),
                    )}
                    {footerTool("drive", "Insert files using Drive", () =>
                      setDialog("drive"),
                    )}
                    {footerTool("photo", "Insert photo", () =>
                      setDialog("photo"),
                    )}
                    {footerTool(
                      "lock",
                      "Toggle confidential mode",
                      () => setDialog("confidential"),
                      Boolean(reply.confidential),
                    )}
                    {footerTool("signature", "Insert signature", (button) =>
                      openToolMenu("signature", button),
                    )}
                    {footerTool("more", "More compose options", (button) =>
                      openToolMenu("more", button),
                    )}
                  </div>
                  <button
                    className="gmail-compose-tool message-reply-discard"
                    title="Discard draft"
                    aria-label="Discard draft"
                    onClick={() => {
                      onDiscardReply(email.id);
                      clearReply();
                    }}
                  >
                    <Icon name="trash" size={20} />
                  </button>
                </div>
              </div>
              <input
                ref={fileInput}
                className="gmail-compose-file-input"
                type="file"
                multiple
                aria-label="Choose attachments"
                onChange={(event) => void attachFiles(event.target.files)}
              />
              <input
                ref={photoInput}
                className="gmail-compose-file-input"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/gif,image/webp"
                aria-label="Choose photos"
                onChange={(event) => void attachFiles(event.target.files, true)}
              />
            </div>
          ) : (
            <div className="message-footer-actions">
              <button onClick={() => openReply("reply")}>
                <Icon name="reply" size={20} />
                Reply
              </button>
              {canReplyAll && (
                <button onClick={() => openReply("replyAll")}>
                  <Icon name="replyAll" size={20} />
                  Reply all
                </button>
              )}
              <button onClick={() => openReply("forward")}>
                <Icon name="forward" size={20} />
                Forward
              </button>
              <button
                className="message-footer-reaction"
                aria-label="Add emoji reaction"
                title="You can't react to this message"
                disabled
              >
                <Icon name="emoji" size={20} />
              </button>
            </div>
          )}
          {notice && (
            <div className="message-notice" role="status">
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      {toolMenu &&
        createPortal(
          <div
            ref={toolPanel}
            className={`gmail-compose-menu gmail-compose-menu-${toolMenu.name} message-compose-menu`}
            role={toolMenu.name === "emoji" ? "dialog" : "menu"}
            aria-label={
              toolMenu.name === "send"
                ? "More send options"
                : toolMenu.name === "emoji"
                  ? "Emoji picker"
                  : toolMenu.name === "signature"
                    ? "Insert signature"
                    : toolMenu.name === "label"
                      ? "Label as"
                      : "More compose options"
            }
            style={{ left: toolMenu.x, top: toolMenu.y }}
          >
            {toolMenu.name === "send" && (
              <button
                role="menuitem"
                onClick={() => {
                  setToolMenu(null);
                  setDialog("schedule");
                }}
              >
                <Icon name="scheduleSend" size={20} />
                <span>Schedule send</span>
              </button>
            )}
            {toolMenu.name === "emoji" && (
              <EmojiPicker
                onInsert={(emoji) => {
                  replyEditor.current?.command("insertText", emoji);
                  setToolMenu(null);
                }}
              />
            )}
            {toolMenu.name === "signature" && (
              <>
                <button
                  role="menuitem"
                  onClick={() => {
                    setToolMenu(null);
                    setDialog("signature");
                  }}
                >
                  Manage signatures
                </button>
                <div className="gmail-compose-menu-divider" />
                <button
                  role="menuitemradio"
                  aria-checked={!reply.html.includes('class="gmail_signature"')}
                  onClick={() => {
                    replyEditor.current?.setSignature("");
                    setToolMenu(null);
                  }}
                >
                  <span className="gmail-signature-check">
                    {!reply.html.includes('class="gmail_signature"') && (
                      <Icon name="check" size={20} />
                    )}
                  </span>
                  <span>No signature</span>
                </button>
                {signature && (
                  <button
                    role="menuitemradio"
                    aria-checked={reply.html.includes(
                      'class="gmail_signature"',
                    )}
                    onClick={() => {
                      replyEditor.current?.setSignature(signature);
                      setToolMenu(null);
                    }}
                  >
                    <span className="gmail-signature-check">
                      {reply.html.includes('class="gmail_signature"') && (
                        <Icon name="check" size={20} />
                      )}
                    </span>
                    <span>My signature</span>
                  </button>
                )}
              </>
            )}
            {toolMenu.name === "more" && (
              <>
                <button
                  role="menuitemcheckbox"
                  aria-checked={plainText}
                  onClick={() => {
                    setPlainText((value) => !value);
                    setToolMenu(null);
                  }}
                >
                  <span className="gmail-signature-check">
                    {plainText && <Icon name="check" size={20} />}
                  </span>
                  <span>Plain text mode</span>
                </button>
                <div className="gmail-compose-menu-divider" />
                <button
                  role="menuitem"
                  onClick={() => {
                    setToolMenu(null);
                    replyShell.current?.setAttribute(
                      "data-print-reply",
                      "true",
                    );
                    window.print();
                    replyShell.current?.removeAttribute("data-print-reply");
                  }}
                >
                  <Icon name="print" size={20} />
                  <span>Print</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setToolMenu(null);
                    replyEditor.current?.focus();
                  }}
                >
                  <Icon name="spellCheck" size={20} />
                  <span>Spell check</span>
                </button>
                <div className="gmail-compose-menu-divider" />
                <button
                  role="menuitem"
                  aria-haspopup="menu"
                  onClick={(event) =>
                    openToolMenu("label", event.currentTarget)
                  }
                >
                  <Icon name="label" size={20} />
                  <span>Label</span>
                  <Icon name="arrowRight" size={20} />
                </button>
              </>
            )}
            {toolMenu.name === "label" && (
              <>
                <div className="gmail-compose-label-title">Label as:</div>
                <input
                  aria-label="Search labels"
                  value={labelQuery}
                  onChange={(event) => setLabelQuery(event.target.value)}
                />
                {labels
                  .filter((label) =>
                    label.name.toLowerCase().includes(labelQuery.toLowerCase()),
                  )
                  .map((label) => (
                    <button
                      key={label.id}
                      role="menuitemcheckbox"
                      aria-checked={replyLabels.includes(label.id)}
                      onClick={() =>
                        setReplyLabels((current) =>
                          current.includes(label.id)
                            ? current.filter((id) => id !== label.id)
                            : [...current, label.id],
                        )
                      }
                    >
                      <Icon
                        name={
                          replyLabels.includes(label.id)
                            ? "checkboxChecked"
                            : "checkbox"
                        }
                        size={20}
                      />
                      <span>{label.name}</span>
                    </button>
                  ))}
                <div className="gmail-compose-menu-divider" />
                <button
                  role="menuitem"
                  onClick={() => {
                    replyLabels
                      .filter((id) => !email.labels.includes(id))
                      .forEach((id) => onAction("label", [email.id], id));
                    email.labels
                      .filter((id) => !replyLabels.includes(id))
                      .forEach((id) => onAction("unlabel", [email.id], id));
                    setToolMenu(null);
                  }}
                >
                  Apply
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
      {link && (
        <InsertLinkPopover
          {...link}
          onApply={(text, url) => {
            replyEditor.current?.insertLink(text, url);
            setLink(null);
          }}
          onClose={() => {
            setLink(null);
            replyEditor.current?.focus();
          }}
        />
      )}
      {replyError && (
        <ComposeAlert
          message={replyError}
          onClose={() => {
            setReplyError("");
            if (/recipient|address/i.test(replyError)) {
              setRecipientsExpanded(true);
              requestAnimationFrame(() =>
                replyShell.current
                  ?.querySelector<HTMLInputElement>('input[aria-label="To"]')
                  ?.focus(),
              );
            }
          }}
        />
      )}
      {dialog === "confidential" && (
        <ConfidentialDialog
          value={reply.confidential}
          onSave={(confidential) => {
            updateReply({ confidential });
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "schedule" && (
        <ScheduleSendDialog
          onSchedule={sendReply}
          onClose={() => setDialog(null)}
        />
      )}
      {(dialog === "drive" || dialog === "photo") && (
        <ComposeFilePicker
          mode={dialog}
          files={[...driveFiles, ...email.attachments, ...reply.attachments]
            .filter(
              (file, index, files) =>
                files.findIndex((candidate) => candidate.id === file.id) ===
                index,
            )
            .map((file) =>
              file.type === "image" &&
              !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(
                file.url || "",
              ) &&
              !file.url?.startsWith(`blob:${window.location.origin}/`)
                ? { ...file, url: undefined }
                : file,
            )}
          onInsert={(file) => {
            const inline = dialog === "photo" && file.type === "image";
            updateReply({
              attachments: [
                ...replyCurrent.current.attachments.filter(
                  (attachment) => attachment.id !== file.id,
                ),
                { ...file, inline },
              ],
            });
            if (inline && file.url)
              replyEditor.current?.command(
                "insertHTML",
                `<img src="${file.url}" alt="${textHtml(file.name)}" style="max-width:100%;height:auto">`,
              );
            setDialog(null);
          }}
          onUpload={() =>
            dialog === "photo"
              ? photoInput.current?.click()
              : fileInput.current?.click()
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "signature" && (
        <ComposeModal
          title="Manage signatures"
          className="gmail-signature-dialog"
          onClose={() => setDialog(null)}
        >
          <h2>Manage signatures</h2>
          <label htmlFor={`reply-signature-${email.id}`}>My signature</label>
          <textarea
            id={`reply-signature-${email.id}`}
            aria-label="Signature"
            value={signature}
            onChange={(event) => setSignature(event.target.value)}
          />
          <div className="gmail-dialog-actions">
            <button
              className="gmail-dialog-text"
              onClick={() => setDialog(null)}
            >
              Cancel
            </button>
            <button
              className="gmail-dialog-primary"
              onClick={() => {
                localStorage.setItem("gopen-compose-signature", signature);
                setDialog(null);
              }}
            >
              Save
            </button>
          </div>
        </ComposeModal>
      )}
      {preview && (
        <AttachmentPreview
          attachment={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}
