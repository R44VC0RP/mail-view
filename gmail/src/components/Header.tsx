import { useEffect, useRef, useState } from "react";
import type { Email, Label } from "../types";
import { Icon } from "../ui/Icon";
import { Search } from "./Search";
import "./shell.css";
import "./chrome-fidelity.css";

export type HeaderProps = {
  emails: Email[];
  labels: Label[];
  query: string;
  onSearch: (query: string) => void;
  onToggleSidebar: () => void;
  onSettings: () => void;
  onHelp: (topic?: "help" | "training" | "feedback") => void;
  onCreateFilter: (query: string) => void;
};

export function Header({
  emails,
  labels,
  query,
  onSearch,
  onToggleSidebar,
  onSettings,
  onHelp,
  onCreateFilter,
}: HeaderProps) {
  const [popover, setPopover] = useState<
    "support" | "apps" | "account" | "contacts" | "status" | null
  >(null);
  const [status, setStatus] = useState("Active");
  const controls = useRef<HTMLDivElement>(null);
  const supportButton = useRef<HTMLButtonElement>(null);
  const supportMenu = useRef<HTMLDivElement>(null);
  const [supportPosition, setSupportPosition] = useState({ left: 0, top: 52 });
  const contacts = [
    ...new Map(
      emails.map((email) => [
        email.senderEmail,
        { name: email.sender, email: email.senderEmail },
      ]),
    ).values(),
  ].slice(0, 12);

  useEffect(() => {
    if (!popover) return;
    const dismiss = (event: PointerEvent) => {
      if (!controls.current?.contains(event.target as Node)) setPopover(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPopover(null);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [popover]);

  useEffect(() => {
    if (popover === "support") supportMenu.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [popover]);

  function toggle(next: "support" | "apps" | "account" | "status") {
    setPopover((current) => (current === next ? null : next));
  }

  return (
    <header className="gmail-header">
      <div className="gmail-header-brand">
        <button
          className="icon-button gmail-menu-button"
          aria-label="Main menu"
          title="Main menu"
          onClick={onToggleSidebar}
        >
          <Icon name="menu" size={24} />
        </button>
        <button
          className="gmail-logo"
          aria-label="Gmail home"
          onClick={() => onSearch("")}
        >
          <img src="/gmail-lockup.png" srcSet="/gmail-lockup.png 1x, /gmail-lockup-2x.png 2x" alt="Gmail" width="109" height="40" />
        </button>
      </div>
      <Search
        emails={emails}
        labels={labels}
        query={query}
        onSearch={onSearch}
        onCreateFilter={onCreateFilter}
      />
      <div className="gmail-header-controls" ref={controls}>
        <button
          className="gmail-status-button"
          aria-label={`Status: ${status}`}
          aria-expanded={popover === "status"}
          onClick={() => toggle("status")}
        >
          <span
            className={`gmail-status-dot gmail-status-dot-${status === "Active" ? "active" : status === "Away" ? "away" : "dnd"}`}
          />
          {status}
          <Icon name="statusChevron" size={18} />
        </button>
        <button
          className="icon-button gmail-header-control"
          title="Support"
          ref={supportButton}
          aria-label="Support"
          aria-expanded={popover === "support"}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setSupportPosition({ left: Math.max(8, rect.right - 220.3515625), top: rect.bottom });
            toggle("support");
          }}
        >
          <Icon name="help" size={24} />
        </button>
        <button
          className="icon-button gmail-header-control"
          title="Settings"
          aria-label="Settings"
          onClick={() => {
            setPopover(null);
            onSettings();
          }}
        >
          <Icon name="settings" size={24} />
        </button>
        <button
          className="icon-button gmail-header-control"
          title="Google apps"
          aria-label="Google apps"
          aria-expanded={popover === "apps" || popover === "contacts"}
          onClick={() => toggle("apps")}
        >
          <Icon name="apps" size={24} />
        </button>
        <button
          className="gmail-account-button"
          title="Google Account"
          aria-label="Google Account"
          aria-expanded={popover === "account"}
          onClick={() => toggle("account")}
        >
          <span className="gmail-account-org">Or</span>
          <span className="gmail-account-avatar">A</span>
        </button>

        {popover === "status" && (
          <div
            className="gmail-header-popover gmail-status-popover"
            role="menu"
            aria-label="Set status"
          >
            {["Active", "Do not disturb", "Away"].map((value) => (
              <button
                role="menuitemradio"
                aria-checked={value === status}
                key={value}
                onClick={() => {
                  setStatus(value);
                  setPopover(null);
                }}
              >
                <span
                  className={`gmail-status-dot gmail-status-dot-${value === "Active" ? "active" : value === "Away" ? "away" : "dnd"}`}
                />
                <span>
                  {value}
                  <small>
                    {value === "Active"
                      ? "Based on your activity"
                      : value === "Do not disturb"
                        ? "Mute notifications"
                        : "Appear as away"}
                  </small>
                </span>
                {value === status && <Icon name="check" size={18} />}
              </button>
            ))}
          </div>
        )}
        {popover === "support" && (
          <div
            className="gmail-header-popover gmail-support-popover"
            ref={supportMenu}
            style={supportPosition}
            role="menu"
            aria-label="Support"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setPopover(null);
                supportButton.current?.focus();
                return;
              }
              if (event.key === "Tab") {
                setPopover(null);
                return;
              }
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
              const index = items.indexOf(event.target as HTMLButtonElement);
              const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
              event.preventDefault();
              items[next]?.focus();
            }}
          >
            <button
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setPopover(null);
                onHelp("help");
              }}
            >
              Help
            </button>
            <button role="menuitem" tabIndex={-1} onClick={() => {
              setPopover(null);
              onHelp("training");
            }}>Training</button>
            <div className="gmail-support-divider" role="separator" />
            <button role="menuitem" tabIndex={-1} onClick={() => {
              setPopover(null);
              onHelp("feedback");
            }}>Send feedback to Google</button>
          </div>
        )}

        {popover === "apps" && (
          <div
            className="gmail-header-popover gmail-apps-popover"
            role="dialog"
            aria-label="Google apps"
          >
            <div className="gmail-apps-grid">
              <button
                onClick={() => {
                  onSearch("");
                  setPopover(null);
                }}
              >
                <span className="gmail-app-symbol gmail-app-mail">
                  <img src="/gmail.svg" width="32" height="24" alt="" />
                </span>
                Gmail
              </button>
              <button onClick={() => setPopover("contacts")}>
                <span className="gmail-app-symbol gmail-app-contacts">C</span>
                Contacts
              </button>
              <button
                onClick={() => {
                  onSearch("has:attachment");
                  setPopover(null);
                }}
              >
                <span className="gmail-app-symbol gmail-app-files">
                  <Icon name="archive" size={27} />
                </span>
                Attachments
              </button>
            </div>
            <p className="gmail-apps-note">Available in this local inbox</p>
          </div>
        )}

        {popover === "contacts" && (
          <div
            className="gmail-header-popover gmail-contacts-popover"
            role="dialog"
            aria-label="Contacts"
          >
            <div className="gmail-popover-heading">
              <button
                className="icon-button"
                aria-label="Back to apps"
                onClick={() => setPopover("apps")}
              >
                <Icon name="chevronLeft" size={20} />
              </button>
              <strong>Contacts</strong>
            </div>
            <div className="gmail-contacts-list">
              {contacts.map((contact) => (
                <button
                  key={contact.email}
                  onClick={() => {
                    onSearch(`from:${contact.email}`);
                    setPopover(null);
                  }}
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
              {contacts.length === 0 && <p>No contacts in this inbox yet.</p>}
            </div>
          </div>
        )}

        {popover === "account" && (
          <div
            className="gmail-header-popover gmail-account-popover"
            role="dialog"
            aria-label="Google Account"
          >
            <button
              className="icon-button gmail-account-close"
              aria-label="Close account menu"
              onClick={() => setPopover(null)}
            >
              <Icon name="close" size={20} />
            </button>
            <span className="gmail-account-avatar gmail-account-avatar-large">
              A
            </span>
            <h2>Your Gmail account</h2>
            <p>This inbox runs locally. No Google sign-in is needed.</p>
            <div className="gmail-account-summary">
              <strong>{emails.length.toLocaleString()}</strong> conversations{" "}
              <span aria-hidden="true">&middot;</span>{" "}
              <strong>{labels.length}</strong> labels
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
