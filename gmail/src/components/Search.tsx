import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import type { Email, Label } from "../types";
import { Icon } from "../ui/Icon";
import "./shell.css";
import "./search-fidelity.css";

export type SearchProps = {
  emails: Email[];
  labels: Label[];
  query: string;
  onSearch: (query: string) => void;
  onCreateFilter: (query: string) => void;
};

type SearchFields = {
  from: string;
  to: string;
  subject: string;
  words: string;
  without: string;
  sizeOperator: string;
  size: string;
  sizeUnit: string;
  dateWithin: string;
  date: string;
  folder: string;
  attachment: boolean;
  originalDates: string;
};

const emptyFields: SearchFields = {
  from: "",
  to: "",
  subject: "",
  words: "",
  without: "",
  sizeOperator: "larger",
  size: "",
  sizeUnit: "MB",
  dateWithin: "1",
  date: "",
  folder: "",
  attachment: false,
  originalDates: "",
};
const historyKey = "gopen.search-history";

const dateOptions = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "1 week" },
  { value: "14", label: "2 weeks" },
  { value: "30", label: "1 month" },
  { value: "60", label: "2 months" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
];

export function searchQueryParts(query: string) {
  const parts: string[] = [];
  let start = 0;
  let quoted = false;
  let depth = 0;
  for (let index = 0; index <= query.length; index++) {
    const char = query[index];
    if (char === '"' && query[index - 1] !== "\\") quoted = !quoted;
    if (!quoted) {
      if (char === "(" || char === "{") depth++;
      if (char === ")" || char === "}") depth = Math.max(0, depth - 1);
    }
    if (index === query.length || (!quoted && !depth && /\s/.test(char))) {
      if (index > start) parts.push(query.slice(start, index));
      start = index + 1;
    }
  }
  return parts;
}

export function replaceSearchOperators(query: string, operators: RegExp, replacement: string) {
  return [...searchQueryParts(query).filter((part) => !operators.test(part)), replacement]
    .filter(Boolean).join(" ").trim();
}

export function formatSearchDate(date: Date) {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function parseSearchDate(value: string) {
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
}

function fieldsFromQuery(query: string, labels: Label[]): SearchFields {
  const fields = { ...emptyFields };
  if (searchQueryParts(query).some((part) => part === "OR")) return { ...fields, words: query };
  const words: string[] = [];
  const dates: string[] = [];
  let after: Date | null = null;
  let before: Date | null = null;
  for (const part of searchQueryParts(query)) {
    const match = part.match(/^(from|to|subject|larger|smaller|size|after|before|newer|older|in|is|category|label):(.+)$/i);
    const operator = match?.[1].toLowerCase();
    const content = match?.[2].replace(/^\(([^()]+)\)$/, "$1").replace(/^"(.*)"$/, "$1") || "";
    if ((operator === "from" || operator === "to" || operator === "subject") && !fields[operator]) {
      fields[operator] = content;
    } else if (/^has:attachment$/i.test(part)) {
      fields.attachment = true;
    } else if (part.startsWith("-") && !/[:{}()]/.test(part)) {
      fields.without = [fields.without, part.slice(1)].filter(Boolean).join(" ");
    } else if ((operator === "larger" || operator === "smaller" || operator === "size") && !fields.size && /^\d+(?:\.\d+)?[KM]?$/i.test(content)) {
      const suffix = content.slice(-1).toUpperCase();
      const bytes = parseFloat(content) * (suffix === "M" ? 1_048_576 : suffix === "K" ? 1_024 : 1);
      fields.sizeOperator = operator === "smaller" ? "smaller" : "larger";
      fields.sizeUnit = bytes >= 1_000_000 ? "MB" : bytes >= 1_000 ? "KB" : "Bytes";
      fields.size = String(bytes / (fields.sizeUnit === "MB" ? 1_000_000 : fields.sizeUnit === "KB" ? 1_000 : 1));
    } else if (["after", "before", "newer", "older"].includes(operator || "") && parseSearchDate(content)) {
      dates.push(part);
      if (operator === "after" || operator === "newer") after = parseSearchDate(content);
      else before = parseSearchDate(content);
    } else if (operator === "label" && !fields.folder && labels.some((label) => label.name.toLowerCase() === content.toLowerCase())) {
      fields.folder = `label:${labels.find((label) => label.name.toLowerCase() === content.toLowerCase())!.id}`;
    } else if (!fields.folder && ((operator === "in" && ["inbox", "starred", "sent", "draft", "drafts", "chats", "spam", "trash", "anywhere"].includes(content.toLowerCase())) || (operator === "is" && ["read", "unread", "starred"].includes(content.toLowerCase())) || (operator === "category" && ["purchases", "social", "updates", "forums", "promotions"].includes(content.toLowerCase())))) {
      fields.folder = `${operator}:${content.toLowerCase().replace(/^draft$/, "drafts")}`;
      if (fields.folder === "is:starred") fields.folder = "in:starred";
    } else words.push(part);
  }
  fields.words = words.join(" ");
  fields.originalDates = dates.join(" ");
  if (after && before) {
    const days = Math.round((Date.UTC(before.getFullYear(), before.getMonth(), before.getDate()) - Date.UTC(after.getFullYear(), after.getMonth(), after.getDate())) / 86_400_000);
    const within = Math.floor((days - 1) / 2);
    if (dateOptions.some((option) => Number(option.value) === within)) {
      fields.dateWithin = String(within);
      after.setDate(after.getDate() + within);
    }
  }
  if (after || before) fields.date = formatSearchDate((after || before)!);
  return fields;
}

export function SearchCheckbox({ checked, onChange, children, disabled = false }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return <label className={`gmail-search-check${disabled ? " gmail-search-check-disabled" : ""}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <Icon name={checked ? "checkboxChecked" : "checkbox"} size={20} />
    <span>{children}</span>
  </label>;
}

export function SearchSelect({ value, options, onChange, label, className = "" }: {
  value: string;
  options: { value: string; label: string; separator?: boolean }[];
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [menuTop, setMenuTop] = useState(-3);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    menu.current?.focus();
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => {
    if (open) menu.current?.querySelector(`[data-option-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    button.current?.focus();
  };
  function showMenu() {
    const index = Math.max(0, options.findIndex((option) => option.value === value));
    const offset = index * 32 + options.slice(0, index + 1).filter((option) => option.separator).length * 13;
    setMenuTop(Math.max(8 - (root.current?.getBoundingClientRect().top || 0), -3 - offset));
    setActive(index);
    setOpen(true);
  }
  return <div className={`gmail-search-select ${className}${open ? " gmail-search-select-open" : ""}`} ref={root}>
    <button ref={button} type="button" role={className === "gmail-search-time-chip" ? undefined : "listbox"} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={showMenu}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          showMenu();
        }
      }}>
      <span role={className === "gmail-search-time-chip" ? undefined : "option"} aria-selected={className === "gmail-search-time-chip" ? undefined : true}>{options.find((option) => option.value === value)?.label || options[0]?.label}</span><Icon name="arrowDropDown" size={20} />
    </button>
    {open && <div className="gmail-search-select-menu" style={className === "gmail-search-time-chip" ? undefined : { top: menuTop }} id={id} role="listbox" aria-label={`${label} options`} tabIndex={-1} ref={menu} aria-activedescendant={`${id}-${active}`}
      onKeyDown={(event) => {
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          setActive((current) => event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (options[active]) choose(options[active].value);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          button.current?.focus();
        } else if (event.key === "Tab") setOpen(false);
        else if (event.key.length === 1) {
          const index = options.findIndex((option, index) => index > active && option.label.toLowerCase().startsWith(event.key.toLowerCase()));
          if (index >= 0) setActive(index);
        }
      }}>
      {options.map((option, index) => <div key={option.value}>
        {option.separator && <div className="gmail-search-select-separator" role="separator" />}
        <div role="option" id={`${id}-${index}`} data-option-index={index} aria-selected={option.value === value} className={active === index ? "gmail-search-select-highlight" : ""} onMouseEnter={() => setActive(index)} onClick={() => choose(option.value)}>{option.label}</div>
      </div>)}
    </div>}
  </div>;
}

export function SearchDateCalendar({ value, onChange, onClose }: { value: string; onChange: (value: string) => void; onClose: () => void }) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const chosen = parseSearchDate(value) || today;
  const [month, setMonth] = useState(() => new Date(chosen.getFullYear(), chosen.getMonth(), 1, 12));
  const [active, setActive] = useState(chosen.getDate());
  const root = useRef<HTMLDivElement>(null);
  const first = new Date(month);
  first.setDate(1 - first.getDay());
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.parentElement?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [onClose]);
  const choose = (date: Date | null) => { onChange(date ? formatSearchDate(date) : ""); onClose(); };
  return <div className="gmail-search-calendar" role="dialog" aria-label="Choose a date" ref={root} onKeyDown={(event) => {
    if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); onClose(); }
    const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[event.key];
    if (delta && (event.target as HTMLElement).hasAttribute("data-calendar-day")) {
      event.preventDefault();
      const next = new Date(month.getFullYear(), month.getMonth(), active + delta, 12);
      if (next > today) return;
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1, 12));
      setActive(next.getDate());
      requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-calendar-day="${formatSearchDate(next)}"]`)?.focus());
    }
  }}>
    <div className="gmail-search-calendar-header">
      <span>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
      <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}><Icon name="chevronLeft" size={20} /></button>
      <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}><Icon name="chevronRight" size={20} /></button>
    </div>
    <table aria-label={month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}>
      <thead><tr>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <th scope="col" key={day}>{day}</th>)}</tr></thead>
      <tbody>{Array.from({ length: 6 }, (_, week) => <tr key={week}>{Array.from({ length: 7 }, (_, weekday) => {
        const date = new Date(first);
        date.setDate(first.getDate() + week * 7 + weekday);
        const selected = formatSearchDate(date) === formatSearchDate(chosen);
        const outside = date.getMonth() !== month.getMonth();
        return <td key={weekday}><button type="button" data-calendar-day={formatSearchDate(date)} aria-label={date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} aria-pressed={selected} disabled={date > today} tabIndex={!outside && date.getDate() === active ? 0 : -1} className={`${outside ? "gmail-search-calendar-outside " : ""}${selected ? "gmail-search-calendar-selected" : ""}`} onFocus={() => setActive(date.getDate())} onClick={() => choose(date)}>{date.getDate()}</button></td>;
      })}</tr>)}</tbody>
    </table>
    <div className="gmail-search-calendar-footer"><button type="button" onClick={() => choose(today)}>Today</button><button type="button" onClick={() => choose(null)}>None</button></div>
  </div>;
}

export function Search({
  emails,
  labels,
  query,
  onSearch,
  onCreateFilter,
}: SearchProps) {
  const [value, setValue] = useState(query);
  const [open, setOpen] = useState<"suggestions" | "advanced" | null>(null);
  const [selected, setSelected] = useState(-1);
  const [fields, setFields] = useState<SearchFields>(emptyFields);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const advancedSource = useRef<string | null>(null);
  const dateButton = useRef<HTMLButtonElement>(null);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(historyKey) || "[]",
      );
      return Array.isArray(stored)
        ? stored
            .filter((item): item is string => typeof item === "string")
            .slice(0, 5)
        : [];
    } catch {
      return [];
    }
  });
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const firstAdvancedInput = useRef<HTMLInputElement>(null);
  const listId = useId();
  const scopeOptions = [
    { value: "", label: "All Mail" },
    { value: "in:inbox", label: "Inbox" },
    { value: "in:starred", label: "Starred" },
    { value: "in:sent", label: "Sent Mail" },
    { value: "in:drafts", label: "Drafts" },
    { value: "in:chats", label: "Chats" },
    { value: "in:spam", label: "Spam" },
    { value: "in:trash", label: "Trash" },
    { value: "in:anywhere", label: "Mail & Spam & Trash", separator: true },
    { value: "is:read", label: "Read Mail", separator: true },
    { value: "is:unread", label: "Unread Mail" },
    ...["Purchases", "Social", "Updates", "Forums", "Promotions"].map((label, index) => ({ value: `category:${label.toLowerCase()}`, label, separator: index === 0 })),
    ...labels.map((label, index) => ({ value: `label:${label.id}`, label: label.name, separator: index === 0 })),
  ];
  const term = value.trim().toLowerCase();
  const contacts = [
    ...new Map(
      emails.map((email) => [
        email.senderEmail,
        { name: email.sender, email: email.senderEmail },
      ]),
    ).values(),
  ];
  const suggestions = [
    ...history
      .filter((item) => !term || item.toLowerCase().includes(term))
      .slice(0, 3)
      .map((item) => ({
        key: `history:${item}`,
        title: item,
        detail: "",
        query: item,
        kind: "history",
      })),
    ...(term
      ? contacts
          .filter((contact) => !/^(from|to):\S+@\S+$/i.test(term) &&
            `${contact.name} ${contact.email}`
              .toLowerCase()
               .includes(term.replace(/^(from|to):/, "")),
          )
          .slice(0, 3)
          .map((contact) => ({
            key: `contact:${contact.email}`,
            title: contact.name,
            detail: contact.email,
             query: `${term.startsWith("to:") ? "to" : "from"}:${contact.email}`,
            kind: "contact",
          }))
      : []),
    ...(term
      ? emails
          .filter((email) =>
            `${email.sender} ${email.senderEmail} ${email.subject} ${email.snippet}`
              .toLowerCase()
              .includes(term),
          )
          .slice(0, 4)
          .map((email) => ({
            key: `mail:${email.id}`,
            title: email.subject || "(no subject)",
            detail: email.sender,
            query: `subject:"${email.subject.replaceAll('"', "")}"`,
            kind: "mail",
          }))
      : []),
  ];

  useEffect(() => {
    setValue(query);
    advancedSource.current = null;
  }, [query]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(null);
        setCalendarOpen(false);
      }
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        input.current?.focus();
        setOpen(null);
        setCalendarOpen(false);
        setSelected(-1);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    if (open === "advanced") firstAdvancedInput.current?.focus();
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function showAdvanced() {
    if (advancedSource.current !== value) {
      setFields(fieldsFromQuery(value, labels));
      advancedSource.current = value;
    }
    setCalendarOpen(false);
    setOpen("advanced");
    setSelected(-1);
  }

  function submit(next: string) {
    const cleaned = next.trim();
    setValue(cleaned);
    setOpen(null);
    setCalendarOpen(false);
    setSelected(-1);
    if (cleaned) {
      const updated = [
        cleaned,
        ...history.filter((item) => item !== cleaned),
      ].slice(0, 5);
      setHistory(updated);
      try {
        localStorage.setItem(historyKey, JSON.stringify(updated));
      } catch {
        /* Search remains available when browser storage is disabled. */
      }
    }
    onSearch(cleaned);
    input.current?.blur();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen("suggestions");
      setSelected((current) => {
        if (!suggestions.length) return -1;
        if (current < 0)
          return event.key === "ArrowDown" ? 0 : suggestions.length - 1;
        return (
          (current +
            (event.key === "ArrowDown" ? 1 : -1) +
            suggestions.length) %
          suggestions.length
        );
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      submit(
        open === "suggestions" && selected >= 0 && suggestions[selected]
          ? suggestions[selected].query
          : value,
      );
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(null);
      setSelected(-1);
      input.current?.blur();
    }
  }

  function setField<K extends keyof SearchFields>(
    key: K,
    next: SearchFields[K],
  ) {
    setFields((current) => ({ ...current, [key]: next, ...(["date", "dateWithin"].includes(key) ? { originalDates: "" } : {}) }));
  }

  function buildQuery() {
    const parts: string[] = [];
    const quote = (text: string) =>
      /\s/.test(text.trim())
        ? `"${text.trim().replaceAll('"', "")}"`
        : text.trim().replaceAll('"', "");
    for (const key of ["from", "to", "subject"] as const)
      if (fields[key].trim()) parts.push(`${key}:${quote(fields[key])}`);
    if (fields.words.trim()) parts.push(fields.words.trim());
    if (fields.without.trim())
      parts.push(
        ...(fields.without.match(/"[^"]+"|\S+/g) || []).map(
          (word) => `-${word.replace(/^-/, "")}`,
        ),
      );
    if (fields.size && Number(fields.size) > 0) {
      const multiplier =
        fields.sizeUnit === "MB"
          ? 1_000_000
          : fields.sizeUnit === "KB"
            ? 1_000
            : 1;
      parts.push(
        `${fields.sizeOperator}:${Math.round(Number(fields.size) * multiplier)}`,
      );
    }
    if (fields.originalDates) parts.push(fields.originalDates);
    else if (fields.date && parseSearchDate(fields.date)) {
      const date = parseSearchDate(fields.date)!;
      const before = new Date(date);
      const after = new Date(date);
      before.setDate(before.getDate() + Number(fields.dateWithin) + 1);
      after.setDate(after.getDate() - Number(fields.dateWithin));
      parts.push(`after:${formatSearchDate(after)}`, `before:${formatSearchDate(before)}`);
    }
    if (fields.folder.startsWith("label:")) {
      const label = labels.find((item) => item.id === fields.folder.slice(6));
      if (label) parts.push(`label:${quote(label.name)}`);
    } else if (fields.folder) parts.push(fields.folder);
    if (fields.attachment) parts.push("has:attachment");
    return parts.join(" ");
  }

  function advancedSearch(event?: FormEvent) {
    event?.preventDefault();
    if (fields.date && !parseSearchDate(fields.date)) return;
    submit(buildQuery());
  }

  return (
    <div
      className={`gmail-search gmail-search-fidelity${open === "suggestions" ? " gmail-search-active" : ""}`}
      ref={root}
      onBlur={(event) => {
        if (
          open === "suggestions" &&
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(null);
      }}
    >
      <form
        className="gmail-search-bar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
      >
        <button
          className="icon-button gmail-search-submit"
          aria-label="Search mail"
          title="Search mail"
          type="submit"
        >
          <Icon name="searchPlain" size={24} />
        </button>
        <input
          ref={input}
          className="gmail-search-input"
          aria-label="Search mail"
          placeholder="Search mail"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open === "suggestions"}
          aria-controls={open === "suggestions" ? listId : undefined}
          aria-activedescendant={
            open === "suggestions" && selected >= 0
              ? `${listId}-${selected}`
              : undefined
          }
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen("suggestions");
            setSelected(-1);
          }}
          onFocus={() => {
            if (open !== "advanced") setOpen("suggestions");
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            className="icon-button gmail-search-clear"
            aria-label="Clear search"
            title="Clear search"
            onClick={() => {
              setValue("");
              advancedSource.current = null;
              setSelected(-1);
              input.current?.focus();
              setOpen("suggestions");
            }}
          >
            <Icon name="close" size={24} />
          </button>
        )}
        <button
          type="button"
          className="icon-button gmail-search-options"
          aria-label="Advanced search options"
          title="Show search options"
          aria-expanded={open === "advanced"}
          onClick={() => {
            if (open === "advanced") { setOpen(null); setCalendarOpen(false); }
            else showAdvanced();
          }}
        >
          <Icon name="tune" size={24} />
        </button>
      </form>

      {open === "suggestions" && (
        <div className="gmail-search-suggestions">
          <div className="gmail-search-suggestion-chips">
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => submit(replaceSearchOperators(value, /^-?has:attachment$/i, "has:attachment"))}>Has attachment</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => submit(replaceSearchOperators(value, /^-?(after|before|newer|older|newer_than|older_than):/i, "newer_than:7d"))}>Last 7 days</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => submit(replaceSearchOperators(value, /^-?from:/i, "from:me"))}>From me</button>
          </div>
          <div id={listId} role="listbox" aria-label="Search suggestions">
            {suggestions.map((suggestion, index) => (
              <div
                className={`gmail-search-suggestion${selected === index ? " gmail-search-suggestion-selected" : ""}`}
                key={suggestion.key}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected === index}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setSelected(index)}
                onClick={() => submit(suggestion.query)}
              >
                {suggestion.kind === "contact" ? (
                  <img className="gmail-suggestion-avatar" src="/icons/person.png" alt="" />
                ) : (
                  <Icon
                    name={suggestion.kind === "history" ? "clock" : "inbox"}
                    size={20}
                  />
                )}
                <span className="gmail-suggestion-text">
                  <span>{suggestion.title}</span>
                  {suggestion.detail && <small>{suggestion.detail}</small>}
                </span>
                {suggestion.kind === "history" && (
                  <button
                    type="button"
                    className="icon-button gmail-history-remove"
                    aria-label={`Remove recent search ${suggestion.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      const updated = history.filter(
                        (item) => item !== suggestion.query,
                      );
                      setHistory(updated);
                      setSelected(-1);
                      try {
                        localStorage.setItem(
                          historyKey,
                          JSON.stringify(updated),
                        );
                      } catch {
                        /* History is also kept in memory. */
                      }
                    }}
                  >
                    <Icon name="close" size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {term && (
            <button
              className="gmail-search-all"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => submit(value)}
            >
              <span className="gmail-search-all-label">
                All search results for &quot;{value}&quot;
              </span>
              <span className="gmail-search-enter">Press ENTER</span>
            </button>
          )}
          {!term && (
            <button
              className="gmail-search-all"
              type="button"
              onClick={showAdvanced}
            >
              <Icon name="tune" size={20} />
              <span>Advanced search</span>
            </button>
          )}
        </div>
      )}

      {open === "advanced" && (
        <form
          className="gmail-advanced-search"
          role="dialog"
          aria-label="Advanced search"
          onSubmit={advancedSearch}
        >
          {(["from", "to", "subject", "words", "without"] as const).map(
            (key, index) => (
              <label className="gmail-advanced-row" key={key}>
                <span>
                  {
                    ["From", "To", "Subject", "Has the words", "Doesn't have"][
                      index
                    ]
                  }
                </span>
                <input
                  ref={key === "from" ? firstAdvancedInput : undefined}
                  value={fields[key]}
                  onChange={(event) => setField(key, event.target.value)}
                />
              </label>
            ),
          )}
          <div className="gmail-advanced-row">
            <label htmlFor={`${listId}-size`}>Size</label>
            <div className="gmail-advanced-inline gmail-advanced-size">
              <SearchSelect
                label="Size operator"
                value={fields.sizeOperator}
                className="gmail-search-size-operator"
                onChange={(value) => setField("sizeOperator", value)}
                options={[{ value: "larger", label: "greater than" }, { value: "smaller", label: "less than" }]}
              />
              <input
                id={`${listId}-size`}
                type="text"
                inputMode="decimal"
                aria-label="Size value"
                value={fields.size}
                onChange={(event) => setField("size", event.target.value)}
              />
              <SearchSelect
                label="Size unit"
                className="gmail-search-size-unit"
                value={fields.sizeUnit}
                onChange={(value) => setField("sizeUnit", value)}
                options={["MB", "KB", "Bytes"].map((value) => ({ value, label: value }))}
              />
            </div>
          </div>
          <div className="gmail-advanced-row">
            <label htmlFor={`${listId}-date`}>Date within</label>
            <div className="gmail-advanced-inline gmail-advanced-date">
              <SearchSelect
                label="Date within"
                className="gmail-search-date-within"
                value={fields.dateWithin}
                onChange={(value) => setField("dateWithin", value)}
                options={dateOptions}
              />
              <div className="gmail-search-date-field">
              <input
                id={`${listId}-date`}
                type="text"
                aria-label="Date"
                aria-invalid={!!fields.date && !parseSearchDate(fields.date)}
                value={fields.date}
                onChange={(event) => setField("date", event.target.value)}
                onClick={() => {
                  if (!fields.date) setField("date", formatSearchDate(new Date()));
                  setCalendarOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setCalendarOpen(true);
                    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(".gmail-search-calendar [aria-pressed='true']")?.focus());
                  }
                }}
              />
              <button type="button" ref={dateButton} aria-label="Choose date" aria-haspopup="dialog" aria-expanded={calendarOpen} onClick={() => {
                if (!fields.date) setField("date", formatSearchDate(new Date()));
                setCalendarOpen((current) => !current);
              }}><Icon name="calendar" size={20} /></button>
              {calendarOpen && <SearchDateCalendar value={fields.date} onChange={(value) => setField("date", value)} onClose={() => { setCalendarOpen(false); dateButton.current?.focus(); }} />}
              </div>
            </div>
          </div>
          <div className="gmail-advanced-row">
            <span>Search</span>
            <SearchSelect
              className="gmail-search-scope"
              label={scopeOptions.find((option) => option.value === fields.folder)?.label || "All Mail"}
              value={fields.folder}
              onChange={(value) => setField("folder", value)}
              options={scopeOptions}
            />
          </div>
          <div className="gmail-advanced-checks">
            <SearchCheckbox checked={fields.attachment} onChange={(value) => setField("attachment", value)}>Has attachment</SearchCheckbox>
          </div>
          <div className="gmail-advanced-actions">
            <button
              type="button"
              className="gmail-create-filter"
              disabled={!buildQuery().trim() || (!!fields.date && !parseSearchDate(fields.date))}
              onClick={() => {
                setOpen(null);
                onCreateFilter(buildQuery());
              }}
            >
              Create filter
            </button>
            <button className="gmail-advanced-submit" type="submit">
              Search
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
