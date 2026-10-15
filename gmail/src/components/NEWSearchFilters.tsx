import { useEffect, useId, useRef, useState } from "react";
import type { Email, Label } from "../types";
import { Icon } from "../ui/Icon";
import { replaceSearchOperators, searchQueryParts, SearchSelect } from "./Search";
import "./search-fidelity.css";

export type NEWSearchFiltersProps = {
  view: string;
  query: string;
  onSearch: (query: string) => void;
  onAdvanced: () => void;
  emails: Email[];
  labels: Label[];
};

export function NEWSearchFilters({ view, query, onSearch, onAdvanced, emails }: NEWSearchFiltersProps) {
  const [tab, setTab] = useState("Mail");
  const [toOpen, setToOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [active, setActive] = useState(-1);
  const toRoot = useRef<HTMLDivElement>(null);
  const toInput = useRef<HTMLInputElement>(null);
  const id = useId();
  const searching = view === "search";
  const parts = searchQueryParts(query);
  const attachment = parts.some((part) => /^has:attachment$/i.test(part));
  const currentTo = parts.find((part) => /^to:/i.test(part))?.slice(3).replace(/^"(.*)"$/, "$1") || "";
  const currentTime = parts.find((part) => /^newer_than:/i.test(part)) || "";
  const contacts = [...new Map(emails.flatMap((email) => email.messages.flatMap((message) => message.to)).map((address) => [address.email.toLowerCase(), address])).values()]
    .filter((address) => `${address.name} ${address.email}`.toLowerCase().includes(recipient.toLowerCase())).slice(0, 6);
  useEffect(() => {
    if (!toOpen) return;
    const outside = (event: PointerEvent) => {
      if (!toRoot.current?.contains(event.target as Node)) setToOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    toInput.current?.focus();
    return () => document.removeEventListener("pointerdown", outside);
  }, [toOpen]);
  useEffect(() => {
    setTab("Mail");
    setToOpen(false);
  }, [view]);
  useEffect(() => {
    if (!searchQueryParts(query).some((part) => /^in:chats$/i.test(part))) setTab("Mail");
  }, [query]);
  if (!searching && view !== "sent" && view !== "drafts") return null;

  function refine(operators: RegExp, replacement: string) {
    let next = replaceSearchOperators(query, operators, replacement);
    if (!searching) next = [`in:${view}`, replaceSearchOperators(next, /^-?in:/i, "")].filter(Boolean).join(" ");
    onSearch(next);
  }
  function chooseRecipient(value: string) {
    refine(/^-?to:/i, value.trim() ? `to:${/\s/.test(value.trim()) ? `"${value.trim().replaceAll('"', "")}"` : value.trim()}` : "");
    setToOpen(false);
  }
  return <div className={`gmail-search-filters${searching ? " gmail-search-filters-search" : ""}`}>
    {searching && <div className="gmail-search-tabs" role="tablist" aria-label="Search type">
      {["Mail", "Conversations", "Spaces"].map((name) => <button type="button" key={name} role="tab" aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} onClick={() => {
        setTab(name);
        onSearch(replaceSearchOperators(query, /^in:chats$/i, name === "Mail" ? "" : "in:chats"));
      }} onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const tabs = [...event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>("button")];
        const next = tabs[(tabs.indexOf(event.currentTarget) + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
        next.focus();
        next.click();
      }}>{name}</button>)}
    </div>}
    <div className="gmail-search-refinements" role="toolbar" aria-label="search refinement">
      <SearchSelect className="gmail-search-time-chip" label="Any time" value={currentTime} onChange={(value) => refine(/^-?(after|before|newer|older|newer_than|older_than):/i, value)} options={[
        { value: "", label: "Any time" },
        { value: "newer_than:1d", label: "Past day" },
        { value: "newer_than:7d", label: "Past week" },
        { value: "newer_than:1m", label: "Past month" },
        { value: "newer_than:1y", label: "Past year" },
      ]} />
      <button type="button" className="gmail-search-filter-chip" aria-pressed={attachment} onClick={() => refine(/^-?has:attachment$/i, attachment ? "" : "has:attachment")}>Has attachment</button>
      <div className="gmail-search-to" ref={toRoot}>
        <button type="button" className="gmail-search-filter-chip" aria-haspopup="dialog" aria-expanded={toOpen} onClick={() => {
          setRecipient(currentTo);
          setActive(-1);
          setToOpen((current) => !current);
        }}><span>{currentTo || "To"}</span><Icon name="arrowDropDown" size={20} /></button>
        {toOpen && <div className="gmail-search-to-popup" role="dialog" aria-label="To" onKeyDown={(event) => {
          if (event.key === "Escape") { event.stopPropagation(); setToOpen(false); toRoot.current?.querySelector<HTMLButtonElement>("button")?.focus(); }
        }}>
          <input ref={toInput} aria-label="Recipient" role="combobox" aria-expanded={contacts.length > 0} aria-controls={`${id}-contacts`} aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined} placeholder="Name or email" value={recipient} onChange={(event) => { setRecipient(event.target.value); setActive(-1); }} onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => !contacts.length ? -1 : (current + (event.key === "ArrowDown" ? 1 : -1) + contacts.length) % contacts.length);
            } else if (event.key === "Enter") { event.preventDefault(); chooseRecipient(active >= 0 && contacts[active] ? contacts[active].email : recipient); }
          }} />
          <div role="listbox" id={`${id}-contacts`} aria-label="Recipients">
            {contacts.map((contact, index) => <button type="button" role="option" id={`${id}-${index}`} aria-selected={active === index} key={contact.email} onMouseEnter={() => setActive(index)} onClick={() => chooseRecipient(contact.email)}><img src="/icons/person.png" alt="" /><span>{contact.name || contact.email}<small>{contact.email}</small></span></button>)}
          </div>
          <div className="gmail-search-to-actions"><button type="button" onClick={() => chooseRecipient("")}>Clear</button><button type="button" onClick={() => chooseRecipient(recipient)}>Apply</button></div>
        </div>}
      </div>
      <button type="button" className="gmail-search-advanced-link" onClick={onAdvanced}>Advanced search</button>
    </div>
  </div>;
}

export function SearchSort({ value, onChange }: { value: "relevant" | "recent"; onChange: (value: "relevant" | "recent") => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    menu.current?.querySelector<HTMLButtonElement>(`[aria-checked="true"]`)?.focus();
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="gmail-search-sort" ref={root}>
    <button type="button" ref={button} className="gmail-search-sort-button" aria-label={`Showing most ${value}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
    }}>Showing most {value}<Icon name="arrowDropDown" size={16} /></button>
    {open && <div ref={menu} id={id} className="gmail-search-sort-menu" role="menu" aria-label="Sort options" onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); button.current?.focus(); }
      else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
        const index = options.indexOf(document.activeElement as HTMLButtonElement);
        options[event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + 1) % options.length]?.focus();
      } else if (event.key === "Tab") setOpen(false);
    }}>
      <div className="gmail-search-sort-heading">Show</div>
      {(["relevant", "recent"] as const).map((option, index) => <div key={option}>
        {index > 0 && <div className="gmail-search-sort-divider" role="separator" />}
        <button type="button" role="menuitemradio" aria-checked={value === option} onClick={() => { onChange(option); setOpen(false); button.current?.focus(); }}>
          <span>Most {option}<small>{option === "relevant" ? "Top matches for you" : "Exact matches"}</small></span>
          {value === option && <Icon name="check" size={24} />}
        </button>
      </div>)}
    </div>}
  </div>;
}

export function SearchContactBanner({ query, emails }: { query: string; emails: Email[] }) {
  const addresses = searchQueryParts(query).filter((part) => /^(from|to):/i.test(part));
  if (addresses.length !== 1) return null;
  const match = addresses[0].match(/^(from|to):\(?"?([^"\s()<>]+@[^"\s()<>]+)"?\)?$/i);
  if (!match) return null;
  const address = match[2].toLowerCase();
  const contact = match[1].toLowerCase() === "from"
    ? emails.flatMap((email) => [{ name: email.sender, email: email.senderEmail }, ...email.messages.map((message) => message.from)]).find((item) => item.email.toLowerCase() === address)
    : emails.flatMap((email) => email.messages.flatMap((message) => message.to)).find((item) => item.email.toLowerCase() === address);
  if (!contact) return null;
  return <div className="gmail-search-contact-banner">
    <div className="gmail-search-contact-card">
      <div className="gmail-search-contact-identity"><span className="gmail-search-contact-avatar"><img src="/icons/person.png" width={48} height={48} alt="" /></span><span className="gmail-search-contact-name">{contact.email}</span></div>
      <span className="gmail-search-contact-email"><Icon name="mail" size={20} /><a href={`#compose?to=${encodeURIComponent(contact.email)}`} onClick={(event) => {
        event.preventDefault();
        document.dispatchEvent(new CustomEvent("gopen:compose", { detail: { to: contact.email } }));
      }}>{contact.email}</a></span>
    </div>
  </div>;
}
