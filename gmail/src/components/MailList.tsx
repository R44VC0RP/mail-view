import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { Attachment, Density, Email, Label, OnAction } from "../types";
import { Icon } from "../ui/Icon";
import { labelPath, MailMenu } from "./MailMenus";
import type { MailMenuKind, MenuPosition } from "./MailMenus";
import "./mail-list.css";
import "./chrome-fidelity.css";

export type MailListProps = {
  emails: Email[];
  selectedIds: Set<string>;
  labels: Label[];
  onSelect: (id: string, shift: boolean) => void;
  onContextSelect?: (id: string) => void;
  onManageLabels?: () => void;
  onOpen: (email: Email) => void;
  onAction: OnAction;
  density: Density;
};

function labelForeground(color: string) {
  if (color.toLowerCase() === "#e2e3e3") return "#444746";
  const hex = color.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#444746";
  const luminance = [0, 2, 4].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return luminance[0] * 0.2126 + luminance[1] * 0.7152 + luminance[2] * 0.0722 > 0.179
    ? "#202124"
    : "#fff";
}

function AttachmentPreview({
  attachment,
  email,
  onClose,
}: {
  attachment: Attachment;
  email: Email;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const closePreview = useEffectEvent(onClose);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    const keyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePreview();
      }
      if (event.key === "Tab") {
        const controls = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button, a[href], input, [tabindex="0"]',
          ) ?? [],
        );
        if (!controls.length) return;
        const index = controls.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          controls[controls.length - 1]?.focus();
        } else if (!event.shiftKey && index === controls.length - 1) {
          event.preventDefault();
          controls[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", keyDown);
    const mock = new Blob(
      [
        `Local Gmail demo attachment\n\nFile: ${attachment.name}\nFrom: ${email.sender} <${email.senderEmail}>\nSubject: ${email.subject}\n\n${email.snippet}\n\nThis is a generated local sample, not the original attachment.\n`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(mock);
    setDownloadUrl(url);
    return () => {
      document.removeEventListener("keydown", keyDown);
      URL.revokeObjectURL(url);
      previous?.focus();
    };
  }, [attachment, email]);

  return createPortal(
    <div
      className="mail-preview-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className="mail-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mail-preview-title"
      >
        <header className="mail-preview-header">
          <Icon name={attachment.type === "pdf" ? "mimePdf" : attachment.type === "image" ? "mimeImage" : attachment.type === "calendar" ? "calendar" : "document"} size={20} />
          <h2 id="mail-preview-title">{attachment.name}</h2>
          <a
            className="icon-button"
            href={attachment.url || downloadUrl}
            download={
              attachment.url ? attachment.name : `${attachment.name}.sample.txt`
            }
            title={
              attachment.url ? "Download attachment" : "Download local sample"
            }
            aria-label={
              attachment.url ? "Download attachment" : "Download local sample"
            }
          >
            <Icon name="download" size={20} />
          </a>
          <button
            type="button"
            className="icon-button"
            title="Close preview"
            aria-label="Close preview"
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="mail-preview-content">
          {attachment.url && attachment.type === "image" ? (
            <img src={attachment.url} alt={attachment.name} />
          ) : (
            <article className="mail-preview-paper">
              <Icon name={attachment.type === "pdf" ? "mimePdf" : attachment.type === "calendar" ? "calendar" : "document"} size={32} />
              <h3>{attachment.name}</h3>
              <p className="mail-preview-meta">
                {attachment.size} &middot; From {email.sender}
              </p>
              <h4>{email.subject}</h4>
              <p>{email.snippet}</p>
              <div className="mail-preview-notice">
                {attachment.previewText
                  ? "1 page"
                  : attachment.url
                    ? "A preview is not available for this file type. Use Download to open the attachment locally."
                    : "Local sample preview. The original attachment is not included in this demo. Download creates a clearly marked text sample."}
              </div>
            </article>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MailList({
  emails,
  selectedIds,
  labels,
  onSelect,
  onContextSelect,
  onManageLabels,
  onOpen,
  onAction,
  density,
}: MailListProps) {
  const [menu, setMenu] = useState<{
    kind: MailMenuKind;
    email: Email;
    position: MenuPosition;
    ids?: string[];
  } | null>(null);
  const [preview, setPreview] = useState<{
    attachment: Attachment;
    email: Email;
  } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focusTarget = emails.some((email) => email.id === focusedId)
    ? focusedId
    : emails[0]?.id;

  const contextMenu = (email: Email, position: MenuPosition) => {
    const ids = selectedIds.has(email.id) ? [...selectedIds] : [email.id];
    if (!selectedIds.has(email.id)) {
      if (onContextSelect) onContextSelect(email.id);
      else {
        for (const id of selectedIds) onSelect(id, false);
        onSelect(email.id, false);
      }
    }
    setMenu({ kind: "context", email, position, ids });
  };

  const rowKeyDown = (event: KeyboardEvent<HTMLDivElement>, email: Email) => {
    if (event.target !== event.currentTarget) return;
    const fromGrid = event.currentTarget === list.current;
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen(email);
    } else if (event.key === " ") {
      event.preventDefault();
      onSelect(email.id, event.shiftKey);
    } else if (
      (event.shiftKey && event.key === "F10") ||
      event.key === "ContextMenu"
    ) {
      event.preventDefault();
      const row = fromGrid
        ? Array.from(list.current?.querySelectorAll<HTMLElement>("[data-email-id]") ?? [])
            .find((element) => element.dataset.emailId === email.id)
        : event.currentTarget;
      const rect = (row ?? event.currentTarget).getBoundingClientRect();
      contextMenu(email, { x: rect.left + 76, y: rect.top + 20 });
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const rows = Array.from(
        list.current?.querySelectorAll<HTMLElement>("[data-email-id]") ?? [],
      );
      const index = fromGrid
        ? emails.findIndex((item) => item.id === email.id)
        : rows.indexOf(event.currentTarget);
      const next = Math.max(
        0,
        Math.min(
          rows.length - 1,
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? rows.length - 1
              : index + (event.key === "ArrowDown" ? 1 : -1),
        ),
      );
      if (fromGrid) {
        setFocusedId(emails[next]?.id ?? null);
        rows[next]?.scrollIntoView({ block: "nearest" });
      } else rows[next]?.focus();
    }
  };

  const hoverSnooze = (event: MouseEvent<HTMLButtonElement>, email: Email) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({
      kind: "snooze",
      email,
      position: { x: rect.left, y: rect.bottom },
    });
  };

  return (
    <div
      ref={list}
      className={`mail-list mail-list--${density}`}
      role="grid"
      aria-label="Messages"
      aria-multiselectable="true"
      aria-rowcount={emails.length}
      tabIndex={0}
      aria-activedescendant={focusTarget ? `mail-row-${focusTarget}` : undefined}
      onKeyDown={(event) => {
        const email = emails.find((item) => item.id === focusTarget);
        if (email) rowKeyDown(event, email);
      }}
    >
      {!emails.length && (
        <div className="mail-list-empty">No conversations in this mailbox.</div>
      )}
      {emails.map((email, index) => {
        const selected = selectedIds.has(email.id);
        const standaloneDraft = email.folder === "drafts" && !email.scheduledFor && !(email.replyToId && email.hasDraft);
        const sender = standaloneDraft
          ? email.messages[0]?.to.map((address) => address.name || address.email).join(", ") || ""
          : email.sender;
        const chipAttachments = email.attachments.filter(
          (attachment) => !attachment.inline && attachment.type !== "calendar",
        );
        const hasChips = density === "default" && chipAttachments.length > 0;
        const emailLabels = email.labels
          .map((id) => labels.find((label) => label.id === id))
          .filter((label): label is Label => Boolean(label) && label?.messageVisible !== false);
        return (
          <div
            key={email.id}
            id={`mail-row-${email.id}`}
            data-email-id={email.id}
            className={`mail-row${email.unread ? " mail-row--unread" : ""}${selected ? " mail-row--selected" : ""}${hasChips ? " mail-row--attachments" : ""}${email.id === focusTarget ? " mail-row--focused" : ""}`}
            role="row"
            aria-rowindex={index + 1}
            aria-selected={selected}
            aria-label={`${email.unread ? "Unread, " : ""}${email.starred ? "Starred, " : ""}${email.sender}, ${email.subject}, ${email.time}${email.attachments.length ? ", Has attachments" : ""}`}
            tabIndex={-1}
            onFocus={(event) => {
              if (event.target === event.currentTarget) setFocusedId(email.id);
            }}
            draggable
            onDragStart={(event) => {
              const ids = selectedIds.has(email.id) ? [...selectedIds] : [email.id];
              event.dataTransfer.setData(
                "application/x-gopen-messages",
                JSON.stringify(ids),
              );
              event.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => onOpen(email)}
            onKeyDown={(event) => rowKeyDown(event, email)}
            onContextMenu={(event) => {
              event.preventDefault();
              contextMenu(email, { x: event.clientX, y: event.clientY });
            }}
          >
            <div className="mail-row-main">
              <span className="mail-row-grip" aria-hidden="true" />
              <div className="mail-row-checkbox-cell" role="gridcell">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={`Select ${email.subject}`}
                  title="Select"
                  className="mail-row-checkbox"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(email.id, event.shiftKey);
                  }}
                >
                  <Icon
                    name={selected ? "checkboxChecked" : "checkbox"}
                    size={20}
                  />
                </button>
              </div>
              <div className="mail-row-star-cell" role="gridcell">
                <button
                  type="button"
                  className={`mail-row-star${email.starred ? " mail-row-star--active" : ""}`}
                  aria-label={email.starred ? "Unstar" : "Star"}
                  aria-pressed={email.starred}
                  title={email.starred ? "Starred" : "Not starred"}
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAction(email.starred ? "unstar" : "star", [email.id]);
                  }}
                >
                  <Icon
                    name={email.starred ? "starFilled" : "star"}
                    size={20}
                  />
                </button>
              </div>
              <div
                className="mail-row-sender"
                role="gridcell"
                title={`${email.sender} <${email.senderEmail}>`}
              >
                {sender}
                {(email.hasDraft ||
                  (email.folder === "drafts" && !email.scheduledFor)) && (
                  <span className="mail-row-draft">
                    {sender ? ", Draft" : "Draft"}
                  </span>
                )}
                {email.messages.length > 1 && (
                  <span className="mail-row-message-count">
                    {" "}
                    {email.messages.length}
                  </span>
                )}
              </div>
              <div className="mail-row-content" role="gridcell">
                {emailLabels.map((label) => {
                  const fullName = labelPath(label, labels);
                  const parts = fullName.split("/");
                  const name =
                    fullName.length > 24 && parts.length > 2
                      ? `${parts[0]}/\u2026/${parts[parts.length - 1]}`
                      : fullName;
                  return (
                    <span
                      key={label.id}
                      className="mail-row-label"
                      title={fullName}
                      style={
                        label.color
                          ? {
                              backgroundColor: label.color,
                              color: label.textColor || labelForeground(label.color),
                            }
                          : undefined
                      }
                    >
                      {name}
                    </span>
                  );
                })}
                <span className="mail-row-subject">
                  {email.subject || "(no subject)"}
                </span>
                {email.snippet && (
                  <span className="mail-row-snippet">
                    {" - "}
                    {email.snippet}
                  </span>
                )}
              </div>
              <div className="mail-row-date" role="gridcell">
                <span className="mail-row-file-indicator">
                  {email.attachments.length > 0 && (
                    <Icon
                      name={email.attachments.some((attachment) => attachment.type === "calendar") ? "calendar" : "attachmentHorizontal"}
                      size={20}
                    />
                  )}
                </span>
                <span title={email.date}>{email.time}</span>
              </div>
              <div
                className="mail-row-hover-actions"
                onClick={(event) => event.stopPropagation()}
              >
                {email.category === "promotions" && (
                  <button
                    type="button"
                    className="mail-row-unsubscribe"
                    tabIndex={-1}
                    onClick={() => onAction("unsubscribe", [email.id])}
                  >
                    Unsubscribe
                  </button>
                )}
                <button
                  type="button"
                  className="icon-button"
                  title="Archive"
                  aria-label="Archive"
                  tabIndex={-1}
                  onClick={() => onAction("archive", [email.id])}
                >
                  <Icon name="archive" size={20} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  title="Delete"
                  aria-label="Delete"
                  tabIndex={-1}
                  onClick={() => onAction("delete", [email.id])}
                >
                  <Icon name="trash" size={20} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  title={email.unread ? "Mark as read" : "Mark as unread"}
                  aria-label={email.unread ? "Mark as read" : "Mark as unread"}
                  tabIndex={-1}
                  onClick={() =>
                    onAction(email.unread ? "read" : "unread", [email.id])
                  }
                >
                  <Icon
                    name={email.unread ? "mailOpen" : "mailUnreadIndicator"}
                    size={20}
                  />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  title="Snooze"
                  aria-label="Snooze"
                  aria-haspopup="menu"
                  tabIndex={-1}
                  onClick={(event) => hoverSnooze(event, email)}
                >
                  <Icon name="clock" size={20} />
                </button>
              </div>
            </div>
            {hasChips && (
              <div className="mail-row-attachment-chips" role="gridcell">
                {chipAttachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    className="mail-attachment-chip"
                    tabIndex={-1}
                    title={`${attachment.name} (${attachment.size})`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setPreview({ attachment, email });
                    }}
                  >
                    <Icon name={attachment.type === "pdf" ? "mimePdf" : attachment.type === "calendar" ? "calendar" : attachment.type === "image" ? "mimeImage" : "document"} size={16} />
                    <span>{attachment.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {menu && (
        <MailMenu
          key={`${menu.kind}-${menu.email.id}`}
          kind={menu.kind}
          position={menu.position}
          emails={
            menu.kind === "context"
              ? [
                  menu.email,
                  ...emails.filter((email) => email.id !== menu.email.id && menu.ids?.includes(email.id)),
                ]
              : [menu.email]
          }
          labels={labels}
          onAction={onAction}
          onManageLabels={onManageLabels}
          onClose={() => setMenu(null)}
        />
      )}
      {preview && (
        <AttachmentPreview
          attachment={preview.attachment}
          email={preview.email}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

export default MailList;
