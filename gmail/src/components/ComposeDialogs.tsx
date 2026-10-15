import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Address, Attachment, ComposeDraft } from "../types";
import { Icon } from "../ui/Icon";
import "./composer-fidelity.css";

export function ComposeModal({
  title,
  children,
  onClose,
  className = "",
  alert = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  alert?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (
      panel.current?.querySelector<HTMLElement>(
        "[data-autofocus], button, input",
      ) || panel.current
    )?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
        ) || [],
      ).filter((element) => element.offsetParent !== null);
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !panel.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !panel.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div
      className={`gmail-compose-modal-backdrop ${className.includes("file-picker") ? "gmail-picker-backdrop" : ""}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !alert) onClose();
      }}
    >
      <div
        ref={panel}
        className={`gmail-compose-modal ${className}`}
        role={alert ? "alertdialog" : "dialog"}
        aria-label={title}
        aria-modal="true"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ComposeAlert({
  title = "Error",
  message,
  onClose,
  onConfirm,
  confirmLabel = "Send",
}: {
  title?: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
}) {
  return (
    <ComposeModal
      title={title}
      onClose={onClose}
      alert
      className="gmail-compose-alert"
    >
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="gmail-dialog-actions">
        {onConfirm && (
          <button type="button" className="gmail-dialog-text" onClick={onClose}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="gmail-dialog-primary"
          data-autofocus
          onClick={onConfirm || onClose}
        >
          {onConfirm ? confirmLabel : "OK"}
        </button>
      </div>
    </ComposeModal>
  );
}

export function InsertLinkPopover({
  text: initialText,
  x,
  y,
  onApply,
  onClose,
}: {
  text: string;
  x: number;
  y: number;
  onApply: (text: string, url: string) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState("");
  const candidate = url.trim();
  const normalized = /^(https?:\/\/|mailto:)/i.test(candidate)
    ? candidate
    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)
      ? `mailto:${candidate}`
      : /^[^\s./]+(?:\.[^\s/]+)+(?:\/[^\s]*)?$/.test(candidate)
        ? `https://${candidate}`
        : "";
  let valid = false;
  try {
    const parsed = new URL(normalized);
    valid =
      ["http:", "https:", "mailto:"].includes(parsed.protocol) &&
      (parsed.protocol === "mailto:"
        ? Boolean(parsed.pathname)
        : Boolean(parsed.hostname));
  } catch {
    /* An incomplete address keeps Apply disabled. */
  }

  useEffect(() => {
    panel.current?.querySelector<HTMLInputElement>("input")?.focus();
    function outside(event: PointerEvent) {
      if (
        !panel.current?.contains(event.target as Node) &&
        !(event.target as Element).closest('[aria-label="Insert link"]')
      )
        onClose();
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, []);

  return createPortal(
    <div
      ref={panel}
      className="gmail-link-popover"
      role="dialog"
      aria-label="Edit or Insert link"
      style={{
        left: Math.max(8, Math.min(x, window.innerWidth - 332)),
        top: Math.max(8, Math.min(y, window.innerHeight - 112)),
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && valid) {
          event.preventDefault();
          onApply(text || candidate, normalized);
        }
      }}
    >
      <div className="gmail-link-inputs">
        <label>
          <Icon name="linkText" size={20} />
          <input
            aria-label="Anchor Text"
            placeholder="Text"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <label>
          <Icon name="link" size={20} />
          <input
            aria-label="Link"
            placeholder="Type or paste a link"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={!valid}
        onClick={() => onApply(text || candidate, normalized)}
      >
        Apply
      </button>
    </div>,
    document.body,
  );
}

export function ConfidentialDialog({
  value,
  onSave,
  onClose,
}: {
  value?: ComposeDraft["confidential"];
  onSave: (value: NonNullable<ComposeDraft["confidential"]>) => void;
  onClose: () => void;
}) {
  const [expiration, setExpiration] = useState(value?.expiration || "1 week");
  const [passcode, setPasscode] = useState<"none" | "sms">(
    value?.passcode || "none",
  );
  const [menu, setMenu] = useState(false);
  const expires = new Date();
  if (expiration === "1 day") expires.setDate(expires.getDate() + 1);
  else if (expiration === "1 week") expires.setDate(expires.getDate() + 7);
  else if (expiration === "1 month") expires.setMonth(expires.getMonth() + 1);
  else if (expiration === "3 months") expires.setMonth(expires.getMonth() + 3);
  else expires.setFullYear(expires.getFullYear() + 5);
  return (
    <ComposeModal
      title="Confidential mode"
      className="gmail-confidential-dialog"
      onClose={menu ? () => setMenu(false) : onClose}
    >
      <h2>Confidential mode</h2>
      <p className="gmail-confidential-description">
        Recipients won&apos;t have the option to forward, copy, print, or
        download this email. This message may still be visible to your Google
        Workspace domain admins or{" "}
        <a
          href="https://support.google.com/vault/answer/2539616"
          target="_blank"
          rel="noreferrer"
        >
          Vault
        </a>{" "}
        users for periods defined by the domain&apos;s{" "}
        <a
          href="https://support.google.com/vault/answer/2535539"
          target="_blank"
          rel="noreferrer"
        >
          Gmail retention rules
        </a>
        .{" "}
        <a
          href="https://support.google.com/mail/answer/7674059"
          target="_blank"
          rel="noreferrer"
        >
          Learn more
        </a>
      </p>
      <section className="gmail-confidential-expiration">
        <h3>Set expiration</h3>
        <div className="gmail-expiration-row">
          <div className="gmail-expiration-control">
            <button
              type="button"
              data-autofocus
              aria-label="Set expiration"
              aria-haspopup="listbox"
              aria-expanded={menu}
              onClick={() => setMenu((value) => !value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setMenu(true);
                }
              }}
            >
              <span>Expires in {expiration}</span>
              <Icon name="arrowDropDown" size={20} />
            </button>
            {menu && (
              <div
                className="gmail-expiration-menu"
                role="listbox"
                aria-label="Expiration"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setMenu(false);
                  }
                  if (["ArrowDown", "ArrowUp"].includes(event.key)) {
                    event.preventDefault();
                    const items = Array.from(
                      event.currentTarget.querySelectorAll<HTMLButtonElement>(
                        "button",
                      ),
                    );
                    const index = items.indexOf(
                      document.activeElement as HTMLButtonElement,
                    );
                    items[
                      (index +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        items.length) %
                        items.length
                    ]?.focus();
                  }
                }}
              >
                {["1 day", "1 week", "1 month", "3 months", "5 years"].map(
                  (choice) => (
                    <button
                      type="button"
                      key={choice}
                      role="option"
                      aria-selected={choice === expiration}
                      onClick={() => {
                        setExpiration(choice);
                        setMenu(false);
                      }}
                    >
                      Expires in {choice}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
          <time dateTime={expires.toISOString()}>
            {expires.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        </div>
      </section>
      <section
        className="gmail-confidential-passcode"
        onPointerDown={() => setMenu(false)}
      >
        <h3>Require passcode</h3>
        <p>
          All passcodes will be generated by Google.{" "}
          <Icon name="help" size={18} />
        </p>
        <div role="radiogroup" aria-label="Require passcode">
          {(["none", "sms"] as const).map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="confidential-passcode"
                value={option}
                checked={passcode === option}
                onChange={() => setPasscode(option)}
              />
              <span>
                {option === "none" ? "No SMS passcode" : "SMS passcode"}
              </span>
            </label>
          ))}
        </div>
      </section>
      <div className="gmail-dialog-actions">
        <button type="button" className="gmail-dialog-text" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="gmail-dialog-primary"
          onClick={() =>
            onSave({ expiration, passcode, expiresAt: expires.toISOString() })
          }
        >
          Save
        </button>
      </div>
    </ComposeModal>
  );
}

export function ScheduleSendDialog({
  onSchedule,
  onClose,
}: {
  onSchedule: (date: string) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState(false);
  const [initialDate] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [date, setDate] = useState(
    initialDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  );
  const [time, setTime] = useState(
    initialDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  );
  const [month, setMonth] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [error, setError] = useState("");
  const zone = Intl.DateTimeFormat("en-US", { timeZoneName: "long" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;
  const presets = [
    { label: "Tomorrow morning", days: 1, hour: 8 },
    { label: "Tomorrow afternoon", days: 1, hour: 13 },
    {
      label: "Monday morning",
      days: (8 - new Date().getDay()) % 7 || 7,
      hour: 8,
    },
  ].map((preset) => {
    const date = new Date();
    date.setDate(date.getDate() + preset.days);
    date.setHours(preset.hour, 0, 0, 0);
    return { ...preset, date };
  });
  return (
    <ComposeModal
      title={custom ? "Pick date & time" : "Schedule send"}
      className={
        custom ? "gmail-schedule-custom-dialog" : "gmail-schedule-dialog"
      }
      onClose={onClose}
    >
      <button
        type="button"
        className="gmail-dialog-close"
        aria-label="Close dialog"
        onClick={onClose}
      >
        <Icon name="close" size={20} />
      </button>
      <h2>{custom ? "Pick date & time" : "Schedule send"}</h2>
      <p className="gmail-schedule-zone">{zone}</p>
      {custom ? (
        <>
          <div className="gmail-schedule-custom-fields">
            <div className="gmail-schedule-calendar">
              <div className="gmail-calendar-heading">
                <strong>
                  {month.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
                <button
                  aria-label="Previous month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                >
                  <Icon name="chevronLeft" size={20} />
                </button>
                <button
                  aria-label="Next month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                >
                  <Icon name="chevronRight" size={20} />
                </button>
              </div>
              <div className="gmail-calendar-grid">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                  <span key={`day-${index}`}>{day}</span>
                ))}
                {Array.from({ length: 42 }, (_, index) => {
                  const choice = new Date(
                    month.getFullYear(),
                    month.getMonth(),
                    index + 1 - month.getDay(),
                  );
                  const selected =
                    new Date(date).toDateString() === choice.toDateString();
                  return (
                    <button
                      key={index}
                      type="button"
                      aria-label={choice.toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                      aria-pressed={selected}
                      className={
                        choice.getMonth() === month.getMonth()
                          ? ""
                          : "gmail-calendar-other-month"
                      }
                      onKeyDown={(event) => {
                        const offset = (
                          {
                            ArrowLeft: -1,
                            ArrowRight: 1,
                            ArrowUp: -7,
                            ArrowDown: 7,
                          } as Record<string, number>
                        )[event.key];
                        if (!offset) return;
                        event.preventDefault();
                        const next = new Date(choice);
                        next.setDate(next.getDate() + offset);
                        setDate(
                          next.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }),
                        );
                        if (next.getMonth() !== month.getMonth())
                          setMonth(
                            new Date(next.getFullYear(), next.getMonth(), 1),
                          );
                        const label = next.toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        });
                        const calendar = event.currentTarget.closest(
                          ".gmail-calendar-grid",
                        );
                        requestAnimationFrame(() =>
                          calendar
                            ?.querySelector<HTMLButtonElement>(
                              `button[aria-label="${label}"]`,
                            )
                            ?.focus(),
                        );
                      }}
                      onClick={() => {
                        setDate(
                          choice.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }),
                        );
                        setError("");
                      }}
                    >
                      {choice.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="gmail-schedule-date-inputs">
              <input
                aria-label="Date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setError("");
                }}
              />
              <input
                aria-label="Time"
                value={time}
                onChange={(event) => {
                  setTime(event.target.value);
                  setError("");
                }}
              />
            </div>
          </div>
          {error && (
            <p className="gmail-dialog-error" role="alert">
              {error}
            </p>
          )}
          <div className="gmail-dialog-actions">
            <button className="gmail-dialog-text" onClick={onClose}>
              Cancel
            </button>
            <button
              className="gmail-dialog-primary"
              onClick={() => {
                const scheduled = new Date(`${date} ${time}`);
                if (
                  !Number.isFinite(scheduled.getTime()) ||
                  scheduled.getTime() <= Date.now()
                ) {
                  setError("Choose a date and time in the future.");
                  return;
                }
                onSchedule(scheduled.toISOString());
              }}
            >
              Schedule send
            </button>
          </div>
        </>
      ) : (
        <div className="gmail-schedule-options" role="menu">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset.label}
              role="menuitem"
              onClick={() => onSchedule(preset.date.toISOString())}
            >
              <span>{preset.label}</span>
              <time dateTime={preset.date.toISOString()}>
                {preset.date.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
            </button>
          ))}
          <div className="gmail-compose-menu-divider" />
          <button
            type="button"
            className="gmail-schedule-pick"
            role="menuitem"
            onClick={() => setCustom(true)}
          >
            <Icon name="calendar" size={20} />
            <span>Pick date &amp; time</span>
          </button>
        </div>
      )}
    </ComposeModal>
  );
}

type FilePickerProps = {
  mode: "drive" | "photo";
  files: Attachment[];
  onInsert: (file: Attachment) => void;
  onUpload: () => void;
  onClose: () => void;
  fileFilter?: "sheets";
};

export function ComposeFilePicker(props: FilePickerProps) {
  return props.mode === "photo" ? (
    <PhotoPicker {...props} />
  ) : (
    <DrivePicker {...props} />
  );
}

function DrivePicker({
  mode,
  files,
  onInsert,
  onUpload,
  onClose,
  fileFilter,
}: FilePickerProps) {
  const [tab, setTab] = useState(mode === "drive" ? "Recent" : "Photos");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Attachment | null>(null);
  const [view, setView] = useState<"list" | "grid">("grid");
  const [filter, setFilter] = useState(false);
  const [kind, setKind] = useState("All file types");
  const choices = files.filter(
    (file) =>
      (mode !== "photo" || file.type === "image") &&
      (fileFilter !== "sheets" ||
        /\.(csv|xlsx?|ods)$/i.test(file.name) ||
        (file as Attachment & { mimeType?: string }).mimeType ===
          "application/vnd.google-apps.spreadsheet") &&
      (kind === "All file types" ||
        (kind === "Photos & images"
          ? file.type === "image"
          : kind === "PDFs"
            ? file.type === "pdf"
            : file.type === "document")) &&
      file.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <ComposeModal
      title={
        mode === "drive" ? "Insert files using Google Drive" : "Insert photo"
      }
      className="gmail-compose-file-picker"
      onClose={onClose}
    >
      <button
        type="button"
        className="gmail-dialog-close"
        aria-label={
          mode === "drive"
            ? "Close picker Insert files using Google Drive"
            : "Close picker Insert photo"
        }
        onClick={onClose}
      >
        <Icon name="close" size={24} />
      </button>
      <header>
        <Icon name={mode === "drive" ? "driveLogo20" : "photo"} size={20} />
        <h2>
          {mode === "drive"
            ? "Insert files using Google Drive"
            : "Insert photo"}
        </h2>
        <label className="gmail-picker-search">
          <Icon name="pickerSearch" size={24} />
          <input
            aria-label="Search in Drive or paste URL"
            role="combobox"
            aria-expanded="false"
            aria-autocomplete="list"
            placeholder="Search in Drive or paste URL"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="button"
            aria-label="Filter"
            aria-expanded={filter}
            onClick={() => setFilter((current) => !current)}
          >
            <Icon name="pickerFilter24" size={24} />
          </button>
        </label>
      </header>
      <div className="gmail-picker-tabs" role="tablist">
        {(mode === "drive"
          ? ["Recent", "My Drive", "Shared with me", "Upload"]
          : ["Photos", "Albums", "Upload", "Web Address (URL)"]
        ).map((choice) => (
          <button
            key={choice}
            role="tab"
            aria-selected={tab === choice}
            onClick={() => {
              setTab(choice);
              setSelected(null);
            }}
          >
            <span>{choice}</span>
          </button>
        ))}
      </div>
      {filter && (
        <div className="gmail-picker-filter" role="menu" aria-label="File type">
          {["All file types", "Photos & images", "PDFs", "Documents"].map(
            (choice) => (
              <button
                key={choice}
                role="menuitemradio"
                aria-checked={choice === kind}
                onClick={() => {
                  setKind(choice);
                  setFilter(false);
                }}
              >
                {choice}
              </button>
            ),
          )}
        </div>
      )}
      <div
        className="gmail-picker-view-switch"
        role="radiogroup"
        aria-label="View"
      >
        {(["list", "grid"] as const).map((choice) => (
          <button
            type="button"
            key={choice}
            role="radio"
            aria-label={choice === "list" ? "List View" : "Grid View"}
            aria-checked={view === choice}
            onClick={() => setView(choice)}
          >
            <span className="gmail-picker-view-glyph">
            <Icon
              name={choice === "list" ? "driveList" : "driveGrid"}
              size={choice === "list" ? 20 : 18}
            />
            </span>
          </button>
        ))}
      </div>
      <div className={`gmail-picker-files gmail-picker-files-${view}`}>
        {tab === "Upload" ? (
          <div className="gmail-picker-upload">
            <p>Drag files here</p>
            <button className="gmail-dialog-primary" onClick={onUpload}>
              Select files from your device
            </button>
          </div>
        ) : choices.length ? (
          <>
            <h3>Today</h3>
            {choices.map((file) => (
              <button
                key={file.id}
                className="gmail-picker-file"
                aria-pressed={selected?.id === file.id}
                onClick={() => setSelected(file)}
                onDoubleClick={() => onInsert(file)}
              >
                {file.type === "image" && file.url ? (
                  <img src={file.url} alt="" />
                ) : (
                  <Icon name={file.type === "pdf" ? "mimePdf" : file.type === "image" ? "mimeImage" : file.type === "calendar" ? "calendar" : "document"} size={32} />
                )}
                <span>{file.name}</span>
              </button>
            ))}
          </>
        ) : (
          <p className="gmail-picker-empty">No files</p>
        )}
      </div>
      {selected && (
        <footer>
          <button
            type="button"
            className="gmail-picker-clear-selection"
            aria-label="Clear selection"
            onClick={() => setSelected(null)}
          >
            <Icon name="close" size={24} />
          </button>
          <span>1 selected</span>
          <button
            className="gmail-dialog-primary"
            onClick={() => onInsert(selected)}
          >
            Insert
          </button>
        </footer>
      )}
    </ComposeModal>
  );
}

function PhotoPicker({ files, onInsert, onUpload, onClose }: FilePickerProps) {
  const [source, setSource] = useState("Google Photos");
  const [tab, setTab] = useState("Photos");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<Attachment | null>(null);
  const photos = files.filter(
    (file) =>
      file.type === "image" &&
      file.name.toLowerCase().includes(query.toLowerCase()),
  );
  const validUrl =
    /^(https?:\/\/|blob:|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(
      url.trim(),
    );
  return (
    <ComposeModal
      title="Insert Photo"
      className="gmail-compose-file-picker gmail-photo-picker"
      onClose={onClose}
    >
      <header>
        <h2>Insert Photo</h2>
        <label className="gmail-picker-search">
          <Icon name="pickerSearch" size={24} />
          <input
            aria-label="Search Google photos"
            role="combobox"
            aria-expanded="false"
            placeholder="Search Google photos"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button aria-label="Clear" onClick={() => setQuery("")}>
              <Icon name="close" size={20} />
            </button>
          )}
        </label>
      </header>
      <button
        type="button"
        className="gmail-dialog-close"
        aria-label="Close picker Insert Photo"
        onClick={onClose}
      >
        <Icon name="close" size={24} />
      </button>
      <div className="gmail-photo-picker-main">
        <nav
          className="gmail-photo-sources"
          role="listbox"
          aria-label="Photo source"
        >
          {["Google Photos", "Web Address (URL)", "Upload"].map(
            (choice, index) => (
              <button
                type="button"
                key={choice}
                role="option"
                aria-selected={source === choice}
                onClick={() => {
                  setSource(choice);
                  setSelected(null);
                }}
              >
                  <Icon name={["photoSource", "pickerLink", "pickerUpload"][index]} className="gmail-photo-source-glyph" size={20} />
                <span>{choice}</span>
              </button>
            ),
          )}
        </nav>
        <div className="gmail-photo-panel" role="tabpanel" aria-label={source}>
          {source === "Google Photos" ? (
            <>
              <div className="gmail-photo-tabs" role="tablist">
                {["Photos", "Albums"].map((choice) => (
                  <button
                    key={choice}
                    role="tab"
                    aria-selected={tab === choice}
                    onClick={() => {
                      setTab(choice);
                      setSelected(null);
                    }}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              {photos.length ? (
                <div className="gmail-photo-items">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      aria-label={photo.name}
                      aria-pressed={selected?.id === photo.id}
                      onClick={() => setSelected(photo)}
                      onDoubleClick={() => onInsert(photo)}
                    >
                      <img src={photo.url} alt={photo.name} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="gmail-photo-empty" role="presentation">
                  <span className="gmail-photo-empty-art" aria-hidden="true" />
                  <div role="status">
                    <h3>No photos were found</h3>
                    <p>Add photos to your account and try reloading</p>
                  </div>
                </div>
              )}
            </>
          ) : source === "Upload" ? (
            <div className="gmail-photo-upload">
              <p>Drag photos here</p>
              <button
                type="button"
                className="gmail-dialog-primary"
                onClick={onUpload}
              >
                Choose photos to upload
              </button>
            </div>
          ) : (
            <div className="gmail-photo-url">
              <label>
                Paste an image URL here:
                <input
                  aria-label="Image URL"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
              </label>
              {validUrl && <img src={url.trim()} alt="Image preview" />}
            </div>
          )}
        </div>
      </div>
      {(selected || source === "Web Address (URL)") && (
        <footer>
          <button
            type="button"
            className="gmail-picker-clear-selection"
            aria-label="Clear selection"
            onClick={() => {
              setSelected(null);
              setUrl("");
            }}
          >
            <Icon name="close" size={24} />
          </button>
          <span>{selected ? "1 selected" : ""}</span>
          <button
            type="button"
            className="gmail-dialog-primary"
            disabled={!selected && !validUrl}
            onClick={() =>
              onInsert(
                selected || {
                  id: crypto.randomUUID(),
                  name: "Image",
                  type: "image",
                  size: "Linked image",
                  url: url.trim(),
                },
              )
            }
          >
            Insert
          </button>
        </footer>
      )}
    </ComposeModal>
  );
}

export function ComposeContactPicker({
  contacts = [],
  accountDomain = "example.org",
  onInsert,
  onClose,
}: {
  contacts?: Address[];
  accountDomain?: string;
  onInsert: (contacts: Address[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("My contacts");
  const [selected, setSelected] = useState<string[]>([]);
  const choices = contacts.filter(
    (contact) =>
      `${contact.name} ${contact.email}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (group === "My contacts" ||
        (group === "Directory"
          ? contact.email.split("@")[1]?.toLowerCase() ===
            accountDomain.toLowerCase()
          : (contact as Address & { starred?: boolean }).starred)),
  );
  return (
    <ComposeModal
      title="Select contacts"
      className="gmail-compose-file-picker gmail-contacts-picker"
      onClose={onClose}
    >
      <header>
        <Icon name="contactsLogo20" className="gmail-contacts-product-glyph" size={20} />
        <h2>Select contacts</h2>
        <label className="gmail-picker-search">
          <Icon name="pickerSearch" size={24} />
          <input
            aria-label="Search for contacts"
            role="combobox"
            aria-expanded="false"
            placeholder="Search for contacts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button aria-label="Clear" onClick={() => setQuery("")}>
              <Icon name="pickerClear" size={24} />
            </button>
          )}
        </label>
      </header>
      <button
        type="button"
        className="gmail-dialog-close"
        aria-label="Close picker Select contacts"
        onClick={onClose}
      >
        <Icon name="close" size={24} />
      </button>
      <div className="gmail-contacts-controls">
        <label>
          <span className="gmail-picker-checkbox">
            <input
              type="checkbox"
              aria-label="Select All"
              checked={
                choices.length > 0 &&
                choices.every((contact) => selected.includes(contact.email))
              }
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [
                        ...new Set([
                          ...selected,
                          ...choices.map((contact) => contact.email),
                        ]),
                      ]
                    : selected.filter(
                        (email) =>
                          !choices.some((contact) => contact.email === email),
                      ),
                )
              }
            />
            <span className="gmail-picker-checkbox-box"><Icon name="pickerCheck" size={14} /></span>
          </span>
          Select All
        </label>
        <button
          type="button"
          className="gmail-contacts-manage"
          disabled={!selected.length}
          onClick={() => {
            onClose();
            document.dispatchEvent(
              new CustomEvent("gopen:settings", { detail: { tab: "labels" } }),
            );
          }}
        >
          Manage labels
        </button>
        <select
          aria-label="Contact group"
          value={group}
          onChange={(event) => setGroup(event.target.value)}
        >
          {["My contacts", "Directory", "Starred in Android"].map((choice) => (
            <option key={choice}>{choice}</option>
          ))}
        </select>
      </div>
      <div className="gmail-contacts-content">
        <h3>
          {group} ({choices.length})
        </h3>
        {choices.length ? (
          <div className="gmail-contacts-rows">
            {choices.map((contact) => (
              <label key={contact.email}>
                <span className="gmail-picker-checkbox">
                <input
                  type="checkbox"
                  checked={selected.includes(contact.email)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, contact.email]
                        : selected.filter((email) => email !== contact.email),
                    )
                  }
                />
                <span className="gmail-picker-checkbox-box"><Icon name="pickerCheck" size={14} /></span>
                </span>
                <span className="gmail-contact-avatar">
                  {contact.name.charAt(0)}
                </span>
                <span>
                  {contact.name}
                  <small>{contact.email}</small>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="gmail-contacts-empty" role="status">
            <span className="gmail-contacts-empty-art" aria-hidden="true" />
            <h2>There&apos;s nothing here.</h2>
            <p>There are no contacts for this user.</p>
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <footer>
          <button
            className="gmail-picker-clear-selection"
            aria-label="Clear selection"
            onClick={() => setSelected([])}
          >
            <Icon name="close" size={24} />
          </button>
          <span>{selected.length} selected</span>
          <button
            className="gmail-dialog-primary"
            onClick={() =>
              onInsert(
                contacts.filter((contact) => selected.includes(contact.email)),
              )
            }
          >
            Insert
          </button>
        </footer>
      )}
    </ComposeModal>
  );
}

const layoutNames = [
  "Simple text",
  "Announcement",
  "Newsletter",
  "New service",
  "Referral",
];

export function ComposeLayoutPicker({
  onInsert,
  onClose,
}: {
  onInsert: (html: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("Default layouts");
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState(false);
  const [styling, setStyling] = useState(false);
  const [color, setColor] = useState("#007b83");
  const preview = useRef<HTMLDivElement>(null);
  return (
    <ComposeModal
      title={editing ? "Edit layout" : "Select a layout"}
      className="gmail-layout-picker"
      onClose={onClose}
    >
      <header>
        <h2>{editing ? "Edit layout" : "Select a layout"}</h2>
      </header>
      <button
        className="gmail-dialog-close"
        aria-label="Close dialog"
        onClick={onClose}
      >
        <Icon name="close" size={24} />
      </button>
      {!editing && (
        <div className="gmail-layout-tabs" role="tablist">
          {["Default layouts", "My layouts"].map((choice) => (
            <button
              role="tab"
              key={choice}
              aria-selected={tab === choice}
              onClick={() => setTab(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      )}
      <div
        className={`gmail-layout-picker-main ${editing ? "gmail-layout-editing" : ""}`}
      >
        {!editing && (
          <div className="gmail-layout-gallery" role="listbox" aria-label={tab}>
            {tab === "Default layouts" ? (
              layoutNames.map((name, index) => (
                <button
                  key={name}
                  role="option"
                  aria-label={name}
                  aria-selected={selected === index}
                  onClick={() => setSelected(index)}
                >
                  <span
                    className={`gmail-layout-thumbnail gmail-layout-thumbnail-${index}`}
                    aria-hidden="true"
                  />
                  {selected === index && (
                    <svg
                      className="gmail-layout-selected-check"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M0 0h24v24H0z" fill="none" />
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  )}
                  <span>{name}</span>
                </button>
              ))
            ) : (
              <p>No layouts</p>
            )}
          </div>
        )}
        {(tab === "Default layouts" || editing) && (
          <div className="gmail-layout-preview-pane">
            <div
              ref={preview}
              className={`gmail-layout-preview-document gmail-layout-preview-variant-${selected}`}
              contentEditable={editing}
              suppressContentEditableWarning
              role={editing ? "textbox" : undefined}
              aria-label={editing ? "Layout content" : "Layout preview"}
              tabIndex={editing ? 0 : undefined}
            >
              <div
                style={{
                  font: "8px/12px Arial, sans-serif",
                  letterSpacing: 3,
                  textAlign: "center",
                  color: "#80868b",
                }}
              >
                TRAVEL{" "}
                <span
                  className="gmail-layout-preview-brand"
                  aria-hidden="true"
                />{" "}
                AGENCY
              </div>
              <h3
                style={{
                  font: "18px/24px Arial, sans-serif",
                  textAlign: "center",
                  margin: "16px 0 8px",
                  color: "#202124",
                }}
              >
                Title of your article
              </h3>
              <p
                style={{
                  font: "9px/12px Arial, sans-serif",
                  margin: "0 0 16px",
                  color: "#444746",
                }}
              >
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Quasi
                pariatur dicta non nobis! Fugiat, beatae similique eaque
                voluptate quasi eum aspernatur. Minus nemo mollitia rem voluptas
                magni aliquam est quaerat commodi recusandae facere.
              </p>
              <p
                style={{
                  font: "9px/12px Arial, sans-serif",
                  margin: "0 0 16px",
                  color: "#444746",
                }}
              >
                Lorem ipsum dolor sit amet consectetur, adipisicing elit.
                Voluptatibus numquam odit quod fugit ducimus, maiores assumenda
                quibusdam porro aspernatur impedit eius aperiam alias
                repellendus earum.
              </p>
              <div style={{ textAlign: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "6px 16px",
                    borderRadius: 2,
                    backgroundColor: color,
                    color: "white",
                    font: "bold 9px/12px Arial, sans-serif",
                  }}
                >
                  Sign Up
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      <footer>
        <button
          className="gmail-layout-default-styling"
          aria-expanded={styling}
          onClick={() => setStyling((value) => !value)}
        >
          <span className="gmail-layout-palette-glyph" aria-hidden="true" />
          Default styling
        </button>
        <button className="gmail-dialog-text" onClick={onClose}>
          Cancel
        </button>
        <button
          className="gmail-dialog-primary"
          disabled={tab !== "Default layouts" && !editing}
          onClick={() => {
            if (editing && preview.current) onInsert(preview.current.innerHTML);
            else {
              setEditing(true);
              setStyling(false);
              requestAnimationFrame(() => preview.current?.focus());
            }
          }}
        >
          {editing ? "Insert" : "Edit layout"}
        </button>
      </footer>
      {styling && (
        <div
          className="gmail-layout-styling-panel"
          role="dialog"
          aria-label="Default styling"
        >
          <h3>Default styling</h3>
          <div role="group" aria-label="Layout color">
            {["#007b83", "#0b57d0", "#444746"].map((choice) => (
              <button
                key={choice}
                aria-label={choice}
                aria-pressed={color === choice}
                style={{ backgroundColor: choice }}
                onClick={() => setColor(choice)}
              />
            ))}
          </div>
          <button
            className="gmail-dialog-text"
            onClick={() => setStyling(false)}
          >
            Done
          </button>
        </div>
      )}
    </ComposeModal>
  );
}

const emojiCategories = [
  "Recently Used",
  "Smileys and emotions",
  "People",
  "Animals and nature",
  "Food and beverage",
  "Travel and places",
  "Activities and events",
  "Objects",
  "Symbols",
  "Flags",
];
type EmojiImage = {
  key: string;
  file: string;
  emoji: string;
  description: string;
  category: number;
  captured: boolean;
};

export function EmojiPicker({
  onInsert,
}: {
  onInsert: (emoji: string) => void;
}) {
  const [category, setCategory] = useState(0);
  const [search, setSearch] = useState("");
  const [images, setImages] = useState<EmojiImage[]>([]);
  const content = useRef<HTMLDivElement>(null);
  const sections = useRef<Array<HTMLDivElement | null>>([]);
  const [recent] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem("gopen-recent-emoji") || "[]",
      );
      return Array.isArray(stored)
        ? stored.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const abort = new AbortController();
    fetch("/emoji/index.json", { signal: abort.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error("Could not load the local emoji catalog.");
        return response.json() as Promise<{ images: EmojiImage[] }>;
      })
      .then((catalog) => setImages(catalog.images))
      .catch((cause: unknown) => {
        if (!abort.signal.aborted) console.error(cause);
      });
    return () => abort.abort();
  }, []);

  function scrollCategory(index: number) {
    setSearch("");
    setCategory(index);
    requestAnimationFrame(() => {
      const container = content.current;
      const section = sections.current[index];
      if (container && section)
        container.scrollTop +=
          section.getBoundingClientRect().top -
          container.getBoundingClientRect().top;
    });
  }

  function grid(choices: EmojiImage[]) {
    return (
      <div className="gmail-emoji-grid">
        {choices.map((image) => (
          <button
            type="button"
            key={image.key}
            aria-label={image.emoji}
            title={image.description}
            data-captured={image.captured}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              localStorage.setItem(
                "gopen-recent-emoji",
                JSON.stringify(
                  [
                    image.emoji,
                    ...recent.filter((item) => item !== image.emoji),
                  ].slice(0, 24),
                ),
              );
              onInsert(image.emoji);
            }}
          >
            <img
              src={image.file}
              alt={image.emoji}
              width={30}
              height={30}
              draggable={false}
            />
          </button>
        ))}
      </div>
    );
  }
  return (
    <div
      className="gmail-emoji-picker"
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        const grid = target.closest(
          ".gmail-emoji-grid, .gmail-emoji-categories",
        );
        if (!grid) return;
        const buttons = Array.from(
          grid.querySelectorAll<HTMLButtonElement>("button"),
        );
        const index = buttons.indexOf(target as HTMLButtonElement);
        if (index < 0) return;
        const columns = grid.classList.contains("gmail-emoji-grid") ? 9 : 1;
        const offset = (
          {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -columns,
            ArrowDown: columns,
            Home: -index,
            End: buttons.length - 1 - index,
          } as Record<string, number>
        )[event.key];
        if (offset === undefined) return;
        event.preventDefault();
        buttons[
          Math.max(0, Math.min(index + offset, buttons.length - 1))
        ]?.focus();
      }}
    >
      <label className="gmail-emoji-search">
        <span
          className="gmail-emoji-glyph"
          aria-hidden="true"
          style={{ maskImage: "url(/emoji/categories/0.svg)" }}
        />
        <input
          aria-label="Search"
          placeholder="Search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            if (content.current) content.current.scrollTop = 0;
          }}
        />
      </label>
      <div className="gmail-emoji-categories" role="tablist">
        {emojiCategories.map((label, index) => (
          <button
            type="button"
            key={label}
            role="tab"
            aria-label={label}
            aria-selected={category === index}
            data-tooltip={label}
            onClick={() => scrollCategory(index)}
          >
            <span
              className="gmail-emoji-glyph"
              aria-hidden="true"
              style={{ maskImage: `url(/emoji/categories/${index + 3}.svg)` }}
            />
          </button>
        ))}
      </div>
      <div
        ref={content}
        className="gmail-emoji-content"
        role="menu"
        aria-label="Emoji"
        onScroll={() => {
          if (search || !content.current) return;
          const top = content.current.getBoundingClientRect().top;
          const active = sections.current.findLastIndex(
            (section) =>
              section && section.getBoundingClientRect().top <= top + 1,
          );
          if (active >= 0) setCategory(active);
        }}
      >
        {search ? (
          <>
            <h3>Search results</h3>
            {grid(
              images.filter((image) =>
                `${image.emoji} ${image.key} ${image.description}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              ),
            )}
          </>
        ) : (
          emojiCategories.map((label, index) => {
            const choices =
              index === 0
                ? recent.flatMap((emoji) =>
                    images.filter((image) => image.emoji === emoji),
                  )
                : images.filter((image) => image.category === index);
            return (
              <div
                key={label}
                ref={(element) => {
                  sections.current[index] = element;
                }}
              >
                <h3>{label}</h3>
                {index === 0 && !choices.length ? (
                  <p>You haven&apos;t used any emojis yet.</p>
                ) : (
                  grid(choices)
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
