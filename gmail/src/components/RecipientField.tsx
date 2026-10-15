import { useEffect, useId, useRef, useState } from "react";
import type { Address } from "../types";
import { Icon } from "../ui/Icon";
import "./editor.css";

export type RecipientFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  contacts?: Address[];
  recipientSuggestions?: Address[];
  autoFocus?: boolean;
  onBlur?: () => void;
  accountDomain?: string;
  onSelectContacts?: () => void;
};

export function splitRecipients(value: string) {
  return (value.match(/(?:"[^"]*"|[^,;])+/g) || [])
    .map((part) => part.trim())
    .filter(Boolean);
}

export function recipientAddress(value: string) {
  const match = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  const email = match ? match[2].trim() : value.trim();
  const name = match ? match[1].replace(/^"|"$/g, "") : "";
  return {
    name: name.toLowerCase() === email.toLowerCase() ? "" : name,
    email,
  };
}

export function RecipientField({
  label,
  value,
  onChange,
  contacts = [],
  recipientSuggestions = contacts,
  autoFocus = false,
  onBlur,
  accountDomain = "example.org",
  onSelectContacts,
}: RecipientFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const lastValue = useRef(value);
  const [chips, setChips] = useState(() => splitRecipients(value));
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [suggestion, setSuggestion] = useState(0);
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);
  const query = text.trim().toLowerCase();
  const suggestions =
    query && !suggestionsHidden
      ? recipientSuggestions
          .filter(
            (contact) =>
              `${contact.name} ${contact.email}`
                .toLowerCase()
                .includes(query) &&
              !chips.some(
                (chip) =>
                  recipientAddress(chip).email.toLowerCase() ===
                  contact.email.toLowerCase(),
              ),
          )
          .slice(0, 6)
      : [];

  useEffect(() => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    setChips(splitRecipients(value));
    setText("");
    setSelected(null);
  }, [value]);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  function publish(next: string[], pending: string) {
    const serialized = [...next, ...(pending ? [pending] : [])].join(", ");
    lastValue.current = serialized;
    onChange(serialized);
  }

  function commit(address = text) {
    const added = splitRecipients(address);
    if (!added.length) return;
    const next = [...chips, ...added];
    setChips(next);
    setText("");
    setSelected(null);
    setSuggestion(0);
    publish(next, "");
  }

  function remove(index: number) {
    const next = chips.filter((_, current) => current !== index);
    setChips(next);
    setSelected(null);
    publish(next, text);
    input.current?.focus();
  }

  return (
    <div
      className={`gmail-recipient-field ${focused ? "gmail-recipient-focused" : ""}`}
      data-label={label}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null))
          return;
        if (text.trim()) commit();
        setFocused(false);
        setSelected(null);
        onBlur?.();
      }}
    >
      <label
        htmlFor={id}
        role={onSelectContacts ? "button" : undefined}
        tabIndex={onSelectContacts ? 0 : undefined}
        onClick={(event) => {
          if (onSelectContacts) {
            event.preventDefault();
            onSelectContacts();
          }
        }}
        onKeyDown={(event) => {
          if (onSelectContacts && ["Enter", " "].includes(event.key)) {
            event.preventDefault();
            onSelectContacts();
          }
        }}
      >
        {label}
      </label>
      <div
        className="gmail-recipient-entry"
        onClick={(event) => {
          if (event.target === event.currentTarget) input.current?.focus();
        }}
      >
        {chips.map((chip, index) => {
          const address = recipientAddress(chip);
          const contact = contacts.find(
            (item) => item.email.toLowerCase() === address.email.toLowerCase(),
          );
          const contactName = contact?.name.trim();
          const namedContact = Boolean(
            contactName && contactName.toLowerCase() !== address.email.toLowerCase(),
          );
          const valid = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address.email);
          const external =
            valid &&
            !contact &&
            address.email.split("@")[1].toLowerCase() !==
              accountDomain.toLowerCase();
          return (
            <span
              key={`${index}-${chip}`}
              className={`gmail-recipient-chip ${selected === index ? "gmail-chip-selected" : ""} ${valid ? "" : "gmail-chip-invalid"} ${external ? "gmail-chip-external" : ""} ${namedContact ? "gmail-chip-known" : ""}`}
              title={chip}
              onClick={() => {
                setSelected(index);
                input.current?.focus();
              }}
              onDoubleClick={() => {
                const next = chips.filter((_, current) => current !== index);
                setChips(next);
                setText(chip);
                setSelected(null);
                publish(next, chip);
                input.current?.focus();
              }}
            >
              <span
                className={
                  namedContact ? "gmail-chip-avatar" : "gmail-chip-leading"
                }
                aria-hidden="true"
              >
                {namedContact ? contactName?.charAt(0).toUpperCase() : external ? (
                  <Icon name="recipientWarning" size={24} />
                ) : null}
              </span>
              <span className="gmail-chip-name">
                {address.name || (namedContact ? contactName : address.email)}
              </span>
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Remove ${address.email}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  remove(index);
                }}
              >
                <Icon name="recipientRemove" size={18} />
              </button>
            </span>
          );
        })}
        <input
          ref={input}
          id={id}
          aria-label={label}
          autoComplete="off"
          spellCheck={false}
          value={text}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={focused && suggestions.length > 0}
          aria-controls={
            focused && suggestions.length ? `${id}-suggestions` : undefined
          }
          aria-activedescendant={
            focused && suggestions.length
              ? `${id}-suggestion-${suggestion}`
              : undefined
          }
          onFocus={() => {
            setFocused(true);
            setSuggestionsHidden(false);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setSelected(null);
            setSuggestion(0);
            setSuggestionsHidden(false);
            if (/[,;]$/.test(next) && !/"[^"]*$/.test(next)) commit(next);
            else {
              setText(next);
              publish(chips, next);
            }
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape" && suggestions.length) {
              event.preventDefault();
              event.stopPropagation();
              setSuggestionsHidden(true);
              return;
            }
            if (
              ["ArrowDown", "ArrowUp"].includes(event.key) &&
              suggestions.length
            ) {
              event.preventDefault();
              setSuggestion(
                (index) =>
                  (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    suggestions.length) %
                  suggestions.length,
              );
              return;
            }
            if (["Enter", ",", ";", "Tab"].includes(event.key) && text.trim()) {
              if (event.key !== "Tab") event.preventDefault();
              const contact = suggestions[suggestion];
              if (contact && ["Enter", "Tab"].includes(event.key))
                commit(
                  contact.name && contact.name.toLowerCase() !== contact.email.toLowerCase()
                    ? `${contact.name} <${contact.email}>` : contact.email,
                );
              else commit();
              return;
            }
            if (event.key === "Backspace" && !text && chips.length) {
              event.preventDefault();
              if (selected !== null) remove(selected);
              else setSelected(chips.length - 1);
            } else if (event.key === "Delete" && selected !== null) {
              event.preventDefault();
              remove(selected);
            } else if (event.key === "ArrowLeft" && !text && chips.length) {
              event.preventDefault();
              setSelected((index) => Math.max(0, (index ?? chips.length) - 1));
            } else if (event.key === "ArrowRight" && selected !== null) {
              event.preventDefault();
              setSelected(selected + 1 < chips.length ? selected + 1 : null);
            }
          }}
        />
      </div>
      {focused && suggestions.length > 0 && (
        <div
          id={`${id}-suggestions`}
          className="gmail-recipient-suggestions"
          role="listbox"
          aria-label="Suggested contacts"
        >
          {suggestions.map((contact, index) => (
            <button
              type="button"
              id={`${id}-suggestion-${index}`}
              key={contact.email}
              role="option"
              aria-selected={index === suggestion}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setSuggestion(index)}
              onClick={() => commit(
                contact.name && contact.name.toLowerCase() !== contact.email.toLowerCase()
                  ? `${contact.name} <${contact.email}>` : contact.email,
              )}
            >
              <span className="gmail-contact-avatar">
                {contact.name.charAt(0).toUpperCase()}
              </span>
              <span>
                <strong>{contact.name}</strong>
                <small>{contact.email}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
