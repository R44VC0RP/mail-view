import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Address, Attachment, ComposeDraft, Label } from "../types";
import { Icon } from "../ui/Icon";
import {
  RecipientField,
  recipientAddress,
  splitRecipients,
} from "./RecipientField";
import { RichTextEditor } from "./RichTextEditor";
import type { RichTextEditorHandle } from "./RichTextEditor";
import { FormattingToolbar } from "./FormattingToolbar";
import {
  ComposeAlert,
  ComposeFilePicker,
  ComposeContactPicker,
  ComposeLayoutPicker,
  ConfidentialDialog,
  EmojiPicker,
  InsertLinkPopover,
  ScheduleSendDialog,
} from "./ComposeDialogs";
import "./composer-fidelity.css";

export type ComposerProps = {
  draft: ComposeDraft;
  onSave: (draft: ComposeDraft) => void;
  onSend: (draft: ComposeDraft) => void;
  onSchedule: (draft: ComposeDraft, date: string) => void;
  onClose: () => void;
  onDiscard: () => void;
  docked?: boolean;
  popout?: boolean;
  onPopout?: (draft: ComposeDraft) => void;
  contacts?: Address[];
  recipientSuggestions?: Address[];
  labels?: Label[];
  replyContext?: boolean;
  focusSubject?: boolean;
  accountDomain?: string;
  onDockExpandedChange?: (expanded: boolean) => void;
};

type MenuName = "send" | "more" | "emoji" | "signature" | "label" | "merge";
type DialogName =
  | "schedule"
  | "confidential"
  | "drive"
  | "photo"
  | "layout"
  | "contacts"
  | null;

export function Composer(props: ComposerProps) {
  return <ComposeWindow key={props.draft.id || "new-draft"} {...props} />;
}

function ComposeWindow({
  draft,
  onSave,
  onSend,
  onSchedule,
  onClose,
  onDiscard,
  docked = false,
  popout = false,
  onPopout,
  contacts = [],
  recipientSuggestions = contacts,
  labels = [],
  replyContext = false,
  focusSubject = false,
  accountDomain = "example.org",
  onDockExpandedChange,
}: ComposerProps) {
  const [current, setCurrent] = useState<ComposeDraft>(() => ({
    ...draft,
    attachments: [...draft.attachments],
  }));
  const latest = useRef(current);
  const [minimized, setMinimized] = useState(false);
  const [defaultFullscreen, setDefaultFullscreen] = useState(
    () => localStorage.getItem("gopen-compose-fullscreen") === "true",
  );
  const [fullscreen, setFullscreen] = useState(defaultFullscreen && !popout);
  const reportDockExpanded = useEffectEvent(() => onDockExpandedChange?.(!minimized && !fullscreen));
  useLayoutEffect(() => { reportDockExpanded(); }, [minimized, fullscreen]);
  const [recipientsExpanded, setRecipientsExpanded] = useState(
    !draft.to && !focusSubject,
  );
  const [recipientFocus, setRecipientFocus] = useState("To");
  const [showCc, setShowCc] = useState(Boolean(draft.cc));
  const [showBcc, setShowBcc] = useState(Boolean(draft.bcc));
  const [showFormatting, setShowFormatting] = useState(replyContext);
  const [plainText, setPlainText] = useState(false);
  const [menu, setMenu] = useState<{
    name: MenuName;
    x: number;
    y: number;
  } | null>(null);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [error, setError] = useState("");
  const [pendingSend, setPendingSend] = useState<{ date?: string } | null>(
    null,
  );
  const [link, setLink] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signature, setSignature] = useState(
    () => localStorage.getItem("gopen-compose-signature") || "",
  );
  useEffect(() => {
    const refresh = () => setSignature(localStorage.getItem("gopen-compose-signature") || "");
    document.addEventListener("gopen-signatures-changed", refresh);
    return () => document.removeEventListener("gopen-signatures-changed", refresh);
  }, []);
  const [driveFiles, setDriveFiles] = useState<Attachment[]>([]);
  const [driveFilter, setDriveFilter] = useState<"sheets" | undefined>();
  const [labelQuery, setLabelQuery] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    draft.labels || [],
  );
  const [dismissedWarning, setDismissedWarning] = useState("");
  const shell = useRef<HTMLDivElement>(null);
  const pinned = useRef<HTMLDivElement>(null);
  const subject = useRef<HTMLInputElement>(null);
  const recipients = useRef<HTMLDivElement>(null);
  const editor = useRef<RichTextEditorHandle | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const alive = useRef(true);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (focusSubject) {
      subject.current?.focus();
      subject.current?.select();
    }
  }, [focusSubject]);

  useEffect(() => {
    if (!menu) return;
    function outside(event: PointerEvent) {
      if (
        !panel.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setMenu(null);
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setMenu(null);
        trigger.current?.focus();
      }
      if (menu?.name === "emoji") return;
      if (
        !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) ||
        (event.target as HTMLElement).tagName === "INPUT"
      )
        return;
      const buttons = Array.from(
        panel.current?.querySelectorAll<HTMLButtonElement>(
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
  }, [menu]);

  function update(patch: Partial<ComposeDraft>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setCurrent(next);
    onSave(next);
    setSaved(true);
    if (savedTimeout.current) clearTimeout(savedTimeout.current);
    savedTimeout.current = setTimeout(() => setSaved(false), 1800);
  }

  function close() {
    if (loadingFiles) {
      setError("Wait for your attachments to finish loading before closing.");
      return;
    }
    onSave(latest.current);
    onClose();
  }

  function validate() {
    const addresses = [
      latest.current.to,
      latest.current.cc,
      latest.current.bcc,
    ].flatMap(splitRecipients);
    if (!addresses.length) {
      setError("Please specify at least one recipient.");
      return false;
    }
    const invalid = addresses.find(
      (value) =>
        !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipientAddress(value).email),
    );
    if (invalid) {
      setError(
        `The address "${invalid}" in the "To" field was not recognized. Please make sure that all addresses are properly formed.`,
      );
      return false;
    }
    if (loadingFiles) {
      setError("Wait for your attachments to finish loading.");
      return false;
    }
    return true;
  }

  function send(date?: string, confirmed = false) {
    setMenu(null);
    if (!validate()) return;
    if (
      date &&
      (!Number.isFinite(new Date(date).getTime()) ||
        new Date(date).getTime() <= Date.now())
    ) {
      setError("Choose a date and time in the future.");
      return;
    }
    if (!confirmed && !latest.current.subject.trim()) {
      setDialog(null);
      setPendingSend({ date });
      return;
    }
    onSave(latest.current);
    if (date) onSchedule(latest.current, new Date(date).toISOString());
    else onSend(latest.current);
  }

  function expandRecipients(label = "To") {
    setRecipientsExpanded(true);
    setRecipientFocus(label);
    if (label === "Cc") setShowCc(true);
    if (label === "Bcc") setShowBcc(true);
    requestAnimationFrame(() =>
      recipients.current
        ?.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)
        ?.focus(),
    );
  }

  function openMenu(name: MenuName, button: HTMLButtonElement) {
    editor.current?.rememberSelection();
    trigger.current = button;
    setLink(null);
    if (menu?.name === name) {
      setMenu(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    const savedSignature =
      localStorage.getItem("gopen-compose-signature") || "";
    if (name === "signature") setSignature(savedSignature);
    if (name === "label") {
      setSelectedLabels(latest.current.labels || []);
      setLabelQuery("");
    }
    const dimensions = {
      send: [157.578, 44],
      more: [227.508, 198],
      emoji: [370, 340],
      signature: [216.906, savedSignature ? 121 : 89],
      label: [240, Math.min(600, labels.length * 32 + 131)],
      merge: [249.1640625, 76],
    }[name];
    const left =
      name === "merge"
        ? rect.right - dimensions[0]
        : name === "send"
          ? rect.left - 72
          : name === "more"
            ? rect.right - dimensions[0] - 6
            : name === "emoji"
              ? rect.left + rect.width / 2 - dimensions[0] / 2 + 20
              : rect.left + 6;
    const bottom =
      name === "signature"
        ? rect.top + 6
        : name === "send"
          ? rect.top
          : rect.top - 2;
    setMenu({
      name,
      x: Math.max(8, Math.min(left, window.innerWidth - dimensions[0] - 8)),
      y:
        name === "merge"
          ? Math.min(rect.bottom, window.innerHeight - dimensions[1] - 8)
          : Math.max(8, bottom - dimensions[1]),
    });
  }

  function openDrive(fileFilter?: "sheets") {
    let cached: Attachment[] = [];
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem("gopen-drive-files") || "[]",
      );
      if (Array.isArray(stored))
        cached = stored.filter((file): file is Attachment =>
          Boolean(
            file &&
            typeof file.id === "string" &&
            typeof file.name === "string" &&
            typeof file.size === "string" &&
            ["pdf", "document", "image", "calendar"].includes(file.type) &&
            (file.url === undefined || typeof file.url === "string"),
          ),
        );
    } catch {
      /* A malformed local cache does not prevent using current attachments. */
    }
    setDriveFiles(
      [...latest.current.attachments, ...cached].filter(
        (file, index, files) =>
          files.findIndex((item) => item.id === file.id) === index,
      ),
    );
    setDriveFilter(fileFilter);
    setMenu(null);
    setDialog("drive");
  }

  function openLink() {
    editor.current?.rememberSelection();
    const selection = window.getSelection();
    const body = shell.current?.querySelector<HTMLElement>(".gmail-editor");
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const rect =
      range && body?.contains(range.commonAncestorContainer)
        ? range.getBoundingClientRect()
        : null;
    const fallback = body?.getBoundingClientRect();
    setMenu(null);
    setLink({
      text: editor.current?.getSelectedText() || "",
      x: rect?.width || rect?.height ? rect.left : fallback?.left || 16,
      y: rect?.height ? rect.bottom : (fallback?.top || 130) + 19,
    });
  }

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    const chosen = Array.from(files);
    const existingSize = latest.current.attachments.reduce(
      (total, file) => total + (file.url?.length || 0) * 0.75,
      0,
    );
    if (
      chosen.reduce((total, file) => total + file.size, existingSize) >
      2 * 1024 * 1024
    ) {
      setError(
        "Keep attachments under 2 MB total so your draft can be saved locally.",
      );
      return;
    }
    if (latest.current.attachments.length + chosen.length > 10) {
      setError("You can add up to 10 attachments.");
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
                });
              reader.onerror = () =>
                reject(new Error(`Could not read ${file.name}`));
              reader.readAsDataURL(file);
            }),
        ),
      );
      if (alive.current)
        update({
          attachments: [...latest.current.attachments, ...attachments],
        });
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not attach these files.",
        );
    } finally {
      if (alive.current) setLoadingFiles(false);
      if (fileInput.current) fileInput.current.value = "";
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  function footerTool(
    name: string,
    label: string,
    action: (button: HTMLButtonElement) => void,
    active = false,
    disabled = false,
  ) {
    return (
      <button
        type="button"
        key={name}
        className={`gmail-compose-tool ${active ? "gmail-compose-tool-active" : ""}`}
        aria-label={label}
        data-tooltip={label}
        disabled={disabled}
        aria-pressed={name === "format" ? active : undefined}
        onMouseDown={(event) => {
          if (name === "link") event.preventDefault();
          editor.current?.rememberSelection();
        }}
        onClick={(event) => action(event.currentTarget)}
      >
        <Icon name={name} size={20} />
      </button>
    );
  }

  const recipientSummary = [current.to, current.cc, current.bcc]
    .flatMap(splitRecipients)
    .map((value) => {
      const address = recipientAddress(value);
      return {
        email: address.email,
        text: address.name ? `${address.name} (${address.email})` : contacts.find(
            (contact) =>
              contact.email.toLowerCase() === address.email.toLowerCase(),
          )?.name || address.email,
      };
    });
  const externalRecipients = [current.to, current.cc, current.bcc]
    .flatMap(splitRecipients)
    .map((value) => recipientAddress(value).email)
    .filter(
      (email) =>
        /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) &&
        email.split("@")[1].toLowerCase() !== accountDomain.toLowerCase() &&
        !contacts.some(
          (contact) => contact.email.toLowerCase() === email.toLowerCase(),
        ),
    );
  const warningKey = externalRecipients.join(", ");
  const showWarning = Boolean(warningKey && dismissedWarning !== warningKey);
  const signatureEnabled = Boolean(
    current.html &&
    new DOMParser()
      .parseFromString(current.html, "text/html")
      .body.querySelector(":scope > .gmail_signature"),
  );

  useEffect(() => {
    const frame = shell.current;
    const controls = pinned.current;
    if (!frame || !controls || minimized) return;
    const body = frame.querySelector<HTMLElement>(".gmail-compose-editor");
    // Keep scrolled editor content reachable below the overlaid controls.
    const observer = new ResizeObserver(() => {
      frame.style.setProperty(
        "--compose-footer-height",
        `${controls.getBoundingClientRect().height}px`,
      );
      const warning = controls.querySelector<HTMLElement>(".gmail-compose-external-warning");
      frame.style.setProperty(
        "--compose-warning-height",
        `${!fullscreen && !popout ? warning?.getBoundingClientRect().height || 0 : 0}px`,
      );
      if (body && !replyContext && !fullscreen && !popout) {
        const minimum = parseFloat(getComputedStyle(body).minHeight);
        const viewport = body.parentElement!;
        const style = getComputedStyle(viewport);
        const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        frame.style.setProperty(
          "--compose-content-growth",
          `${minimum > 0 ? Math.max(0, viewport.getBoundingClientRect().height - minimum - padding) : 0}px`,
        );
      }
    });
    observer.observe(controls);
    if (body) observer.observe(body);
    if (body?.parentElement) observer.observe(body.parentElement);
    return () => {
      observer.disconnect();
      frame.style.removeProperty("--compose-footer-height");
      frame.style.removeProperty("--compose-content-growth");
      frame.style.removeProperty("--compose-warning-height");
    };
  }, [minimized, replyContext, fullscreen, popout]);

  return (
    <>
      {fullscreen && (
        <div
          className="gmail-compose-fullscreen-backdrop"
          aria-hidden="true"
          onClick={() => setFullscreen(false)}
        />
      )}
      <div
        ref={shell}
        className={`composer gmail-composer ${docked ? "composer-docked" : ""} ${popout ? "composer-popout" : ""} ${minimized ? "composer-minimized" : ""} ${fullscreen ? "composer-fullscreen" : ""} ${current.confidential ? "composer-confidential-active" : ""} ${replyContext ? "composer-reply-context" : ""}`}
        role="dialog"
        aria-label={current.subject || "New Message"}
        aria-modal={fullscreen || undefined}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            send();
          }
          if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            ["c", "b"].includes(event.key.toLowerCase())
          ) {
            event.preventDefault();
            expandRecipients(event.key.toLowerCase() === "c" ? "Cc" : "Bcc");
          }
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "k"
          ) {
            event.preventDefault();
            openLink();
          }
          if (
            event.key === "Escape" &&
            !menu &&
            !dialog &&
            !link &&
            !error &&
            !pendingSend
          ) {
            event.preventDefault();
            event.stopPropagation();
            if (fullscreen) setFullscreen(false);
            else close();
          }
          if (
            fullscreen &&
            event.key === "Tab" &&
            !dialog &&
            !link &&
            !error &&
            !pendingSend &&
            !menu
          ) {
            const items = Array.from(
              shell.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled):not([tabindex="-1"]), input:not([type="file"]):not(:disabled), [contenteditable], a[href]',
              ) || [],
            ).filter((item) => item.offsetParent !== null);
            if (event.shiftKey && document.activeElement === items[0]) {
              event.preventDefault();
              items[items.length - 1]?.focus();
            } else if (
              !event.shiftKey &&
              document.activeElement === items[items.length - 1]
            ) {
              event.preventDefault();
              items[0]?.focus();
            }
          }
        }}
      >
        <header className="gmail-compose-header">
          <button
            type="button"
            className="gmail-compose-title"
            aria-label={
              minimized ? "Restore compose window" : "Minimize compose window"
            }
            onClick={() => {
              setMinimized((value) => !value);
              setFullscreen(false);
            }}
          >
            {saved
              ? "Draft saved"
              : (minimized || replyContext) && current.subject
                ? current.subject
                : "New Message"}
          </button>
          <div className="gmail-compose-window-controls">
            <button
              type="button"
              aria-label={minimized ? "Restore compose" : "Minimize compose"}
              data-tooltip={minimized ? "Restore" : "Minimize"}
              onClick={() => {
                setMinimized((value) => !value);
                setFullscreen(false);
              }}
            >
              <Icon name={minimized ? "maximize" : "minimize"} size={16} />
            </button>
            {!popout && (
              <button
                type="button"
                aria-label={fullscreen ? "Exit full screen" : "Full screen"}
                data-tooltip={
                  fullscreen
                    ? "Exit full screen"
                    : "Full screen (Shift for pop-out)"
                }
                onClick={(event) => {
                  if (event.shiftKey && onPopout) {
                    onSave(latest.current);
                    onPopout(latest.current);
                    return;
                  }
                  setFullscreen((value) => !value);
                  setMinimized(false);
                  setMenu(null);
                  setLink(null);
                }}
              >
                <Icon
                  name={fullscreen ? "exitFullscreen" : "expand"}
                  size={16}
                />
              </button>
            )}
            <button
              type="button"
              aria-label="Save and close compose"
              data-tooltip="Save & close"
              onClick={close}
            >
              <Icon name="composeClose" size={16} />
            </button>
          </div>
        </header>
        <div className="gmail-compose-content" hidden={minimized}>
          <div className="gmail-compose-scroll">
            <div className="gmail-compose-fields">
              <div
                ref={recipients}
                className="gmail-compose-recipients"
                onBlur={(event) => {
                  if (
                    !error && !pendingSend &&
                    !event.currentTarget.contains(
                      event.relatedTarget as Node | null,
                    )
                  )
                    setRecipientsExpanded(false);
                }}
              >
                {recipientsExpanded ? (
                  ["To", ...(showCc ? ["Cc"] : []), ...(showBcc ? ["Bcc"] : [])].map((label) => {
                    const field = label.toLowerCase() as "to" | "cc" | "bcc";
                    return (
                      <div className="gmail-compose-recipient-row" key={label}>
                        <RecipientField
                          label={label}
                          value={current[field]}
                          onChange={(value) => update({ [field]: value })}
                          contacts={contacts}
                          recipientSuggestions={recipientSuggestions}
                          accountDomain={accountDomain}
                          onSelectContacts={() => {
                            setRecipientFocus(label);
                            setDialog("contacts");
                          }}
                          autoFocus={recipientFocus === label}
                        />
                        {label === (showBcc ? "Bcc" : showCc ? "Cc" : "To") && (
                          <div className="gmail-compose-recipient-toggles">
                            {!showCc && (
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => expandRecipients("Cc")}
                              >
                                Cc
                              </button>
                            )}
                            {!showBcc && (
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => expandRecipients("Bcc")}
                              >
                                Bcc
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label="Use mail merge"
                              data-tooltip="Use mail merge"
                              aria-haspopup="menu"
                              aria-expanded={menu?.name === "merge"}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={(event) =>
                                openMenu("merge", event.currentTarget)
                              }
                            >
                              <Icon name="recipientAdd" size={20} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <button
                    type="button"
                    className={`gmail-compose-recipient-summary ${recipientSummary.length ? "" : "gmail-compose-empty-summary"}`}
                    aria-label="Edit recipients"
                    onFocus={() => expandRecipients()}
                    onClick={() => expandRecipients()}
                  >
                    {recipientSummary.length ? recipientSummary.map((recipient, index) => (
                      <span key={`${index}-${recipient.email}`}>
                        {index > 0 && ", "}
                        <span className={externalRecipients.includes(recipient.email)
                          ? "gmail-compose-external-recipient" : undefined}>
                          {recipient.text}
                        </span>
                      </span>
                    )) : "Recipients"}
                  </button>
                )}
              </div>
              <input
                ref={subject}
                className="gmail-compose-subject"
                aria-label="Subject"
                name="subjectbox"
                placeholder="Subject"
                value={current.subject}
                onChange={(event) => update({ subject: event.target.value })}
              />
            </div>
            <div className="gmail-compose-body-wrap">
              <RichTextEditor
                body={current.body}
                html={current.html}
                onChange={(body, html) => {
                  if (
                    body !== latest.current.body ||
                    html !== latest.current.html
                  )
                    update({ body, html: plainText ? undefined : html });
                }}
                label="Message body"
                editorRef={editor}
                autoFocus={Boolean(draft.to) && !focusSubject}
                plainText={plainText}
                className="gmail-compose-editor"
                onFiles={(files) => void attach(files)}
              />
            </div>
          </div>
          <div className="gmail-compose-pinned" ref={pinned}>
            {current.attachments.length > 0 && (
              <div className="gmail-compose-attachments">
                {current.attachments.map((attachment) => (
                  <div
                    className="gmail-compose-attached-file"
                    key={attachment.id}
                  >
                    <Icon
                      name={attachment.type === "image" ? "mimeImage" : attachment.type === "pdf" ? "mimePdf" : attachment.type === "calendar" ? "calendar" : "document"}
                      size={16}
                    />
                    <span title={attachment.name}>{attachment.name}</span>
                    <small>({attachment.size})</small>
                    <button
                      type="button"
                      aria-label={`Remove ${attachment.name}`}
                      onClick={() =>
                        update({
                          attachments: latest.current.attachments.filter(
                            (file) => file.id !== attachment.id,
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
              <div className="gmail-compose-loading" role="status">
                Attaching files...
              </div>
            )}
            {current.confidential && (
              <div className="gmail-compose-confidential-banner">
                <span className="gmail-confidential-banner-icon">
                  <Icon name="lock" size={24} />
                </span>
                <div>
                  <span>
                    Content expires{" "}
                    {new Date(current.confidential.expiresAt).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                    .
                  </span>
                  <p>
                    Recipients won&apos;t have the option to forward, copy, print,
                    or download this email. This message may still be visible to
                    your Google Workspace domain admins or Vault users for periods
                    defined by the domain&apos;s Gmail retention rules.
                  </p>
                </div>
                <button
                  type="button"
                  className="gmail-dialog-text"
                  onClick={() => setDialog("confidential")}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="gmail-compose-tool"
                  aria-label="Turn off confidential mode"
                  onClick={() => update({ confidential: undefined })}
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
            )}
            {showFormatting && (
              <FormattingToolbar editorRef={editor} disabled={plainText} />
            )}
            {showWarning && (
              <div className="gmail-compose-external-warning" role="status">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  data-source="https://www.gstatic.com/people/peoplekit/icons/light_theme/out_of_domain_yellow500.svg"
                >
                  <path d="M0 0h24v24H0V0z" fill="#FBBC04" />
                  <path
                    fill="#202124"
                    transform="scale(0.6666) translate(6 5.3)"
                    d="M10 10L9 9 6 6 5 5 3 3l-.9-.9L.69 3.51 2 4.83V21h16.17l2.31 2.31 1.41-1.41-10.48-10.49L10 10zm-4 9H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm4 8H8v-2h2v2zm0-4H8v-2h2v2zm2 2h2.17l2 2H12v-2zm0-10V3H5.83l2 2h2v2l2 2H20v8.17l2 2V7zm4 4h2v2h-2z"
                  />
                </svg>
                <p>
                  <strong>
                    Be cautious about sharing sensitive information.
                  </strong>{" "}
                  {warningKey}{" "}
                  {externalRecipients.length === 1
                    ? "is outside your organization and isn't in your contacts."
                    : "are outside your organization and aren't in your contacts."}
                </p>
                <button
                  type="button"
                  aria-label="Dismiss warning"
                  onClick={() => setDismissedWarning(warningKey)}
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
            )}
            <footer className="gmail-compose-footer">
              <div
                className={`gmail-compose-send-group ${current.confidential ? "gmail-compose-send-single" : ""}`}
              >
                <button
                  type="button"
                  className="gmail-compose-send"
                  disabled={loadingFiles}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => send()}
                >
                  Send
                </button>
                {!current.confidential && (
                  <button
                    type="button"
                    className="gmail-compose-send-caret"
                    aria-label="More send options"
                    data-tooltip="More send options"
                    aria-haspopup="menu"
                    aria-expanded={menu?.name === "send"}
                    onClick={(event) => openMenu("send", event.currentTarget)}
                  >
                    <Icon name="sendArrow20" size={20} />
                  </button>
                )}
              </div>
              <div className="gmail-compose-tools">
                {footerTool(
                  "format",
                  "Formatting options",
                  () => setShowFormatting((value) => !value),
                  showFormatting,
                )}
                {footerTool(
                  "attachment",
                  "Attach files",
                  () => fileInput.current?.click(),
                  false,
                  loadingFiles,
                )}
                {footerTool("link", "Insert link", openLink)}
                {footerTool(
                  "emoji",
                  "Insert emoji",
                  (button) => openMenu("emoji", button),
                  menu?.name === "emoji",
                )}
                {footerTool("drive", "Insert files using Drive", () =>
                  openDrive(),
                )}
                {footerTool(
                  "photo",
                  "Insert photo",
                  () => setDialog("photo"),
                  false,
                  loadingFiles,
                )}
                {footerTool(
                  "lock",
                  "Toggle confidential mode",
                  () => setDialog("confidential"),
                  Boolean(current.confidential),
                )}
                {footerTool("signature", "Insert signature", (button) =>
                  openMenu("signature", button),
                )}
                {footerTool("layout", "Select a layout", () =>
                  setDialog("layout"),
                )}
                {footerTool(
                  "more",
                  "More compose options",
                  (button) => openMenu("more", button),
                  menu?.name === "more",
                )}
              </div>
              <button
                type="button"
                className="gmail-compose-tool gmail-compose-discard"
                aria-label="Discard draft"
                data-tooltip="Discard draft"
                onClick={onDiscard}
              >
                <Icon name="trash" size={20} />
              </button>
            </footer>
            <input
              ref={fileInput}
              className="gmail-compose-file-input"
              type="file"
              multiple
              aria-label="Choose attachments"
              onChange={(event) => void attach(event.target.files)}
            />
            <input
              ref={photoInput}
              className="gmail-compose-file-input"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              aria-label="Choose photos"
              onChange={(event) => void attach(event.target.files)}
            />
          </div>
        </div>
      </div>
      {menu &&
        createPortal(
          <div
            ref={panel}
            className={`gmail-compose-menu gmail-compose-menu-${menu.name}`}
            role={menu.name === "emoji" ? "dialog" : "menu"}
            aria-label={
              menu.name === "send"
                ? "More send options"
                : menu.name === "merge"
                  ? "Mail merge"
                  : menu.name === "emoji"
                    ? "Emoji picker"
                    : menu.name === "signature"
                      ? "Insert signature"
                      : "More compose options"
            }
            style={{ left: menu.x, top: menu.y }}
          >
            {menu.name === "send" && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  if (validate()) setDialog("schedule");
                }}
              >
                <Icon name="scheduleSend" size={20} />
                <span>Schedule send</span>
              </button>
            )}
            {menu.name === "more" && (
              <>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={defaultFullscreen}
                  onClick={() => {
                    const next = !defaultFullscreen;
                    setDefaultFullscreen(next);
                    localStorage.setItem(
                      "gopen-compose-fullscreen",
                      String(next),
                    );
                    setMenu(null);
                  }}
                >
                  <Icon
                    name={defaultFullscreen ? "check" : "expand"}
                    size={20}
                  />
                  <span>Default to full screen</span>
                </button>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={plainText}
                  onClick={() => {
                    setPlainText((value) => !value);
                    setMenu(null);
                  }}
                >
                  <Icon
                    name={plainText ? "check" : "clearFormatting"}
                    size={20}
                  />
                  <span>Plain text mode</span>
                </button>
                <div className="gmail-compose-menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    shell.current?.setAttribute("data-print-compose", "true");
                    window.print();
                    shell.current?.removeAttribute("data-print-compose");
                  }}
                >
                  <Icon name="print" size={20} />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    shell.current
                      ?.querySelector<HTMLElement>(".gmail-editor")
                      ?.setAttribute("spellcheck", "true");
                    editor.current?.focus();
                  }}
                >
                  <Icon name="spellCheck" size={20} />
                  <span>Spell check</span>
                </button>
                <div className="gmail-compose-menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  onClick={(event) => openMenu("label", event.currentTarget)}
                >
                  <Icon name="label" size={20} />
                  <span>Label</span>
                  <Icon name="arrowRight" size={20} />
                </button>
              </>
            )}
            {menu.name === "signature" && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    document.dispatchEvent(
                      new CustomEvent("gopen:settings", {
                        detail: { tab: "general", anchor: "signature" },
                      }),
                    );
                  }}
                >
                  Manage signatures
                </button>
                <div className="gmail-compose-menu-divider" />
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={!signatureEnabled}
                  onClick={() => {
                    editor.current?.setSignature("");
                    setMenu(null);
                  }}
                >
                  <span className="gmail-signature-check">
                    {!signatureEnabled && <Icon name="check" size={20} />}
                  </span>
                  <span>No signature</span>
                </button>
                {signature && (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={signatureEnabled}
                    onClick={() => {
                      editor.current?.setSignature(signature);
                      setMenu(null);
                    }}
                  >
                    <span className="gmail-signature-check">
                      {signatureEnabled && <Icon name="check" size={20} />}
                    </span>
                    <span>My signature</span>
                  </button>
                )}
              </>
            )}
            {menu.name === "emoji" && (
              <EmojiPicker
                onInsert={(emoji) => {
                  editor.current?.command("insertText", emoji);
                  setMenu(null);
                }}
              />
            )}
            {menu.name === "merge" && (
              <>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={Boolean(current.mailMerge)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => update({ mailMerge: !current.mailMerge })}
                >
                  <Icon name="recipientAdd" size={20} />
                  <span>Mail Merge</span>
                  <Icon
                    name={current.mailMerge ? "checkboxChecked" : "checkbox"}
                    size={20}
                  />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!current.mailMerge}
                  onClick={() => openDrive("sheets")}
                >
                  <span
                    className="gmail-mail-merge-sheet-glyph"
                    aria-hidden="true"
                  />
                  <span>Add from a spreadsheet</span>
                </button>
              </>
            )}
            {menu.name === "label" && (
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
                      type="button"
                      key={label.id}
                      role="menuitemcheckbox"
                      aria-checked={selectedLabels.includes(label.id)}
                      onClick={() =>
                        setSelectedLabels((labels) =>
                          labels.includes(label.id)
                            ? labels.filter((item) => item !== label.id)
                            : [...labels, label.id],
                        )
                      }
                    >
                      <Icon
                        name={
                          selectedLabels.includes(label.id)
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
                  type="button"
                  onClick={() => {
                    update({ labels: selectedLabels });
                    setMenu(null);
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
            editor.current?.insertLink(text, url);
            setLink(null);
          }}
          onClose={() => {
            setLink(null);
            editor.current?.focus();
          }}
        />
      )}
      {error && (
        <ComposeAlert
          message={error}
          onClose={() => {
            setError("");
            if (error.includes("recipient") || error.includes("address"))
              expandRecipients();
          }}
        />
      )}
      {pendingSend && (
        <ComposeAlert
          title="Send this message?"
          message="Send this message without a subject?"
          confirmLabel={pendingSend.date ? "Schedule send" : "Send"}
          onClose={() => setPendingSend(null)}
          onConfirm={() => {
            const date = pendingSend.date;
            setPendingSend(null);
            send(date, true);
          }}
        />
      )}
      {dialog === "confidential" && (
        <ConfidentialDialog
          value={current.confidential}
          onSave={(confidential) => {
            update({ confidential });
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "schedule" && (
        <ScheduleSendDialog
          onSchedule={(date) => send(date)}
          onClose={() => setDialog(null)}
        />
      )}
      {(dialog === "drive" || dialog === "photo") && (
        <ComposeFilePicker
          mode={dialog}
          files={dialog === "drive" ? driveFiles : current.attachments}
          fileFilter={dialog === "drive" ? driveFilter : undefined}
          onInsert={(file) => {
            if (dialog === "drive" && driveFilter === "sheets") {
              const addresses =
                file.previewText?.match(/[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/g) ||
                [];
              update({
                mailMerge: true,
                to: [...splitRecipients(latest.current.to), ...addresses]
                  .filter(
                    (address, index, items) => items.indexOf(address) === index,
                  )
                  .join(", "),
              });
              setDialog(null);
              return;
            }
            const attachments = [
              ...latest.current.attachments,
              { ...file, id: crypto.randomUUID() },
            ];
            setDialog(null);
            if (attachments.length > 10) {
              setError("You can add up to 10 attachments.");
              return;
            }
            if (
              attachments.reduce(
                (total, item) => total + (item.url?.length || 0) * 0.75,
                0,
              ) >
              2 * 1024 * 1024
            ) {
              setError(
                "Keep attachments under 2 MB total so your draft can be saved locally.",
              );
              return;
            }
            update({ attachments });
          }}
          onUpload={() => {
            const mode = dialog;
            setDialog(null);
            (mode === "photo" ? photoInput : fileInput).current?.click();
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "layout" && (
        <ComposeLayoutPicker
          onClose={() => setDialog(null)}
          onInsert={(html) => {
            editor.current?.command("insertHTML", html);
            setDialog(null);
          }}
        />
      )}
      {dialog === "contacts" && (
        <ComposeContactPicker
          contacts={contacts}
          accountDomain={accountDomain}
          onClose={() => setDialog(null)}
          onInsert={(selected) => {
            const field = recipientFocus.toLowerCase() as "to" | "cc" | "bcc";
            const existing = splitRecipients(latest.current[field]);
            const added = selected.filter(
              (contact) =>
                !existing.some(
                  (address) =>
                    recipientAddress(address).email.toLowerCase() ===
                    contact.email.toLowerCase(),
                ),
            );
            update({
              [field]: [
                ...existing,
                ...added.map((contact) => `${contact.name} <${contact.email}>`),
              ].join(", "),
            });
            setDialog(null);
            expandRecipients(recipientFocus);
          }}
        />
      )}
    </>
  );
}
