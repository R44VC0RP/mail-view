import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Email, Label } from "../types";
import { Icon } from "../ui/Icon";
import { ComposeModal } from "./ComposeDialogs";
import type { FilterRule } from "./FilterDialog";
import { FormattingToolbar } from "./FormattingToolbar";
import { RichTextEditor } from "./RichTextEditor";
import type { RichTextEditorHandle } from "./RichTextEditor";
import "./settings-fidelity.css";

export type SettingsViewProps = {
  tab: "labels" | "general" | "filters";
  labels: Label[];
  emails: Email[];
  onTab: (tab: "labels" | "general" | "filters") => void;
  onClose: () => void;
  onCreateLabel: (parentId?: string) => void;
  onLabelAction: (action: "edit" | "delete" | "color" | "visibility" | "messageVisibility", id: string, value?: string) => void;
  onLabelVisibility: (id: string, visible: boolean) => void;
  keyboardShortcuts: boolean;
  onKeyboardShortcuts: (enabled: boolean) => void;
  filters?: FilterRule[];
  onCreateFilter?: () => void;
  onEditFilter?: (rule: FilterRule) => void;
  onDeleteFilter?: (id: string) => void;
};

type Visibility = "show" | "hide" | "unread";
type Signature = { name: string; body: string; html: string };
type GeneralPreferences = {
  buttonLabels: "icons" | "text";
  autoContacts: boolean;
  indicators: boolean;
  snippets: boolean;
  vacation: boolean;
  vacationFirst: string;
  vacationLast: string;
  vacationUseLast: boolean;
  vacationSubject: string;
  vacationBody: string;
  vacationHtml: string;
  vacationPlain: boolean;
  notifications: "important" | "off";
  stars: string[];
};

const tabs: { name: string; id?: SettingsViewProps["tab"] }[] = [
  { name: "General", id: "general" },
  { name: "Labels", id: "labels" },
  { name: "Inbox" },
  { name: "Accounts" },
  { name: "Filters and Blocked Addresses", id: "filters" },
  { name: "Forwarding and POP/IMAP" },
  { name: "Add-ons" },
  { name: "Chat and Meet" },
  { name: "Advanced" },
  { name: "Offline" },
  { name: "Themes" },
];
const systemLabels: { name: string; mode: Visibility; unread?: boolean }[] = [
  { name: "Inbox", mode: "show" },
  { name: "Starred", mode: "show" },
  { name: "Snoozed", mode: "show" },
  { name: "Important", mode: "hide" },
  { name: "Sent", mode: "show" },
  { name: "Scheduled", mode: "unread", unread: true },
  { name: "Drafts", mode: "show", unread: true },
  { name: "All Mail", mode: "hide" },
  { name: "Spam", mode: "hide", unread: true },
  { name: "Trash", mode: "hide" },
];
const categories = ["Categories", "Purchases", "Social", "Updates", "Forums", "Promotions"];
const stars = [
  { name: "yellow-star" },
  { name: "orange-star" },
  { name: "red-star" },
  { name: "purple-star" },
  { name: "blue-star" },
  { name: "green-star" },
  { name: "red-bang" },
  { name: "orange-guillemet" },
  { name: "yellow-bang" },
  { name: "green-check" },
  { name: "blue-info" },
  { name: "purple-question" },
];

function readPreference<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export function SettingsView({
  tab, labels, emails, onTab, onClose, onCreateLabel, onLabelAction,
  onLabelVisibility, keyboardShortcuts, onKeyboardShortcuts,
  filters, onCreateFilter, onEditFilter, onDeleteFilter,
}: SettingsViewProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const signatureSection = useRef<HTMLElement>(null);
  const editor = useRef<RichTextEditorHandle>(null);
  const vacationEditor = useRef<RichTextEditorHandle>(null);
  const [visibility, setVisibility] = useState<Record<string, Visibility>>(() => readPreference("gopen-settings-label-visibility", {}));
  const [messageVisibility, setMessageVisibility] = useState<Record<string, Visibility>>(() => readPreference("gopen-settings-message-visibility", {}));
  const [imap, setImap] = useState<Record<string, boolean>>(() => readPreference("gopen-settings-imap", {}));
  const [shortcuts, setShortcuts] = useState(keyboardShortcuts);
  const [preferences, setPreferences] = useState<GeneralPreferences>(() => ({
    buttonLabels: "icons", autoContacts: true, indicators: false, snippets: true,
    vacation: false, vacationFirst: "August 27, 2026", vacationLast: "",
    vacationUseLast: false, vacationSubject: "", vacationBody: "", vacationHtml: "",
    vacationPlain: false, notifications: "off", stars: ["yellow-star"],
    ...readPreference<Partial<GeneralPreferences>>("gopen-settings-general", {}),
  }));
  const [signatures, setSignatures] = useState<Signature[]>(() => {
    const saved = readPreference<Signature[]>("gopen-signatures", []);
    if (Array.isArray(saved) && saved.length) return saved;
    // Composer already persists plain signature text; preserve existing local signatures.
    const body = localStorage.getItem("gopen-compose-signature") || "";
    return body ? [{ name: "My signature", body, html: "" }] : [];
  });
  const [selectedSignature, setSelectedSignature] = useState(() => signatures[0]?.name || "");
  const [defaultSignature, setDefaultSignature] = useState(() => localStorage.getItem("gopen-default-signature") ?? signatures[0]?.name ?? "");
  const [nameDialog, setNameDialog] = useState<{ name: string; original?: string } | null>(null);
  const [nameError, setNameError] = useState("");
  const [deleteSignature, setDeleteSignature] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const currentSignature = signatures.find((signature) => signature.name === selectedSignature);

  useEffect(() => setShortcuts(keyboardShortcuts), [keyboardShortcuts]);
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
    if (tab === "general") {
      signatureSection.current?.scrollIntoView({ block: "nearest" });
      signatureSection.current?.focus({ preventScroll: true });
    }
  }, [tab]);
  useEffect(() => {
    for (const label of labels) {
      if ((label.visibility || visibility[`custom:${label.id}`]) !== "unread") continue;
      const visible = emails.some((email) => email.unread && email.labels.includes(label.id));
      if ((label.visible !== false) !== visible) onLabelVisibility(label.id, visible);
    }
  }, [emails, labels, visibility, onLabelVisibility]);

  function preference<K extends keyof GeneralPreferences>(key: K, value: GeneralPreferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function visibilityChoices(key: string, fallback: Visibility, unread = false, message = false, label?: Label) {
    const values = message ? messageVisibility : visibility;
    const mode = label && message && label.messageVisible !== undefined
      ? label.messageVisible ? "show" : "hide"
      : label && !message && label.visibility
        ? label.visibility
        : label && !message && values[key] !== "unread" ? fallback : values[key] || fallback;
    return <span className="gmail-settings-visibility" role="group" aria-label={`${label?.name || key.replace(/^[^:]+:/, "")} ${message ? "message" : "label"} list visibility`}>
      {(["show", "hide", ...(unread ? ["unread"] : [])] as Visibility[]).map((value) => <button
        type="button" key={value} aria-pressed={mode === value}
        className={mode === value ? "gmail-settings-current" : ""}
        onClick={() => {
          const next = { ...values, [key]: value };
          (message ? setMessageVisibility : setVisibility)(next);
          localStorage.setItem(message ? "gopen-settings-message-visibility" : "gopen-settings-label-visibility", JSON.stringify(next));
          if (label) onLabelAction(message ? "messageVisibility" : "visibility", label.id, value);
        }}
      >{value === "unread" ? "show if unread" : value}</button>)}
    </span>;
  }

  function imapCheckbox(key: string, name: string, disabled = false) {
    return <label className="gmail-settings-imap"><input
      type="checkbox" checked={disabled || imap[key] !== false} disabled={disabled}
      aria-label={`${name}: Show in IMAP`}
      onChange={(event) => {
        const next = { ...imap, [key]: event.target.checked };
        setImap(next);
        localStorage.setItem("gopen-settings-imap", JSON.stringify(next));
      }}
    />Show in IMAP</label>;
  }

  function radio(name: string, checked: boolean, text: string, change: () => void, description?: ReactNode) {
    return <label className="gmail-settings-radio"><input type="radio" name={name} checked={checked} onChange={change} /><span><strong>{text}</strong>{description}</span></label>;
  }

  function learnMore(topic: string) {
    return <button className="gmail-settings-link" type="button" onClick={() => setNotice(`${topic}: this setting is stored in this local mock only.`)}>Learn more</button>;
  }

  function starList(inUse: boolean) {
    return <div className="gmail-settings-star-list" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
      event.preventDefault();
      const name = event.dataTransfer.getData("text/plain");
      if (!stars.some((star) => star.name === name)) return;
      preference("stars", inUse ? [...preferences.stars.filter((star) => star !== name), name] : preferences.stars.filter((star) => star !== name));
    }}>
      <strong>{inUse ? "In use:" : "Not in use:"}</strong>
      {(inUse ? preferences.stars.flatMap((name) => stars.find((star) => star.name === name) || []) : stars.filter((star) => !preferences.stars.includes(star.name))).map((star) => <button
        key={star.name} type="button" draggable title={star.name}
        aria-label={`${inUse ? "Stop using" : "Use"} ${star.name}`}
        onDragStart={(event) => event.dataTransfer.setData("text/plain", star.name)}
        onClick={() => preference("stars", inUse ? preferences.stars.filter((name) => name !== star.name) : [...preferences.stars, star.name])}
      ><Icon name={star.name} size={20} /></button>)}
    </div>;
  }

  const sortedLabels = labels.map((label) => {
    let depth = 0;
    let path = label.name;
    let parent = labels.find((candidate) => candidate.id === label.parentId);
    const visited = new Set([label.id]);
    while (parent && !visited.has(parent.id)) {
      visited.add(parent.id);
      path = `${parent.name}/${path}`;
      depth++;
      parent = labels.find((candidate) => candidate.id === parent?.parentId);
    }
    return { label, depth, path };
  }).sort((a, b) => a.path.localeCompare(b.path, "en", { sensitivity: "base" }));

  return <div className="gmail-settings-view" data-settings-tab={tab}>
    <header className="gmail-settings-heading"><h1>Settings</h1></header>
    <div className="gmail-settings-tabs" role="tablist" aria-label="Settings">
      {tabs.map((item) => <button
        key={item.name} type="button" role="tab" id={item.id ? `settings-tab-${item.id}` : undefined}
        aria-selected={item.id === tab} aria-controls={item.id ? "settings-tabpanel" : undefined}
        disabled={!item.id} title={item.id ? undefined : "Not captured or implemented in this local mock"}
        onClick={() => { if (item.id) { setNotice(""); onTab(item.id); } }}
      >{item.name}</button>)}
    </div>
    <div ref={scroll} className={`gmail-settings-scroll gmail-settings-scroll-${tab}`} id="settings-tabpanel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
      {tab === "labels" && <div className="gmail-settings-labels-body">
        <table className="gmail-settings-labels-table">
          <colgroup><col className="gmail-settings-col-name" /><col className="gmail-settings-col-label" /><col className="gmail-settings-col-message" /><col className="gmail-settings-col-action" /><col /></colgroup>
          <tbody>
            <tr className="gmail-settings-label-heading"><th scope="col">System labels</th><th scope="col">Show in label list</th><th /><th /><th /></tr>
            {systemLabels.map((label) => <tr className="gmail-settings-system-row" key={label.name}>
              <td><span className="gmail-settings-label-name">{label.name}</span></td>
              <td>{label.name !== "Inbox" && visibilityChoices(`system:${label.name}`, label.mode, label.unread)}</td><td /><td />
              <td>{imapCheckbox(`system:${label.name}`, label.name, label.name === "Inbox")}</td>
            </tr>)}
            <tr className="gmail-settings-label-heading gmail-settings-label-divider"><th scope="col">Categories</th><th scope="col">Show in label list</th><th scope="col">Show in message list</th><th /><th /></tr>
            {categories.map((name, index) => <tr className="gmail-settings-system-row" key={name}>
              <td><span className="gmail-settings-label-name">{name}</span></td>
              <td>{visibilityChoices(`category:${name}`, index < 2 ? "show" : "hide")}</td>
              <td>{index > 1 && visibilityChoices(`category:${name}`, "hide", false, true)}</td><td /><td />
            </tr>)}
            <tr className="gmail-settings-label-heading gmail-settings-label-divider"><th scope="col">Labels</th><th scope="col">Show in label list</th><th scope="col">Show in message list</th><th scope="col">Actions</th><th /></tr>
            <tr className="gmail-settings-create-label-row"><td colSpan={5}><button type="button" className="gmail-settings-native-button" onClick={() => onCreateLabel()}>Create new label</button></td></tr>
            {sortedLabels.map(({ label, depth }) => {
              const count = emails.filter((email) => email.labels.includes(label.id)).length;
              const parent = labels.find((candidate) => candidate.id === label.parentId);
              const showChoices = !parent || parent.visible !== false || visibility[`custom:${parent.id}`] === "unread";
              return <tr key={label.id} className="gmail-settings-custom-row">
                <td><div className="gmail-settings-label-name" style={{ paddingLeft: depth * 12 }}><span>{label.name}</span><div className="gmail-settings-conversations">{count} conversation{count === 1 ? "" : "s"}</div></div></td>
                <td>{showChoices && visibilityChoices(`custom:${label.id}`, label.visible === false ? "hide" : "show", true, false, label)}</td>
                <td>{visibilityChoices(`custom:${label.id}`, "show", false, true, label)}</td>
                <td><span className="gmail-settings-label-actions"><button type="button" onClick={() => onLabelAction("delete", label.id)} aria-label={`Remove ${label.name}`}>remove</button><button type="button" onClick={() => onLabelAction("edit", label.id)} aria-label={`Edit ${label.name}`}>edit</button></span></td>
                <td>{imapCheckbox(`custom:${label.id}`, label.name)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>}
      {tab === "general" && <form className="gmail-settings-general" onSubmit={(event) => {
        event.preventDefault();
        const content = editor.current?.getContent();
        const next = signatures.map((signature) => signature.name === selectedSignature && content ? { ...signature, ...content } : signature);
        localStorage.setItem("gopen-signatures", JSON.stringify(next));
        localStorage.setItem("gopen-default-signature", defaultSignature);
        localStorage.setItem("gopen-compose-signature", next.find((signature) => signature.name === defaultSignature)?.body || "");
        localStorage.setItem("gopen-settings-general", JSON.stringify(preferences));
        onKeyboardShortcuts(shortcuts);
        window.dispatchEvent(new Event("gopen-signatures-changed"));
        setDirty(false);
        onClose();
      }}>
        {/* Only the captured tail of General is represented, not unmeasured earlier settings. */}
        <section className="gmail-settings-general-row gmail-settings-notification-tail">
          <div className="gmail-settings-general-label"><small>popup notifications on your desktop when new email messages arrive)</small>{learnMore("Desktop notifications")}</div>
          <div>{radio("notifications", preferences.notifications === "important", "Important mail notifications on", () => preference("notifications", "important"), " - Notify me only when an important message arrives in my inbox")}{radio("notifications", preferences.notifications === "off", "Mail notifications off", () => preference("notifications", "off"))}</div>
        </section>
        <section className="gmail-settings-general-row gmail-settings-stars">
          <div className="gmail-settings-general-label"><strong>Stars:</strong></div>
          <div><p><strong>Drag the stars between the lists.</strong>&nbsp; The stars will rotate in the order shown below when you click successively. To learn the name of a star for search, hover your mouse over the image.</p>
            <div className="gmail-settings-star-presets"><span>Presets:</span>{[{ name: "1 star", count: 1 }, { name: "4 stars", count: 4 }, { name: "all stars", count: 12 }].map((preset) => <button className="gmail-settings-link" type="button" key={preset.name} onClick={() => preference("stars", stars.slice(0, preset.count).map((star) => star.name))}>{preset.name}</button>)}</div>
            {starList(true)}{starList(false)}
          </div>
        </section>
        <section className="gmail-settings-general-row">
          <div className="gmail-settings-general-label"><strong>Keyboard shortcuts:</strong>{learnMore("Keyboard shortcuts")}</div>
          <div>{radio("keyboard-shortcuts", !shortcuts, "Keyboard shortcuts off", () => { setShortcuts(false); setDirty(true); })}{radio("keyboard-shortcuts", shortcuts, "Keyboard shortcuts on", () => { setShortcuts(true); setDirty(true); })}</div>
        </section>
        <section className="gmail-settings-general-row">
          <div className="gmail-settings-general-label"><strong>Button labels:</strong>{learnMore("Button labels")}</div>
          <div>{radio("button-labels", preferences.buttonLabels === "icons", "Icons", () => preference("buttonLabels", "icons"))}{radio("button-labels", preferences.buttonLabels === "text", "Text", () => preference("buttonLabels", "text"))}</div>
        </section>
        <section className="gmail-settings-general-row gmail-settings-picture-row">
          <div className="gmail-settings-general-label"><strong>My picture:</strong>{learnMore("My picture")}</div>
          <div className="gmail-settings-picture"><span className="gmail-settings-avatar" aria-label="Local profile picture">A</span><p>Your Google profile picture is visible across Google services.<br />You can change your picture in <button type="button" className="gmail-settings-link" onClick={() => setNotice("Profile changes are unavailable in this local mock.")}>About me</button>.</p></div>
        </section>
        <section className="gmail-settings-general-row">
          <div className="gmail-settings-general-label"><strong>Create contacts for auto-complete:</strong></div>
          <div>{radio("auto-contacts", preferences.autoContacts, "When I send a message to a new person, add them to Other Contacts so that I can auto-complete to them next time", () => preference("autoContacts", true))}{radio("auto-contacts", !preferences.autoContacts, "I'll add contacts myself", () => preference("autoContacts", false))}</div>
        </section>
        <section ref={signatureSection} id="settings-signature" tabIndex={-1} aria-label="Signature" className="gmail-settings-general-row gmail-settings-signature-section">
          <div className="gmail-settings-general-label"><strong>Signature:</strong><small>(appended at the end of all outgoing messages)</small>{learnMore("Signature")}</div>
          <div>
            {!signatures.length ? <strong>No signatures</strong> : <div className="gmail-settings-signature-manager" data-capture-status="unverified">
              <div className="gmail-settings-signature-names" role="group" aria-label="Signatures">{signatures.map((signature) => <div key={signature.name} className={signature.name === selectedSignature ? "gmail-settings-signature-selected" : ""}>
                <button type="button" aria-pressed={signature.name === selectedSignature} onClick={() => setSelectedSignature(signature.name)}>{signature.name}</button>
                <button type="button" aria-label={`Rename signature ${signature.name}`} onClick={() => { setNameError(""); setNameDialog({ name: signature.name, original: signature.name }); }}><Icon name="compose" size={16} /></button>
                <button type="button" aria-label={`Delete signature ${signature.name}`} onClick={() => setDeleteSignature(signature.name)}><Icon name="trash" size={16} /></button>
              </div>)}</div>
              <div className="gmail-settings-signature-editor">{currentSignature && <><RichTextEditor key={currentSignature.name} body={currentSignature.body} html={currentSignature.html} label="Signature text" editorRef={editor} className="gmail-settings-rich-editor" onChange={(body, html) => {
                setSignatures((current) => current.map((signature) => signature.name === selectedSignature ? { ...signature, body, html } : signature));
                setDirty(true);
              }} /><FormattingToolbar editorRef={editor} /></>}</div>
            </div>}
            <button type="button" className="gmail-settings-create-signature" onClick={() => { setNameError(""); setNameDialog({ name: "" }); }}><Icon name="plus" size={20} />Create new</button>
            {!!signatures.length && <div className="gmail-settings-signature-default" data-capture-status="unverified"><strong>Signature defaults</strong><label>For new emails use<select aria-label="Default signature" value={defaultSignature} onChange={(event) => { setDefaultSignature(event.target.value); setDirty(true); }}><option value="">No signature</option>{signatures.map((signature) => <option key={signature.name} value={signature.name}>{signature.name}</option>)}</select></label></div>}
          </div>
        </section>
        <section className="gmail-settings-general-row">
          <div className="gmail-settings-general-label"><strong>Personal level indicators:</strong></div>
          <div>{radio("indicators", !preferences.indicators, "No indicators", () => preference("indicators", false))}{radio("indicators", preferences.indicators, "Show indicators", () => preference("indicators", true), <> - Display an arrow (&rsaquo;) by messages sent to my address (not a mailing list), and a double arrow (&raquo;) by messages sent only to me.</>)}</div>
        </section>
        <section className="gmail-settings-general-row">
          <div className="gmail-settings-general-label"><strong>Snippets:</strong></div>
          <div>{radio("snippets", preferences.snippets, "Show snippets", () => preference("snippets", true), " - Show snippets of the message (like Google web search!).")}{radio("snippets", !preferences.snippets, "No snippets", () => preference("snippets", false), " - Show subject only.")}</div>
        </section>
        <section className="gmail-settings-general-row gmail-settings-vacation">
          <div className="gmail-settings-general-label"><strong>Vacation responder:</strong><small>(sends an automated reply to incoming messages. If a contact sends you several messages, this automated reply will be sent at most once every 4 days)</small>{learnMore("Vacation responder")}</div>
          <div>{radio("vacation", !preferences.vacation, "Vacation responder off", () => preference("vacation", false))}{radio("vacation", preferences.vacation, "Vacation responder on", () => preference("vacation", true))}
            <div className="gmail-settings-vacation-dates"><label><strong>First day:</strong><input aria-label="Vacation first day" value={preferences.vacationFirst} onChange={(event) => preference("vacationFirst", event.target.value)} /></label><label><input type="checkbox" checked={preferences.vacationUseLast} onChange={(event) => preference("vacationUseLast", event.target.checked)} /><strong>Last day:</strong><input aria-label="Vacation last day" placeholder="(optional)" disabled={!preferences.vacationUseLast} value={preferences.vacationLast} onChange={(event) => preference("vacationLast", event.target.value)} /></label></div>
            <label className="gmail-settings-vacation-subject"><strong>Subject:</strong><input value={preferences.vacationSubject} onChange={(event) => preference("vacationSubject", event.target.value)} /></label>
            <div className="gmail-settings-vacation-message"><strong>Message:</strong><div><FormattingToolbar editorRef={vacationEditor} disabled={preferences.vacationPlain} /><button type="button" className="gmail-settings-link" onClick={() => preference("vacationPlain", !preferences.vacationPlain)}>{preferences.vacationPlain ? "Rich formatting" : <>&laquo; Plain Text</>}</button><RichTextEditor body={preferences.vacationBody} html={preferences.vacationHtml} label="Vacation responder" editorRef={vacationEditor} plainText={preferences.vacationPlain} className="gmail-settings-vacation-editor" onChange={(body, html) => { setPreferences((current) => ({ ...current, vacationBody: body, vacationHtml: html })); setDirty(true); }} /></div></div>
          </div>
        </section>
        <div className="gmail-settings-save"><button className="gmail-settings-native-button" type="submit" disabled={!dirty}>Save Changes</button><button className="gmail-settings-native-button" type="button" onClick={onClose}>Cancel</button></div>
      </form>}
      {tab === "filters" && <div className="gmail-settings-local-filters" data-capture-status="unverified">
        <p>Local filters. This settings tab has not been source-captured; no Google account settings are changed.</p>
        {filters === undefined ? <p>Filter management is not connected.</p> : !filters.length ? <p>No local filters.</p> : <ul>{filters.map((rule) => <li key={rule.id}><div><strong>Matches:</strong> {rule.query}<br /><strong>Do this:</strong> {[
          rule.archive && "Skip the Inbox", rule.read && "Mark as read", rule.star && "Star it", rule.trash && "Delete it", rule.neverSpam && "Never send to Spam", rule.important && "Mark as important", rule.notImportant && "Never mark as important", rule.labelId && `Apply label: ${labels.find((label) => label.id === rule.labelId)?.name || rule.labelId}`, rule.category && `Category: ${rule.category}`,
        ].filter(Boolean).join(", ")}</div><div>{onEditFilter && <button type="button" className="gmail-settings-link" onClick={() => onEditFilter(rule)}>edit</button>}{onDeleteFilter && <button type="button" className="gmail-settings-link" onClick={() => onDeleteFilter(rule.id)}>delete</button>}</div></li>)}</ul>}
        {onCreateFilter && <button type="button" className="gmail-settings-link" onClick={onCreateFilter}>Create a new filter</button>}
        <div><button type="button" className="gmail-settings-native-button" onClick={onClose}>Back to mail</button></div>
      </div>}
    </div>
    {notice && <div className="gmail-settings-notice" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss notice" onClick={() => setNotice("")}><Icon name="close" size={20} /></button></div>}
    {nameDialog && <ComposeModal title={nameDialog.original ? "Rename signature" : "Name new signature"} className="gmail-settings-signature-dialog" onClose={() => setNameDialog(null)}>
      <form data-capture-status="unverified" onSubmit={(event) => {
        event.preventDefault();
        const name = nameDialog.name.trim();
        if (!name) { setNameError("Enter a signature name."); return; }
        if (signatures.some((signature) => signature.name === name && signature.name !== nameDialog.original)) { setNameError("A signature with this name already exists."); return; }
        if (nameDialog.original) {
          setSignatures((current) => current.map((signature) => signature.name === nameDialog.original ? { ...signature, name } : signature));
          if (defaultSignature === nameDialog.original) setDefaultSignature(name);
        } else {
          setSignatures((current) => [...current, { name, body: "", html: "" }]);
          setDefaultSignature(name);
        }
        setSelectedSignature(name);
        setDirty(true);
        setNameDialog(null);
      }}><h2>{nameDialog.original ? "Rename signature" : "Name new signature"}</h2><input data-autofocus aria-label="Signature name" value={nameDialog.name} onChange={(event) => setNameDialog({ ...nameDialog, name: event.target.value })} />{nameError && <p className="gmail-settings-signature-error" role="alert">{nameError}</p>}<div className="gmail-dialog-actions"><button className="gmail-dialog-text" type="button" onClick={() => setNameDialog(null)}>Cancel</button><button className="gmail-dialog-primary" type="submit">{nameDialog.original ? "Save" : "Create"}</button></div></form>
    </ComposeModal>}
    {deleteSignature && <ComposeModal title="Delete signature" className="gmail-settings-signature-dialog" alert onClose={() => setDeleteSignature(null)}><h2>Delete signature</h2><p>Delete &quot;{deleteSignature}&quot;?</p><div className="gmail-dialog-actions"><button className="gmail-dialog-text" type="button" onClick={() => setDeleteSignature(null)}>Cancel</button><button className="gmail-dialog-primary" type="button" onClick={() => {
      const next = signatures.filter((signature) => signature.name !== deleteSignature);
      setSignatures(next);
      if (selectedSignature === deleteSignature) setSelectedSignature(next[0]?.name || "");
      if (defaultSignature === deleteSignature) setDefaultSignature("");
      setDeleteSignature(null);
      setDirty(true);
    }}>Delete</button></div></ComposeModal>}
  </div>;
}
