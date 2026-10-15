import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Email, Label, MailAction, OnAction, SelectMode } from "../types";
import { Icon } from "../ui/Icon";
import "./mail-list.css";
import "./chrome-fidelity.css";

export type MenuPosition = { x: number; y: number; anchor?: HTMLElement };
export type MailMenuKind =
  "context" | "more" | "select" | "move" | "label" | "snooze" | "pagination";

type MailMenuProps = {
  kind: MailMenuKind;
  position: MenuPosition;
  emails: Email[];
  labels: Label[];
  onAction: OnAction;
  onClose: () => void;
  onSelectBy?: (mode: SelectMode) => void;
  onPage?: (page: number) => void;
  page?: number;
  lastPage?: number;
  onManageLabels?: () => void;
};

type Submenu = { kind: "move" | "label"; y: number; focus: boolean };

const categories = ["social", "updates", "forums", "promotions"] as const;

export function labelPath(label: Label, labels: Label[]) {
  const ancestors = [label];
  const seen = new Set([label.id]);
  let parent = labels.find((item) => item.id === label.parentId);
  while (parent && !seen.has(parent.id)) {
    ancestors.unshift(parent);
    seen.add(parent.id);
    parent = labels.find((item) => item.id === parent?.parentId);
  }
  return ancestors.reduce((path, item) =>
    !path || item.name === path || item.name.startsWith(`${path}/`)
      ? item.name
      : `${path}/${item.name}`, "");
}

export function MailMenu({
  kind,
  position,
  emails,
  labels,
  onAction,
  onClose,
  onSelectBy,
  onPage,
  page = 0,
  lastPage = 0,
  onManageLabels,
}: MailMenuProps) {
  const host = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const nested = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const [snoozeRoot, setSnoozeRoot] = useState<MenuPosition | null>(null);
  const activeKind = snoozeRoot ? "snooze" : kind;
  const origin = snoozeRoot ?? position;
  const [location, setLocation] = useState(position);
  const [nestedLocation, setNestedLocation] = useState<MenuPosition>(position);
  const [submenu, setSubmenu] = useState<Submenu | null>(null);
  const [query, setQuery] = useState("");
  const [checkedLabels, setCheckedLabels] = useState<Map<string, boolean | "mixed">>(
    () => new Map([
      ...labels.map((label): [string, boolean | "mixed"] => [
        label.id,
        emails.length > 0 && emails.every((email) => email.labels.includes(label.id))
          ? true
          : emails.some((email) => email.labels.includes(label.id)) ? "mixed" : false,
      ]),
      ...categories.map((category): [string, boolean | "mixed"] => [
        `category:${category}`,
        emails.length > 0 && emails.every((email) => email.category === category)
          ? true
          : emails.some((email) => email.category === category) ? "mixed" : false,
      ]),
    ]),
  );
  const [datePicker, setDatePicker] = useState(false);
  const [pickedDate, setPickedDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  });
  const [pickedTime, setPickedTime] = useState("8:00 AM");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date(pickedDate);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const ids = emails.map((email) => email.id);
  const first = emails[0];
  const hasUnread = emails.some((email) => email.unread);
  const closeMenu = useEffectEvent(onClose);

  useLayoutEffect(() => {
    if (datePicker) return;
    const rect = panel.current?.getBoundingClientRect();
    if (!rect) return;
    setLocation({
      x: Math.max(8, Math.min(origin.x, window.innerWidth - rect.width - 8)),
      y: Math.max(
        8,
        Math.min(origin.y, window.innerHeight - rect.height - (activeKind === "move" ? 77 : 0) - 8),
      ),
    });
  }, [origin.x, origin.y, activeKind, datePicker]);

  useEffect(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dismiss = (event: PointerEvent) => {
      if (
        !host.current?.contains(event.target as Node) &&
        !position.anchor?.contains(event.target as Node)
      )
        closeMenu();
    };
    const dismissOnResize = () => closeMenu();
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", dismissOnResize);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", dismissOnResize);
      window.clearTimeout(hoverTimer.current);
      if (
        document.activeElement === document.body ||
        host.current?.contains(document.activeElement)
      )
        previousFocus.current?.focus();
    };
  }, [position.anchor]);

  useEffect(() => {
    const input = !datePicker && panel.current?.querySelector<HTMLInputElement>("input");
    if (input) input.focus();
    else panel.current?.focus({ preventScroll: true });
  }, [activeKind, datePicker]);

  useLayoutEffect(() => {
    if (!submenu || !nested.current || !panel.current) return;
    const parentRect = panel.current.getBoundingClientRect();
    const rect = nested.current.getBoundingClientRect();
    const x =
      parentRect.right + rect.width > window.innerWidth - 8
        ? Math.round(parentRect.left - rect.width)
        : Math.round(parentRect.right);
    setNestedLocation({
      x: Math.max(8, x),
      y: Math.max(
        8,
        Math.min(submenu.y, window.innerHeight - rect.height - (submenu.kind === "move" ? 77 : 0) - 8),
      ),
    });
    const input = nested.current.querySelector<HTMLInputElement>("input");
    if (input) input.focus();
    else if (submenu.focus) nested.current.focus();
  }, [submenu, location, datePicker]);

  const act = (action: MailAction, value?: string) => {
    onAction(action, ids, value);
    onClose();
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (submenu) {
        setSubmenu(null);
        panel.current
          ?.querySelector<HTMLElement>('[aria-expanded="true"]')
          ?.focus();
      } else onClose();
      return;
    }
    if (event.key === "Tab") {
      if (datePicker) {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled):not([tabindex="-1"]), input',
        ) ?? []);
        const index = controls.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          controls.at(-1)?.focus();
        } else if (!event.shiftKey && index === controls.length - 1) {
          event.preventDefault();
          controls[0]?.focus();
        }
        return;
      }
      onClose();
      return;
    }
    const target = event.target as HTMLElement;
    const currentPanel = target.closest('[role="menu"]');
    if (event.key === "ArrowLeft" && currentPanel === nested.current) {
      event.preventDefault();
      setSubmenu(null);
      panel.current
        ?.querySelector<HTMLElement>('[aria-expanded="true"]')
        ?.focus();
      return;
    }
    if (
      event.key === "ArrowRight" &&
      target.getAttribute("aria-haspopup") === "menu"
    ) {
      event.preventDefault();
      target.click();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if (
      target instanceof HTMLInputElement &&
      (datePicker ||
        event.key === "Home" ||
        event.key === "End")
    )
      return;
    const items = Array.from(
      currentPanel?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled)',
      ) ?? [],
    );
    if (!items.length) return;
    event.preventDefault();
    const index = items.indexOf(target);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : index < 0
            ? event.key === "ArrowDown"
              ? 0
              : items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length;
    items[next]?.focus();
  };

  const item = (
    text: string,
    icon: string | undefined,
    action: MailAction,
    value?: string,
  ) => (
    <button
      key={text}
      type="button"
      className="mail-menu-item"
      role="menuitem"
      tabIndex={-1}
      onPointerEnter={() => {
        window.clearTimeout(hoverTimer.current);
        setSubmenu(null);
      }}
      onClick={() => act(action, value)}
    >
      {icon && <Icon name={icon} size={20} className="mail-menu-icon" />}
      <span>{text}</span>
    </button>
  );
  const divider = (key: string) => (
    <div key={key} className="mail-menu-divider" role="separator" />
  );
  const branch = (text: string, icon: string, childKind: Submenu["kind"]) => (
    <button
      key={text}
      type="button"
      className="mail-menu-item"
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={submenu?.kind === childKind}
      tabIndex={-1}
      onPointerEnter={(event) => {
        window.clearTimeout(hoverTimer.current);
        if (event.pointerType === "touch" || submenu?.kind === childKind) return;
        const y = event.currentTarget.getBoundingClientRect().top;
        hoverTimer.current = window.setTimeout(() => {
          setQuery("");
          setSubmenu({ kind: childKind, y, focus: false });
        }, 300);
      }}
      onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
      onClick={(event) => {
        window.clearTimeout(hoverTimer.current);
        setQuery("");
        setDatePicker(false);
        setSubmenu({
          kind: childKind,
          y: event.currentTarget.getBoundingClientRect().top,
          focus: true,
        });
      }}
    >
      <Icon name={icon} size={20} className="mail-menu-icon" />
      <span>{text}</span>
      <Icon name="contextArrow20" size={20} className="mail-menu-caret" />
    </button>
  );

  const labelMenu = (mode: "move" | "label") => {
    const custom = labels.map((label) => ({ id: label.id, name: labelPath(label, labels) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const system = categories.map((category) => ({
      id: `category:${category}`,
      name: category[0].toUpperCase() + category.slice(1),
    }));
    const entries = [...custom, ...system];
    if (mode === "label") {
      const initiallyApplied = (id: string) => emails.some((email) =>
        id.startsWith("category:") ? email.category === id.slice(9) : email.labels.includes(id),
      );
      entries.sort((a, b) => Number(initiallyApplied(b.id)) - Number(initiallyApplied(a.id)));
    }
    const visible = entries.filter((label) => label.name.toLowerCase().includes(query.toLowerCase()));
    const folders = (emails.every((email) => email.folder === "inbox")
      ? [{ id: "spam", name: "Spam" }, { id: "trash", name: "Trash" }]
      : [{ id: "inbox", name: "Inbox" }, { id: "spam", name: "Spam" }, { id: "trash", name: "Trash" }]
    ).filter((folder) => folder.name.toLowerCase().includes(query.toLowerCase()));
    const add: string[] = [];
    const remove: string[] = [];
    for (const entry of entries) {
      const matches = (email: Email) => entry.id.startsWith("category:")
        ? email.category === entry.id.slice(9)
        : email.labels.includes(entry.id);
      if (checkedLabels.get(entry.id) === true && !emails.every(matches)) add.push(entry.id);
      if (checkedLabels.get(entry.id) === false && emails.some(matches)) remove.push(entry.id);
    }
    const footer = <>
      <button type="button" role="menuitem" tabIndex={-1} className="mail-menu-item" onClick={() => act("newLabel")}>
        Create new
      </button>
      <button type="button" role="menuitem" tabIndex={-1} className="mail-menu-item" onClick={() => {
        onClose();
        onManageLabels?.();
      }}>
        Manage labels
      </button>
    </>;
    return (
      <>
        <div className="mail-menu-heading">
          {mode === "move" ? "Move to:" : "Label as:"}
        </div>
        <div className="mail-menu-search">
          <input
            aria-label={
              mode === "move" ? "Search destinations" : "Search labels"
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Icon name="searchPlain" size={20} />
        </div>
        <div className="mail-menu-labels">
          {visible.map((label) => (
            <button
              key={label.id}
              type="button"
              className="mail-menu-item mail-menu-label-item"
              role={mode === "label" ? "menuitemcheckbox" : "menuitem"}
              aria-checked={
                mode === "label" ? checkedLabels.get(label.id) ?? false : undefined
              }
              title={label.name}
              tabIndex={-1}
              onClick={() => {
                if (mode === "move") act("move", label.id);
                else
                  setCheckedLabels((current) => {
                    const next = new Map(current);
                    next.set(label.id, current.get(label.id) !== true);
                    return next;
                  });
              }}
            >
              {mode === "label" && (
                <Icon
                  name={
                    checkedLabels.get(label.id) === "mixed"
                      ? "checkboxMixed"
                      : checkedLabels.get(label.id)
                        ? "checkboxChecked"
                        : "checkbox"
                  }
                  size={20}
                  className="mail-menu-icon"
                />
              )}
              <span>{label.name}</span>
            </button>
          ))}
          {!visible.length && (
            <div className="mail-menu-empty">No matching labels</div>
          )}
        </div>
        {mode === "label" && (add.length > 0 || remove.length > 0) && (
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="mail-menu-item"
            onClick={() => {
              if (add.length || remove.length)
                onAction("label", ids, JSON.stringify({ add, remove }));
              onClose();
            }}
          >
            Apply
          </button>
        )}
        {divider("labels-bottom")}
        {mode === "move" ? <>
          {folders.map((folder) => (
            <button key={folder.id} type="button" role="menuitem" tabIndex={-1} className="mail-menu-item" onClick={() => act("move", folder.id)}>
              {folder.name}
            </button>
          ))}
          <div className="mail-menu-move-footer">{footer}</div>
        </> : footer}
      </>
    );
  };

  const snoozeMenu = () => {
    const now = new Date();
    const later = new Date(now);
    later.setHours(18, 0, 0, 0);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    const weekend = new Date(now);
    weekend.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
    weekend.setHours(8, 0, 0, 0);
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7 || 7));
    nextWeek.setHours(8, 0, 0, 0);
    const choices = [
      ...(later > now ? [{ name: "Later today", date: later }] : []),
      { name: "Tomorrow", date: tomorrow },
      { name: "This weekend", date: weekend },
      { name: "Next week", date: nextWeek },
    ];
    return (
      <>
        <div className="mail-menu-heading">Snooze until{"\u2026"}</div>
        {choices.map((choice) => (
          <button
            key={choice.name}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="mail-menu-item mail-menu-snooze-item"
            onClick={() => act("snooze", choice.date.toISOString())}
          >
            <span>{choice.name}</span>
            <small>
              {choice.date.toLocaleDateString("en-US", { weekday: "short" })},{" "}
              {choice.date.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              }).replace(/\s+(AM|PM)$/, "\u202f$1")}
            </small>
          </button>
        ))}
        {divider("snooze-date")}
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="mail-menu-item mail-menu-pick-date"
          onClick={() => setDatePicker(true)}
        >
          <Icon name="calendar" size={20} className="mail-menu-icon" />
          Pick date &amp; time
        </button>
      </>
    );
  };

  let content: ReactNode;
  if (activeKind === "pagination") {
    content = [{ text: "Newest", page: 0 }, { text: "Oldest", page: lastPage }].map(
      (choice) => (
        <button
          key={choice.text}
          type="button"
          className="mail-menu-item"
          role="menuitem"
          tabIndex={-1}
          disabled={page === choice.page}
          onClick={() => {
            onPage?.(choice.page);
            onClose();
          }}
        >
          {choice.text}
        </button>
      ),
    );
  } else if (activeKind === "select") {
    const modes: { text: string; value: SelectMode }[] = [
      { text: "All", value: "all" },
      { text: "None", value: "none" },
      { text: "Read", value: "read" },
      { text: "Unread", value: "unread" },
      { text: "Starred", value: "starred" },
      { text: "Unstarred", value: "unstarred" },
    ];
    content = modes.map((mode) => (
      <button
        key={mode.value}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="mail-menu-item mail-menu-select-item"
        onClick={() => {
          onSelectBy?.(mode.value);
          onClose();
        }}
      >
        {mode.text}
      </button>
    ));
  } else if (activeKind === "move" || activeKind === "label") content = labelMenu(activeKind);
  else if (activeKind === "snooze") content = snoozeMenu();
  else if (activeKind === "context")
    content = (
      <>
        {item("Reply", "reply", "reply")}
        {item("Reply all", "replyAll", "replyAll")}
        {item("Forward", "forward", "forward")}
        {item("Forward as attachment", "attachmentHorizontal", "forward", "attachment")}
        {divider("reply")}
        {item("Archive", "archive", "archive")}
        {item("Delete", "trash", "delete")}
        {item(
          hasUnread ? "Mark as read" : "Mark as unread",
          hasUnread ? "mailOpen" : "mailUnreadIndicator",
          hasUnread ? "read" : "unread",
        )}
        <button type="button" role="menuitem" tabIndex={-1} className="mail-menu-item" onPointerEnter={() => {
          window.clearTimeout(hoverTimer.current);
          setSubmenu(null);
        }} onClick={() => {
          window.clearTimeout(hoverTimer.current);
          const anchor = document.querySelector<HTMLElement>('.mail-toolbar [aria-label="Snooze"]');
          const rect = anchor?.querySelector("svg")?.getBoundingClientRect();
          setSubmenu(null);
          setSnoozeRoot(rect ? { x: rect.left, y: rect.bottom, anchor: anchor ?? undefined } : { x: location.x, y: location.y });
        }}>
          <Icon name="clock" size={20} className="mail-menu-icon" />
          <span>Snooze</span>
        </button>
        {item("Add to Tasks", "task", "task")}
        {divider("organize")}
        {branch("Move to", "move", "move")}
        {branch("Label as", "label", "label")}
        {item("Mute", "mute", "mute")}
        {divider("labels")}
        {item(
          `Find emails from ${first?.sender ?? "sender"}`,
          "searchPlain",
          "filterSender",
          first?.senderEmail,
        )}
        {divider("sender")}
        {item("Open in new window", "openInNew", "newWindow")}
      </>
    );
  else
    content = emails.length ? (
      <>
        {item("Mark as read", "mailOpen", "read")}
        {item("Mark as unread", "mailUnreadIndicator", "unread")}
        {item(
          emails.every((email) => email.starred) ? "Remove star" : "Add star",
          "star",
          emails.every((email) => email.starred) ? "unstar" : "star",
        )}
        {item(
          emails.every((email) => email.important)
            ? "Mark as not important"
            : "Mark as important",
          "important",
          emails.every((email) => email.important)
            ? "unimportant"
            : "important",
        )}
        {divider("more")}
        {item("Add to Tasks", "task", "task")}
        {item("Mute", "mute", "mute")}
        {item(
          "Filter messages like these",
          undefined,
          "filter",
          first?.senderEmail,
        )}
        {item("Forward as attachment", undefined, "forward", "attachment")}
      </>
    ) : (
      <>
        {item("Mark all as read", "mailOpen", "read")}
        {divider("more-hint")}
        <div className="mail-menu-hint">
          Select messages to see more actions
        </div>
      </>
    );

  const panelStyle: CSSProperties = { left: location.x, top: location.y };
  const selectedDate = new Date(pickedDate);
  const timeMatch = pickedTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  let hour = timeMatch ? Number(timeMatch[1]) : NaN;
  const minute = timeMatch ? Number(timeMatch[2]) : NaN;
  const period = timeMatch?.[3]?.toUpperCase();
  if (period) hour = hour >= 1 && hour <= 12 ? hour % 12 + (period === "PM" ? 12 : 0) : NaN;
  const snoozeDate = new Date(selectedDate);
  if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) snoozeDate.setHours(hour, minute, 0, 0);
  else snoozeDate.setTime(NaN);
  const validSnooze = !Number.isNaN(snoozeDate.getTime()) && snoozeDate.getTime() > Date.now();
  const pickDay = (date: Date) => {
    setPickedDate(date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
    if (date.getMonth() !== calendarMonth.getMonth() || date.getFullYear() !== calendarMonth.getFullYear())
      setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };
  return createPortal(
    <div ref={host} className="mail-menu-host" onKeyDown={keyDown}>
      {datePicker ? (
        <div className="mail-snooze-backdrop" onPointerDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}>
          <div ref={panel} className="mail-snooze-dialog" role="dialog" aria-modal="true" aria-labelledby="mail-snooze-title" tabIndex={-1}>
            <h2 id="mail-snooze-title">Pick date &amp; time</h2>
            <form onSubmit={(event) => {
              event.preventDefault();
              if (validSnooze) act("snooze", snoozeDate.toISOString());
            }}>
              <div className="mail-snooze-body">
                <div className="mail-snooze-calendar">
                  <div className="mail-snooze-month">
                    <span aria-live="polite">{calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                    <button type="button" aria-label="Previous month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                      <Icon name="chevronLeft" size={20} />
                    </button>
                    <button type="button" aria-label="Next month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                      <Icon name="chevronRight" size={20} />
                    </button>
                  </div>
                  <div className="mail-snooze-weekdays" aria-hidden="true">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={index}>{day}</span>)}
                  </div>
                  <div className="mail-snooze-days" role="grid" aria-label={calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}>
                    {Array.from({ length: 6 }, (_, week) => (
                      <div role="row" key={week}>
                        {Array.from({ length: 7 }, (_, weekday) => {
                          const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1 - calendarMonth.getDay() + week * 7 + weekday);
                          const selected = date.toDateString() === selectedDate.toDateString();
                          const outside = date.getMonth() !== calendarMonth.getMonth();
                          const atTime = new Date(date);
                          atTime.setHours(Number.isNaN(hour) ? 8 : hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
                          const disabled = atTime.getTime() <= Date.now();
                          return <div role="gridcell" aria-selected={selected} key={weekday}>
                            <button type="button" className={`${selected ? "mail-snooze-day-selected" : ""}${outside ? " mail-snooze-day-outside" : ""}`} disabled={disabled} tabIndex={selected ? 0 : -1} aria-label={date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} onClick={() => pickDay(date)} onKeyDown={(event) => {
                              const offset = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[event.key];
                              if (offset === undefined) return;
                              event.preventDefault();
                              const next = new Date(date);
                              next.setDate(next.getDate() + offset);
                              next.setHours(Number.isNaN(hour) ? 8 : hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
                              if (next.getTime() <= Date.now()) return;
                              pickDay(next);
                              requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>(".mail-snooze-day-selected")?.focus());
                            }}>{date.getDate()}</button>
                          </div>;
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mail-snooze-fields">
                  <input aria-label="Date" value={pickedDate} required onChange={(event) => setPickedDate(event.target.value)} onBlur={() => {
                    if (!Number.isNaN(selectedDate.getTime())) setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
                  }} />
                  <input aria-label="Time" value={pickedTime} required onChange={(event) => setPickedTime(event.target.value)} />
                </div>
              </div>
              <div className="mail-snooze-footer">
                <button type="button" className="mail-snooze-cancel" onClick={onClose}>Cancel</button>
                <button type="submit" className="mail-snooze-save" disabled={!validSnooze}>Save</button>
              </div>
            </form>
          </div>
        </div>
      ) : <div
        ref={panel}
        className={`mail-menu mail-menu--${activeKind}`}
        style={panelStyle}
        role="menu"
        tabIndex={-1}
        aria-label={
          activeKind === "context"
            ? "Message actions"
            : `${activeKind[0].toUpperCase()}${activeKind.slice(1)} menu`
        }
      >
        {content}
      </div>}
      {!datePicker && submenu && (
        <div
          ref={nested}
          className={`mail-menu mail-menu--${submenu.kind} mail-menu--nested`}
          style={{ left: nestedLocation.x, top: nestedLocation.y }}
          role="menu"
          tabIndex={-1}
          aria-label={`${submenu.kind} submenu`}
        >
          {labelMenu(submenu.kind)}
        </div>
      )}
    </div>,
    document.body,
  );
}
