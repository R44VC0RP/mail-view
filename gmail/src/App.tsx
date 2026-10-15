import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
  useState,
} from "react";
import { initialEmails, initialLabels } from "./data";
import { applyMailAction, draftFromEmail, discardDrafts, saveDraftMailbox, sendDraftMailbox, threadSubject, undoMailbox } from "./mailbox";
import type { Mailbox } from "./mailbox";
import { matchesView, searchEmails } from "./search";
import type {
  ComposeDraft,
  Attachment,
  Density,
  Email,
  Label,
  MailAction,
  OnAction,
  SelectMode,
} from "./types";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { MailList } from "./components/MailList";
import { MessageView } from "./components/MessageView";
import type { ReplyOptions } from "./components/MessageView";
import { Composer } from "./components/Composer";
import { FilterDialog } from "./components/FilterDialog";
import { NEWSearchFilters, SearchSort, SearchContactBanner } from "./components/NEWSearchFilters";
import { SettingsView } from "./components/SettingsView";
import { SupportView, GMAIL_TRAINING_URL } from "./components/SupportView";
import type { FilterRule } from "./components/FilterDialog";
import { Icon } from "./ui/Icon";

type Notice = { message: string; undoable: boolean; id: number; sent?: { emailId: string; draft: ComposeDraft } };
type State = Mailbox & {
  undo: { before: Mailbox; after: Mailbox } | null;
  notice: Notice | null;
};
type Change = {
  type: "change";
  update: (mailbox: Mailbox) => Mailbox;
  message?: string;
  undoable?: boolean;
  sent?: Notice["sent"];
};
type Action =
  | Change
  | { type: "undo" }
  | { type: "notice"; message: string }
  | { type: "sync"; mailbox: Mailbox }
  | { type: "dismiss" };
type Route = { view: string; query: string; emailId?: string };
type Dialog =
  | { type: "label"; label?: Label; parentId?: string; applyIds?: string[] }
  | { type: "help" }
  | { type: "deleteLabel"; label: Label }
  | { type: "deleteForever"; ids: string[] }
  | { type: "filterField"; field: string; title: string };

const STORAGE_KEY = "gopen.mailbox";

function reducer(state: State, action: Action): State {
  if (action.type === "sync") return { ...state, ...action.mailbox };
  if (action.type === "dismiss") return { ...state, notice: null };
  if (action.type === "notice")
    return {
      ...state,
      notice: {
        message: action.message,
        undoable: false,
        id: (state.notice?.id || 0) + 1,
      },
    };
  if (action.type === "undo")
    return state.undo
      ? {
          ...undoMailbox(state.undo.before, state.undo.after, state),
          undo: null,
          notice: {
            message: state.notice?.sent ? "Sending undone." : "Action undone.",
            undoable: false,
            id: (state.notice?.id || 0) + 1,
          },
        }
      : state;
  const mailbox = action.update({ emails: state.emails, labels: state.labels });
  return {
    ...mailbox,
    undo: action.undoable
      ? {
          before: { emails: state.emails, labels: state.labels },
          after: mailbox,
        }
      : state.undo,
    notice: action.message
      ? {
          message: action.message,
          undoable: !!action.undoable,
          sent: action.sent,
          id: (state.notice?.id || 0) + 1,
        }
      : state.notice,
  };
}

function readRoute(): Route {
  const hash = window.location.hash.slice(1) || "inbox";
  const [base, emailId] = hash.split("/message/");
  if (base.startsWith("search/"))
    return {
      view: "search",
      query: decodeURIComponent(base.slice(7)),
      emailId,
    };
  return { view: decodeURIComponent(base), query: "", emailId };
}

function loadMailbox(): State {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const mailbox = JSON.parse(stored) as Mailbox;
      if (Array.isArray(mailbox.emails) && Array.isArray(mailbox.labels))
        return { ...mailbox, undo: null, notice: null };
    }
  } catch {
    /* The mock mailbox still works when browser storage is unavailable. */
  }
  return {
    emails: initialEmails,
    labels: initialLabels,
    undo: null,
    notice: null,
  };
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadMailbox);
  const [route, setRoute] = useState(readRoute);
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [page, setPage] = useState(0);
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 700);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [supportTopic, setSupportTopic] = useState<"help" | "feedback">();
  const [keyboardShortcuts, setKeyboardShortcuts] = useState(() => localStorage.getItem("gopen.keyboard-shortcuts") === "true");
  const [density, setDensity] = useState<Density>(
    () => (localStorage.getItem("gopen.density") as Density) || "default",
  );
  const [pageSize, setPageSize] = useState(
    () => Number(localStorage.getItem("gopen.pageSize")) || 50,
  );
  const [composeWindows, setComposeWindows] = useState<{ draft: ComposeDraft; focusSubject?: boolean; dockExpanded?: boolean }[]>(() => {
    const email = route.view === "compose" ? state.emails.find(email => email.id === route.emailId) : undefined;
    return email ? [{ draft: draftFromEmail(email) }] : [];
  });
  const [replyRequestId, setReplyRequestId] = useState(0);
  const [replyIntent, setReplyIntent] = useState<
    "reply" | "replyAll" | "forward"
  >();
  const [dialog, setDialog] = useState<Dialog>();
  const [sort, setSort] = useState<"relevant" | "recent">("relevant");
  const [filterQuery, setFilterQuery] = useState<string>();
  const [filters, setFilters] = useState<FilterRule[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("gopen.filters") || "[]");
    } catch {
      return [];
    }
  });
  const lastSelected = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const previousRoute = useRef(route);
  const storageFailed = useRef(false);
  const pendingGo = useRef(false);
  const deferredQuery = useDeferredValue(route.query);
  const mailboxData: Mailbox = { emails: state.emails, labels: state.labels };
  const recipientSuggestions = [...new Map(state.emails.filter(email => email.folder !== "drafts").flatMap(email => email.messages.flatMap(message => [message.from, ...message.to, ...(message.cc || [])])).map(address => [address.email, address])).values()];
  const contacts = [...new Map(state.emails.filter(email => email.folder === "sent" || email.sent).flatMap(email => email.messages.flatMap(message => [...message.to, ...(message.cc || []), ...(message.bcc || [])])).map(address => [address.email, address])).values()];
  const settingsTab = route.view === "settings-labels" ? "labels" : route.view === "settings-general" ? "general" : route.view === "settings-filters" ? "filters" : undefined;

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      setSelectedIds(new Set());
      lastSelected.current = undefined;
      setPage(0);
      setReplyIntent(undefined);
    };
    window.addEventListener("hashchange", onHash);
    if (!window.location.hash) history.replaceState(null, "", "#inbox");
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ emails: state.emails, labels: state.labels }),
      );
      storageFailed.current = false;
    } catch {
      if (!storageFailed.current) {
        storageFailed.current = true;
        dispatch({
          type: "notice",
          message:
            "Browser storage is full. Changes will last until this page closes.",
        });
      }
    }
  }, [state.emails, state.labels]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const mailbox = JSON.parse(event.newValue) as Mailbox;
        if (Array.isArray(mailbox.emails) && Array.isArray(mailbox.labels)) dispatch({ type: "sync", mailbox });
      } catch { /* Ignore incomplete cross-window writes. */ }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    localStorage.setItem("gopen.density", density);
    localStorage.setItem("gopen.pageSize", String(pageSize));
  }, [density, pageSize]);
  useEffect(() => { localStorage.setItem("gopen.keyboard-shortcuts", String(keyboardShortcuts)); }, [keyboardShortcuts]);
  useEffect(() => {
    try {
      localStorage.setItem("gopen.filters", JSON.stringify(filters));
    } catch {
      /* Filters remain available in memory. */
    }
  }, [filters]);
  useEffect(() => {
    if (!state.notice) return;
    const timer = window.setTimeout(() => dispatch({ type: "dismiss" }), 8000);
    return () => clearTimeout(timer);
  }, [state.notice]);
  useEffect(() => {
    const previous = previousRoute.current;
    const returning =
      !route.emailId &&
      previous.emailId &&
      previous.view === route.view &&
      previous.query === route.query;
    scrollRef.current?.scrollTo(0, returning ? listScroll.current : 0);
    if (returning)
      document
        .querySelector<HTMLElement>(`[data-email-id="${previous.emailId}"]`)
        ?.focus({ preventScroll: true });
    previousRoute.current = route;
  }, [route.view, route.query, route.emailId, page]);

  const linkedDrafts = new Map(state.emails.filter(email => email.folder === "drafts" && !email.scheduledFor && email.replyToId && state.emails.some(parent => parent.id === email.replyToId && threadSubject(parent.subject) === threadSubject(email.subject))).map(draft => [draft.replyToId!, draft]));
  const listEmails = state.emails.filter(email => route.view === "drafts" || !email.replyToId || linkedDrafts.get(email.replyToId)?.id !== email.id).map(email => {
    const draft = route.view === "drafts" && email.replyToId ? linkedDrafts.get(email.replyToId) : linkedDrafts.get(email.id);
    const parent = route.view === "drafts" && draft ? state.emails.find(parent => parent.id === draft.replyToId) : email;
    if (!draft || !parent) return { ...email, hasDraft: false };
    return { ...email, sender: parent.sender.split(/,\s*/).map(name => name.split(/\s+/)[0]).join(", "), subject: parent.subject, hasDraft: true, snippet: draft.snippet, labels: [...new Set([...parent.labels, ...draft.labels])], messages: [...parent.messages, ...draft.messages], attachments: [...new Map([...parent.attachments, ...draft.attachments].map(file => [file.id, file])).values()] };
  });
  const visibleEmails = (
    route.view === "search"
      ? searchEmails(listEmails, deferredQuery, state.labels)
      : listEmails.filter((email) => matchesView(email, route.view))
  ).toSorted((a, b) => {
    if (route.view === "search" && sort === "relevant") {
      const words = deferredQuery.toLowerCase().split(/\s+/).filter(word => word && !word.includes(":") && !word.startsWith("-") && word !== "or");
      const score = (email: Email) => words.reduce((total, word) => total + (email.subject.toLowerCase().includes(word) ? 5 : 0) + (email.sender.toLowerCase().includes(word) ? 3 : 0) + (email.snippet.toLowerCase().includes(word) ? 1 : 0), 0);
      const difference = score(b) - score(a);
      if (difference) return difference;
    }
    return b.date.localeCompare(a.date);
  });
  const total = visibleEmails.length;
  const safePage = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1));
  const pageEmails = visibleEmails.slice(
    safePage * pageSize,
    (safePage + 1) * pageSize,
  );
  const selectedEmails = state.emails.filter((email) =>
    selectedIds.has(email.id),
  );
  const thread = route.emailId
    ? state.emails.find((email) => email.id === route.emailId)
    : undefined;
  const replyEmail = thread
    ? state.emails.find((email) => email.replyToId === thread.id && email.folder === "drafts" && !email.scheduledFor && threadSubject(thread.subject) === threadSubject(email.subject))
    : undefined;
  const dockedReply = thread ? composeWindows.find(window => window.draft.replyToId === thread.id) : undefined;
  const threadIndex = thread
    ? visibleEmails.findIndex((email) => email.id === thread.id)
    : -1;
  const allSelected =
    pageEmails.length > 0 &&
    pageEmails.every((email) => selectedIds.has(email.id));
  const someSelected = pageEmails.some((email) => selectedIds.has(email.id));
  const unreadCount = state.emails.filter(
    (email) => matchesView(email, "inbox") && email.unread,
  ).length;

  useEffect(() => {
    document.title = settingsTab ? "Settings - Gmail" : thread
      ? `${thread.subject} - Gmail`
      : `${route.view === "search" ? "Search results" : route.view === "inbox" ? `Inbox (${unreadCount})` : route.view.startsWith("label:") ? state.labels.find((label) => label.id === route.view.slice(6))?.name || "Label" : route.view[0].toUpperCase() + route.view.slice(1)} - Gmail`;
  }, [thread, route.view, unreadCount, state.labels, settingsTab]);

  function navigate(view: string, query = "", emailId?: string) {
    const hash = `${view === "search" ? `search/${encodeURIComponent(query)}` : encodeURIComponent(view)}${emailId ? `/message/${emailId}` : ""}`;
    history.pushState(null, "", `#${hash}`);
    setRoute({ view, query, emailId });
    setSelectedIds(new Set());
    lastSelected.current = undefined;
    if (!(
      view === route.view &&
      query === route.query &&
      (emailId || route.emailId)
    ))
      setPage(0);
    setReplyIntent(undefined);
    if (window.innerWidth <= 700) setCollapsed(true);
  }

  function onSearch(query: string) {
    startTransition(() =>
      navigate(query.trim() ? "search" : "inbox", query.trim()),
    );
  }

  function openCompose(draft: ComposeDraft, focusSubject = false) {
    const id = draft.id || crypto.randomUUID();
    const existing = composeWindows.some(window => window.draft.id === id);
    setComposeWindows(windows => windows.some(window => window.draft.id === id) ? windows : [...windows, { draft: { ...draft, id }, focusSubject }]);
    if (existing) requestAnimationFrame(() => {
      const slot = document.querySelector<HTMLElement>(`[data-compose-id="${CSS.escape(id)}"]`);
      slot?.querySelector<HTMLButtonElement>('[aria-label="Restore compose"]')?.click();
      requestAnimationFrame(() => slot?.querySelector<HTMLElement>(focusSubject ? '[aria-label="Subject"]' : draft.to ? '[contenteditable="true"]' : '[aria-label="To recipients"]')?.focus());
    });
  }

  function closeCompose(id?: string) {
    setComposeWindows(windows => windows.filter(window => window.draft.id !== id));
    if (route.view === "compose") window.close();
  }
  function setDockExpanded(id: string | undefined, expanded: boolean) {
    setComposeWindows(windows => {
      if (windows.find(window => window.draft.id === id)?.dockExpanded === expanded) return windows;
      return windows.map(window => window.draft.id === id ? { ...window, dockExpanded: expanded } : window);
    });
  }

  const contactCompose = useEffectEvent((event: Event) => {
    const to = (event as CustomEvent<{ to?: string }>).detail?.to;
    if (typeof to === "string") openCompose({ id: crypto.randomUUID(), to, cc: "", bcc: "", subject: "", body: "", attachments: [] });
  });
  const openSettingsEvent = useEffectEvent((event: Event) => {
    const detail = (event as CustomEvent<{ tab?: string; anchor?: string }>).detail;
    const tab = detail?.tab;
    if (!tab || !["labels", "general", "filters"].includes(tab)) return;
    navigate(`settings-${tab}`);
    if (detail.anchor === "signature") requestAnimationFrame(() => { const element = document.getElementById("settings-signature"); element?.scrollIntoView({ block: "center" }); element?.focus(); });
  });
  useEffect(() => {
    const listener = (event: Event) => contactCompose(event);
    document.addEventListener("gopen:compose", listener);
    const settings = (event: Event) => openSettingsEvent(event);
    document.addEventListener("gopen:settings", settings);
    return () => { document.removeEventListener("gopen:compose", listener); document.removeEventListener("gopen:settings", settings); };
  }, []);

  function requestReply(mode: "reply" | "replyAll" | "forward") {
    setReplyIntent(mode);
    setReplyRequestId(value => value + 1);
  }

  function openEmail(email: Email) {
    if (!route.emailId) listScroll.current = scrollRef.current?.scrollTop || 0;
    if (email.replyToId && state.emails.some(parent => parent.id === email.replyToId && threadSubject(parent.subject) === threadSubject(email.subject))) {
      navigate("inbox", "", email.replyToId);
      const docked = composeWindows.find(window => window.draft.id === email.id);
      if (docked) openCompose(docked.draft);
      else requestReply(email.replyMode || "reply");
      return;
    }
    if (email.folder === "drafts" && !email.scheduledFor) {
      openCompose(draftFromEmail(email));
      return;
    }
    navigate(route.view, route.query, email.id);
    if (email.unread)
      dispatch({
        type: "change",
        update: (mailbox) => applyMailAction(mailbox, "read", [email.id]),
      });
  }

  function selectEmail(id: string, shift: boolean) {
    const lastId = lastSelected.current;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      const index = pageEmails.findIndex((email) => email.id === id);
      const lastIndex = pageEmails.findIndex((email) => email.id === lastId);
      if (shift && lastIndex !== -1 && index !== -1) {
        pageEmails
          .slice(Math.min(index, lastIndex), Math.max(index, lastIndex) + 1)
          .forEach((email) => next.add(email.id));
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastSelected.current = id;
  }

  function selectBy(mode: SelectMode) {
    setSelectedIds(
      new Set(
        pageEmails
          .filter(
            (email) =>
              mode === "all" ||
              (mode === "read" && !email.unread) ||
              (mode === "unread" && email.unread) ||
              (mode === "starred" && email.starred) ||
              (mode === "unstarred" && !email.starred),
          )
          .map((email) => email.id),
      ),
    );
  }

  const onAction: OnAction = (action, ids, value) => {
    if (action === "read" && !ids.length)
      ids = visibleEmails.map((email) => email.id);
    const target = state.emails.find((email) => ids.includes(email.id));
    if (action === "forward" && value === "attachment" && target) {
      openCompose({
        id: crypto.randomUUID(),
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: "",
        attachments: state.emails
          .filter((email) => ids.includes(email.id))
          .map((email) => ({
            id: crypto.randomUUID(),
            name: `${email.subject.replace(/[\\/:*?"<>|]/g, "")}.eml`,
            type: "document",
            size: "2 KB",
            url: `data:message/rfc822;charset=utf-8,${encodeURIComponent(`From: ${email.sender} <${email.senderEmail}>\r\nSubject: ${email.subject}\r\nDate: ${email.date}\r\n\r\n${email.messages.at(-1)?.body || email.snippet}`)}`,
          })),
      });
      return;
    }
    if (["reply", "replyAll", "forward"].includes(action) && target) {
      openEmail(target);
      requestReply(action as "reply" | "replyAll" | "forward");
      return;
    }
    if (action === "filterSender" && target)
      return onSearch(`from:${target.senderEmail}`);
    if (action === "filter")
      return onSearch(
        value
          ? value.includes("@") && !value.includes(":")
            ? `from:${value}`
            : value
          : target
            ? `from:${target.senderEmail}`
            : "",
      );
    if (action === "newLabel")
      return setDialog({ type: "label", applyIds: ids });
    if (action === "print") {
      window.print();
      return;
    }
    if (action === "newWindow" && target) {
      window.open(
        `${window.location.origin}/#${route.view === "search" ? `search/${encodeURIComponent(route.query)}` : encodeURIComponent(route.view)}/message/${target.id}`,
        "_blank",
        "noopener",
      );
      return;
    }
    if (action === "deleteForever")
      return setDialog({ type: "deleteForever", ids });
    if (action === "delete" && selectedEmails.concat(target ? [target] : []).some(email => ids.includes(email.id) && email.folder === "drafts" && !email.scheduledFor)) {
      dispatch({ type: "change", update: mailbox => applyMailAction(mailbox, action, ids), message: ids.length === 1 ? "Draft discarded." : `${ids.length} drafts discarded.`, undoable: true });
      setComposeWindows(windows => windows.filter(window => !ids.includes(window.draft.id || "")));
      setSelectedIds(new Set());
      return;
    }
    if (action === "task") {
      dispatch({
        type: "notice",
        message: `Added "${target?.subject || "Conversation"}" to Tasks.`,
      });
      return;
    }
    if (action === "unsubscribe") {
      dispatch({
        type: "notice",
        message: "Unsubscribed in this mock mailbox. No request was sent.",
      });
      return;
    }
    const labels: Partial<Record<MailAction, string>> = {
      archive: "archived",
      delete: "moved to Trash",
      spam: "marked as spam",
      read: "marked as read",
      unread: "marked as unread",
      snooze: "snoozed",
      unsnooze: "moved to Inbox",
      move: "moved",
      label: "labeled",
      unlabel: "updated",
      mute: "muted",
      important: "marked as important",
      unimportant: "marked as not important",
    };
    const quiet = action === "star" || action === "unstar";
    dispatch({
      type: "change",
      update: (mailbox) => applyMailAction(mailbox, action, ids, value),
      message: quiet
        ? undefined
        : `${ids.length === 1 ? "Conversation" : `${ids.length} conversations`} ${labels[action] || "updated"}.`,
      undoable: !quiet,
    });
    if (
      ["archive", "delete", "spam", "move", "snooze", "mute"].includes(action)
    ) {
      setSelectedIds(new Set());
      if (thread) navigate(route.view, route.query);
    }
    if (action === "unread" && thread) navigate(route.view, route.query);
  };

  function saveDraft(draft: ComposeDraft) {
    setComposeWindows(windows => windows.map(window => window.draft.id === draft.id ? { ...window, draft } : window));
    if (route.view === "compose") localStorage.setItem(STORAGE_KEY, JSON.stringify(saveDraftMailbox(mailboxData, draft)));
    dispatch({
      type: "change",
      update: mailbox => saveDraftMailbox(mailbox, draft),
    });
  }

  function sendDraft(draft: ComposeDraft) {
    const mailbox = sendDraftMailbox(mailboxData, draft);
    const sentEmail = mailbox.emails.find(email => email.id === draft.id) || mailbox.emails.find(email => email.id === draft.replyToId);
    if (route.view === "compose") localStorage.setItem(STORAGE_KEY, JSON.stringify(mailbox));
    dispatch({
      type: "change",
      update: () => mailbox,
      message: "Message sent",
      undoable: true,
      sent: sentEmail ? { emailId: sentEmail.id, draft } : undefined,
    });
    closeCompose(draft.id);
  }

  function scheduleDraft(draft: ComposeDraft, date: string) {
    const mailbox = saveDraftMailbox(mailboxData, draft, date);
    if (route.view === "compose") localStorage.setItem(STORAGE_KEY, JSON.stringify(mailbox));
    dispatch({
      type: "change",
      update: () => mailbox,
      message: `Send scheduled for ${new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`,
      undoable: true,
    });
    closeCompose(draft.id);
  }

  function popoutCompose(draft: ComposeDraft) {
    const mailbox = saveDraftMailbox(mailboxData, draft);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mailbox));
    dispatch({ type: "change", update: () => mailbox });
    window.open(`${window.location.origin}/#compose/message/${draft.id}`, `gopen-compose-${draft.id}`, "popup,width=600,height=760,noopener");
    setComposeWindows(windows => windows.filter(window => window.draft.id !== draft.id));
  }

  function discardCompose(draft: ComposeDraft) {
    const mailbox = discardDrafts(mailboxData, [draft.id || ""]);
    if (route.view === "compose") localStorage.setItem(STORAGE_KEY, JSON.stringify(mailbox));
    dispatch({ type: "change", update: () => mailbox, message: "Draft discarded.", undoable: true });
    closeCompose(draft.id);
  }

  const releaseDueMessages = useEffectEvent(() => {
    const dueScheduled = state.emails.filter(
      (email) =>
        email.folder === "drafts" &&
        email.scheduledFor &&
        new Date(email.scheduledFor).getTime() <= Date.now(),
    );
    const dueSnoozed = state.emails.filter(
      (email) =>
        email.folder !== "trash" &&
        email.folder !== "spam" &&
        email.snoozedUntil &&
        new Date(email.snoozedUntil).getTime() <= Date.now(),
    );
    if (!dueScheduled.length && !dueSnoozed.length) return;
    dispatch({
      type: "change",
      update: mailbox => {
        const sent = dueScheduled.reduce((next, draft) => sendDraftMailbox(next, draftFromEmail(draft)), mailbox);
        return { ...sent, emails: sent.emails.map(email => dueSnoozed.some(due => due.id === email.id) ? { ...email, folder: "inbox", snoozedUntil: undefined } : email) };
      },
      message: dueScheduled.length
        ? "Scheduled message moved to Sent. (Mock mailbox only)"
        : "Snoozed conversations returned to your Inbox.",
    });
  });
  useEffect(() => {
    releaseDueMessages();
    const timer = setInterval(() => releaseDueMessages(), 60000);
    return () => clearInterval(timer);
  }, []);

  function replyDraft(mailbox: Mailbox, emailId: string, body: string, mode: "reply" | "replyAll" | "forward", to?: string, html?: string, attachments: Attachment[] = [], options: ReplyOptions = {}): ComposeDraft | undefined {
    const original = mailbox.emails.find(email => email.id === emailId);
    if (!original) return;
    const previous = mailbox.emails.find(email => email.replyToId === emailId && email.folder === "drafts" && !email.scheduledFor);
    return { id: previous?.id || crypto.randomUUID(), replyToId: emailId, replyMode: mode, labels: previous?.labels || [],
      to: to ?? original.senderEmail, cc: options.cc || "", bcc: options.bcc || "",
      subject: previous?.subject || `${mode === "forward" ? "Fwd" : "Re"}: ${original.subject.replace(/^(?:(?:Re|Fwd?):\s*)+/i, "")}`,
      body, html, attachments, confidential: options.confidential };
  }

  function sendReply(emailId: string, body: string, mode: "reply" | "replyAll" | "forward", to?: string, html?: string, attachments: Attachment[] = [], options: ReplyOptions = {}) {
    const draft = replyDraft(mailboxData, emailId, body, mode, to, html, attachments, options);
    if (!draft) return;
    if (options.scheduledFor) scheduleDraft(draft, options.scheduledFor);
    else sendDraft(draft);
    setReplyIntent(undefined);
  }

  function saveReply(emailId: string, body: string, mode: "reply" | "replyAll" | "forward", to: string, html?: string, attachments: Attachment[] = [], options: ReplyOptions = {}) {
    dispatch({ type: "change", update: mailbox => {
      const draft = replyDraft(mailbox, emailId, body, mode, to, html, attachments, options);
      return draft ? saveDraftMailbox(mailbox, draft, options.scheduledFor) : mailbox;
    } });
  }

  function popoutReply(emailId: string, body: string, mode: "reply" | "replyAll" | "forward", to: string, html: string, attachments: Attachment[], editSubject = false, options: ReplyOptions = {}) {
    const draft = replyDraft(mailboxData, emailId, body, mode, to, html, attachments, options);
    if (!draft) return;
    dispatch({ type: "change", update: mailbox => saveDraftMailbox(mailbox, draft) });
    openCompose(draft, editSubject);
    setReplyIntent(undefined);
  }

  function discardReply(emailId: string) {
    dispatch({
      type: "change",
      update: mailbox => discardDrafts(mailbox, mailbox.emails.filter(email => email.replyToId === emailId && !email.scheduledFor).map(email => email.id)),
    });
  }

  function labelAction(
    action: "edit" | "delete" | "color" | "visibility" | "messageVisibility",
    id: string,
    value?: string,
    textColor?: string,
  ) {
    const label = state.labels.find((item) => item.id === id);
    if (!label) return;
    if (action === "edit") return setDialog({ type: "label", label });
    if (action === "delete") return setDialog({ type: "deleteLabel", label });
    dispatch({
      type: "change",
      update: (mailbox) => ({
        ...mailbox,
        labels: mailbox.labels.map((item): Label => {
          if (item.id !== id) return item;
          if (action === "visibility" && (value === "show" || value === "hide" || value === "unread")) return { ...item, visibility: value, visible: value !== "hide" };
          if (action === "messageVisibility") return { ...item, messageVisible: value !== "hide" };
          return { ...item, color: value, textColor };
        }),
      }),
    });
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (event.key === "Escape") {
      if (
        dialog ||
        filterQuery !== undefined ||
        target.closest('[role="menu"],[role="dialog"],.gmail-search')
      )
        return;
      setSelectedIds(new Set());
      setSettingsOpen(false);
      return;
    }
    if (!keyboardShortcuts) return;
    if (
      dialog ||
      filterQuery ||
      target.closest(
        'input,textarea,select,[contenteditable="true"],[role="menu"],[role="dialog"]',
      )
    )
      return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (pendingGo.current) {
      pendingGo.current = false;
      const destination = (
        {
          i: "inbox",
          s: "starred",
          t: "sent",
          d: "drafts",
          a: "all",
        } as Record<string, string>
      )[event.key];
      if (destination) {
        event.preventDefault();
        navigate(destination);
        return;
      }
    }
    const ids = thread ? [thread.id] : [...selectedIds];
    const focused = target
      .closest("[data-email-id]")
      ?.getAttribute("data-email-id");
    const focusedEmail = state.emails.find((email) => email.id === focused);
    switch (event.key) {
      case "/":
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>('input[aria-label="Search mail"]')
          ?.focus();
        break;
      case "c":
        event.preventDefault();
        openCompose({
          id: crypto.randomUUID(),
          to: "",
          cc: "",
          bcc: "",
          subject: "",
          body: "",
          attachments: [],
        });
        break;
      case "?":
        event.preventDefault();
        setDialog({ type: "help" });
        break;
      case "g":
        pendingGo.current = true;
        setTimeout(() => {
          pendingGo.current = false;
        }, 1000);
        break;
      case "u":
        if (thread) {
          event.preventDefault();
          navigate(route.view, route.query);
        }
        break;
      case "e":
        if (ids.length) {
          event.preventDefault();
          onAction("archive", ids);
        }
        break;
      case "#":
        if (ids.length) {
          event.preventDefault();
          onAction("delete", ids);
        }
        break;
      case "!":
        if (ids.length) {
          event.preventDefault();
          onAction("spam", ids);
        }
        break;
      case "I":
        if (ids.length) {
          event.preventDefault();
          onAction("read", ids);
        }
        break;
      case "U":
        if (ids.length) {
          event.preventDefault();
          onAction("unread", ids);
        }
        break;
      case "r":
        if (thread) {
          event.preventDefault();
          requestReply("reply");
        }
        break;
      case "a":
        if (thread) {
          event.preventDefault();
          requestReply("replyAll");
        }
        break;
      case "f":
        if (thread) {
          event.preventDefault();
          requestReply("forward");
        }
        break;
      case "s":
        if (thread || focusedEmail) {
          event.preventDefault();
          const email = thread || focusedEmail!;
          onAction(email.starred ? "unstar" : "star", [email.id]);
        }
        break;
      case "x":
        if (focused) {
          event.preventDefault();
          selectEmail(focused, event.shiftKey);
        }
        break;
      case "j":
      case "k": {
        event.preventDefault();
        const offset = event.key === "j" ? 1 : -1;
        if (thread) {
          const next = visibleEmails[threadIndex + offset];
          if (next) openEmail(next);
        } else {
          const rows = [
            ...document.querySelectorAll<HTMLElement>("[data-email-id]"),
          ];
          const index = rows.findIndex(
            (row) => row.dataset.emailId === focused,
          );
          rows[Math.max(0, Math.min(rows.length - 1, index + offset))]?.focus();
        }
        break;
      }
    }
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function toggleFilter(term: string) {
    const tokens = route.query.split(/\s+/);
    onSearch(
      tokens.includes(term)
        ? tokens.filter((token) => token !== term).join(" ")
        : `${route.query} ${term}`.trim(),
    );
  }

  if (route.view === "compose") {
    const current = composeWindows[0];
    return <div className="app app-native-compose">{current ? <Composer draft={current.draft} popout replyContext={!!current.draft.replyToId} focusSubject={current.focusSubject} contacts={contacts} recipientSuggestions={recipientSuggestions} labels={state.labels} onSave={saveDraft} onSend={sendDraft} onSchedule={scheduleDraft} onClose={() => closeCompose(current.draft.id)} onDiscard={() => discardCompose(current.draft)} /> : <div className="empty-mail">This draft is no longer available.</div>}</div>;
  }

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Header
        emails={state.emails}
        labels={state.labels}
        query={route.query}
        onSearch={onSearch}
        onToggleSidebar={() => setCollapsed((value) => !value)}
        onSettings={() => setSettingsOpen((value) => !value)}
        onHelp={topic => { if (topic === "training") window.open(new URL(GMAIL_TRAINING_URL, "https://mail.google.com").href, "_blank", "noopener"); else setSupportTopic(topic === "feedback" ? "feedback" : "help"); }}
        onCreateFilter={setFilterQuery}
      />
      <div className="app-workspace">
        <Sidebar
          emails={state.emails}
          labels={state.labels}
          view={route.view}
          collapsed={collapsed}
          onNavigate={(view) => navigate(view)}
          onCompose={() =>
            openCompose({
              id: crypto.randomUUID(),
              to: "",
              cc: "",
              bcc: "",
              subject: "",
              body: "",
              attachments: [],
            })
          }
          onCreateLabel={(parentId) => setDialog({ type: "label", parentId })}
          onLabelAction={labelAction}
          onAction={onAction}
        />
        <main
          className="mail-pane"
          aria-label={thread ? "Conversation" : "Mailbox"}
        >
          {settingsTab ? <SettingsView tab={settingsTab} labels={state.labels} emails={state.emails} onTab={tab => navigate(`settings-${tab}`)} onClose={() => navigate("inbox")} onCreateLabel={parentId => setDialog({ type: "label", parentId })} onLabelAction={labelAction} onLabelVisibility={(id, visible) => dispatch({ type: "change", update: mailbox => ({ ...mailbox, labels: mailbox.labels.map(label => label.id === id ? { ...label, visible } : label) }) })} keyboardShortcuts={keyboardShortcuts} onKeyboardShortcuts={setKeyboardShortcuts} filters={filters} onCreateFilter={() => document.querySelector<HTMLButtonElement>('button[aria-label="Advanced search options"]')?.click()} onEditFilter={rule => setFilterQuery(rule.query)} onDeleteFilter={id => setFilters(previous => previous.filter(rule => rule.id !== id))} /> : <>
          {!thread && <NEWSearchFilters view={route.view} query={route.query} emails={state.emails} labels={state.labels} onSearch={onSearch} onAdvanced={() => document.querySelector<HTMLButtonElement>('button[aria-label="Advanced search options"]')?.click()} />}
          <Toolbar
            onManageLabels={() => navigate("settings-labels")}
            sortControl={route.view === "search" && !thread ? <SearchSort value={sort} onChange={setSort} /> : undefined}
            view={route.view}
            selectedEmails={selectedEmails}
            allSelected={allSelected}
            someSelected={someSelected}
            count={total}
            page={thread ? Math.max(0, threadIndex) : safePage}
            pageSize={pageSize}
            onPage={(next) => {
              if (thread) {
                const nextEmail = visibleEmails[next];
                if (nextEmail) openEmail(nextEmail);
              } else {
                setPage(next);
                setSelectedIds(new Set());
              }
            }}
            onSelectAll={() => selectBy(allSelected ? "none" : "all")}
            onSelectBy={selectBy}
            onRefresh={() =>
              dispatch({ type: "notice", message: "Mailbox is up to date." })
            }
            onAction={onAction}
            labels={state.labels}
            thread={thread}
            onBack={() => navigate(route.view, route.query)}
          />
          <div className={`mail-scroll${!thread && ["search", "sent", "drafts"].includes(route.view) ? " mail-scroll-refined" : ""}`} ref={scrollRef}>
            {thread ? (
              <>
                {thread.scheduledFor && (
                  <div className="folder-notice">
                    Send scheduled for{" "}
                    {new Date(thread.scheduledFor).toLocaleString()}
                    <button
                      onClick={() => {
                        dispatch({
                          type: "change",
                          update: (mailbox) => ({
                            ...mailbox,
                            emails: mailbox.emails.map((email) =>
                              email.id === thread.id
                                ? { ...email, scheduledFor: undefined }
                                : email,
                            ),
                          }),
                          message: "Scheduled send canceled.",
                        });
                        navigate("drafts");
                        openEmail({ ...thread, scheduledFor: undefined });
                      }}
                    >
                      Cancel send
                    </button>
                  </div>
                )}
                <MessageView
                  key={thread.id}
                  email={thread}
                  labels={state.labels}
                  onAction={onAction}
                  onSendReply={sendReply}
                  onSaveReply={saveReply}
                  onDiscardReply={discardReply}
                  onPopoutReply={popoutReply}
                  replyRequestId={replyRequestId}
                  replyDocked={!!dockedReply}
                  replyDockExpanded={dockedReply?.dockExpanded !== false}
                  onFocusDockedReply={() => { if (dockedReply) openCompose(dockedReply.draft); }}
                  replyDraft={
                    replyEmail && !dockedReply
                      ? {
                          body: draftFromEmail(replyEmail).body,
                          html: draftFromEmail(replyEmail).html,
                          attachments: replyEmail.attachments,
                          cc: draftFromEmail(replyEmail).cc,
                          bcc: draftFromEmail(replyEmail).bcc,
                          confidential: replyEmail.confidential,
                          to:
                            replyEmail.messages[0]?.to
                              .map((address) => address.email)
                              .join(", ") || "",
                          mode: replyEmail.replyMode || "reply",
                        }
                      : undefined
                  }
                  initialReply={replyIntent}
                />
              </>
            ) : (
              <>
                {route.view === "search" && <SearchContactBanner query={route.query} emails={state.emails} />}
                {(route.view === "trash" || route.view === "spam") && (
                  <div className="folder-notice">
                    Messages that have been in{" "}
                    {route.view === "trash" ? "Trash" : "Spam"} more than 30
                    days will be automatically deleted.
                    {total > 0 && (
                      <button
                        onClick={() =>
                          setDialog({
                            type: "deleteForever",
                            ids: visibleEmails.map((email) => email.id),
                          })
                        }
                      >
                        Empty {route.view === "trash" ? "Trash" : "Spam"} now
                      </button>
                    )}
                  </div>
                )}
                {pageEmails.length ? (
                  <MailList
                    onManageLabels={() => navigate("settings-labels")}
                    emails={pageEmails}
                    selectedIds={selectedIds}
                    labels={state.labels}
                      onSelect={selectEmail}
                      onContextSelect={id => { setSelectedIds(new Set([id])); lastSelected.current = id; }}
                    onOpen={openEmail}
                    onAction={onAction}
                    density={density}
                  />
                ) : (
                  <div className="empty-mail">
                    <strong>
                      {route.view === "search"
                        ? "No conversations found."
                        : route.view === "starred"
                          ? "No starred messages."
                          : route.view === "snoozed"
                            ? "No snoozed messages."
                            : route.view === "trash"
                              ? "No conversations in Trash."
                              : route.view === "spam"
                                ? "Hooray, no spam here!"
                                : route.view === "drafts"
                                  ? "You don't have any saved drafts."
                                  : "No conversations in this view."}
                    </strong>
                    {route.view === "search"
                      ? "Try using different keywords or search options."
                      : route.view === "starred"
                        ? "Stars let you give messages a special status to make them easier to find."
                        : ""}
                  </div>
                )}
                <footer className="mail-footer">
                  <div>
                    <div className="storage-bar">
                      <span />
                    </div>
                    <button onClick={() => setSettingsOpen(true)}>
                      2.57 GB of 15 GB used <Icon name="openInNew" size={14} />
                    </button>
                  </div>
                  <div className="mail-footer-middle">
                    Terms · Privacy · Program Policies
                  </div>
                  <div className="mail-footer-last">
                    Last account activity: 1 minute ago
                    <br />
                    <button
                      onClick={() =>
                        dispatch({
                          type: "notice",
                          message:
                            "This mailbox is local to your browser. No Google account is connected.",
                        })
                      }
                    >
                      Details
                    </button>
                  </div>
                </footer>
              </>
            )}
          </div>
          </>}
        </main>
        {settingsOpen && (
          <aside className="settings-panel" aria-label="Quick settings">
            <div className="settings-title">
              <h2>Quick settings</h2>
              <button
                className="icon-button"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <section className="settings-section">
              <h3>Density</h3>
              <button className="text-button" onClick={() => { setSettingsOpen(false); navigate("settings-general"); }}>See all settings</button>
              {(["default", "comfortable", "compact"] as Density[]).map(
                (value) => (
                  <label className="settings-option" key={value}>
                    <input
                      type="radio"
                      name="density"
                      value={value}
                      checked={density === value}
                      onChange={() => setDensity(value)}
                    />
                    {value[0].toUpperCase() + value.slice(1)}
                  </label>
                ),
              )}
            </section>
            <section className="settings-section">
              <h3>Theme</h3>
              <div className="theme-swatch" aria-label="Dark theme selected">
                <Icon name="check" size={20} />
              </div>
            </section>
            <section className="settings-section">
              <h3>Maximum page size</h3>
              <label className="settings-option">
                Show{" "}
                <select
                  aria-label="Messages per page"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(0);
                  }}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>{" "}
                conversations
              </label>
            </section>
            <section className="settings-section">
              <h3>Keyboard shortcuts</h3>
              <button
                className="text-button"
                onClick={() => setDialog({ type: "help" })}
              >
                View shortcuts
              </button>
              <p className="settings-description">
                This first-phase clone uses a persistent mock mailbox. Compose,
                labels, and mail actions change only the data in this browser.
              </p>
            </section>
            <section className="settings-section">
              <h3>Filters</h3>
              {filters.length ? (
                filters.map((filter) => (
                  <div className="saved-filter" key={filter.id}>
                    <span>{filter.query}</span>
                    <button
                      className="icon-button"
                      aria-label={`Remove filter ${filter.query}`}
                      onClick={() =>
                        setFilters((previous) =>
                          previous.filter((rule) => rule.id !== filter.id),
                        )
                      }
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="settings-description">
                  No filters. Create one from advanced search options.
                </p>
              )}
            </section>
          </aside>
        )}
      </div>
      {supportTopic && <SupportView topic={supportTopic} onClose={() => setSupportTopic(undefined)} />}
      {filterQuery !== undefined && (
        <FilterDialog
          query={filterQuery}
          labels={state.labels}
          count={searchEmails(state.emails, filterQuery, state.labels).length}
          onClose={() => setFilterQuery(undefined)}
          onBack={() => { setFilterQuery(undefined); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('button[aria-label="Advanced search options"]')?.click()); }}
          onCreate={(rule, apply) => {
            setFilters((previous) => [...previous, rule]);
            if (apply)
              dispatch({
                type: "change",
                update: (mailbox) => {
                  const ids = new Set(
                    searchEmails(
                      mailbox.emails,
                      rule.query,
                      mailbox.labels,
                    ).map((email) => email.id),
                  );
                  return {
                    ...mailbox,
                    emails: mailbox.emails.map((email) =>
                      ids.has(email.id)
                        ? {
                            ...email,
                            folder: rule.trash
                              ? "trash"
                              : rule.archive
                                ? "archive"
                                : rule.neverSpam && email.folder === "spam"
                                  ? "inbox"
                                  : email.folder,
                            unread: rule.read ? false : email.unread,
                            starred: rule.star || email.starred,
                            important: rule.notImportant ? false : rule.important || email.important,
                            labels: rule.labelId
                              ? [...new Set([...email.labels, rule.labelId])]
                              : email.labels,
                            category: (rule.category ||
                              email.category) as Email["category"],
                          }
                        : email,
                    ),
                  };
                },
                message: "Your filter was created and applied.",
                undoable: true,
              });
            else
              dispatch({ type: "notice", message: "Your filter was created." });
            setFilterQuery(undefined);
            setSelectedIds(new Set());
          }}
        />
      )}
      {composeWindows.length > 0 && (
        <div className="compose-dock">
          {composeWindows.map(({ draft, focusSubject }) => (
            <div className="compose-slot" data-compose-id={draft.id} key={draft.id}>
              <Composer draft={draft} docked replyContext={!!draft.replyToId}
                focusSubject={focusSubject} contacts={contacts} labels={state.labels}
                recipientSuggestions={recipientSuggestions}
                onSave={saveDraft} onSend={sendDraft} onSchedule={scheduleDraft}
                onClose={() => closeCompose(draft.id)} onDiscard={() => discardCompose(draft)}
                onPopout={popoutCompose} onDockExpandedChange={expanded => setDockExpanded(draft.id, expanded)} />
            </div>
          ))}
        </div>
      )}
      {dialog && (
        <AppDialog
          key={JSON.stringify(dialog)}
          dialog={dialog}
          labels={state.labels}
          onClose={() => setDialog(undefined)}
          onSubmit={(value, parentId) => {
            if (dialog.type === "label") {
              const labelId = dialog.label?.id || crypto.randomUUID();
              dispatch({
                type: "change",
                update: (mailbox) => ({
                  ...mailbox,
                  labels: dialog.label
                    ? mailbox.labels.map((label) =>
                        label.id === labelId
                          ? { ...label, name: value, parentId }
                          : label,
                      )
                    : [
                        ...mailbox.labels,
                        { id: labelId, name: value, parentId, visible: true },
                      ],
                  emails: mailbox.emails.map((email) =>
                    dialog.type === "label" &&
                    dialog.applyIds?.includes(email.id)
                      ? { ...email, labels: [...email.labels, labelId] }
                      : email,
                  ),
                }),
                message: `Label "${value}" ${dialog.label ? "updated" : "created"}.`,
                undoable: true,
              });
            } else if (dialog.type === "deleteLabel") {
              dispatch({
                type: "change",
                update: (mailbox) => {
                  const removed = new Set([dialog.label.id]);
                  let count = 0;
                  while (count !== removed.size) {
                    count = removed.size;
                    mailbox.labels.forEach((label) => {
                      if (label.parentId && removed.has(label.parentId))
                        removed.add(label.id);
                    });
                  }
                  return {
                    labels: mailbox.labels.filter(
                      (label) => !removed.has(label.id),
                    ),
                    emails: mailbox.emails.map((email) => ({
                      ...email,
                      labels: email.labels.filter((id) => !removed.has(id)),
                    })),
                  };
                },
                message: "Label removed. Messages were not deleted.",
                undoable: true,
              });
              if (route.view === `label:${dialog.label.id}`) navigate("inbox");
            } else if (dialog.type === "deleteForever") {
              dispatch({
                type: "change",
                update: (mailbox) =>
                  applyMailAction(mailbox, "deleteForever", dialog.ids),
                message: `${dialog.ids.length} conversations permanently deleted.`,
              });
              setSelectedIds(new Set());
            } else if (dialog.type === "filterField")
              onSearch(
                `${route.query} ${dialog.field}:${value.includes(" ") ? `"${value}"` : value}`,
              );
            setDialog(undefined);
          }}
        />
      )}
      {state.notice && (
        <div className="app-toast" role="status">
          <span>{state.notice.message}</span>
          {state.notice.undoable && (
            <button
              className="toast-action"
              onClick={() => {
                const sent = state.notice?.sent;
                dispatch({ type: "undo" });
                if (sent) openCompose(sent.draft);
              }}
            >
              Undo
            </button>
          )}
          {state.notice.sent && (
            <button className="toast-action" onClick={() => navigate("sent", "", state.notice!.sent!.emailId)}>
              View message
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => dispatch({ type: "dismiss" })}
          >
            <Icon name="toastClose20" size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

function AppDialog({
  dialog,
  labels,
  onClose,
  onSubmit,
}: {
  dialog: Dialog;
  labels: Label[];
  onClose: () => void;
  onSubmit: (value: string, parentId?: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(
    dialog.type === "label" ? dialog.label?.name || "" : "",
  );
  const [parentId, setParentId] = useState(
    dialog.type === "label"
      ? dialog.parentId || dialog.label?.parentId || ""
      : "",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  const title =
    dialog.type === "help"
      ? "Keyboard shortcuts"
      : dialog.type === "label"
        ? dialog.label
          ? "Edit label"
          : "New label"
        : dialog.type === "deleteLabel"
          ? "Remove label"
          : dialog.type === "deleteForever"
            ? "Confirm permanent deletion"
            : dialog.title;
  return (
    <dialog
      ref={ref}
      className="app-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
      aria-label={title}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (dialog.type === "label") {
            if (!value.trim()) return setError("Please enter a label name.");
            if (
              labels.some(
                (label) =>
                  label.name.toLowerCase() === value.trim().toLowerCase() &&
                  label.parentId === (parentId || undefined) &&
                  label.id !== dialog.label?.id,
              )
            )
              return setError("A label with this name already exists.");
          }
          onSubmit(value.trim(), parentId || undefined);
        }}
      >
        <h2>{title}</h2>
        {dialog.type === "help" ? (
          <div className="help-shortcuts">
            Compose<kbd>C</kbd>Search mail<kbd>/</kbd>Next / previous
            conversation<kbd>J / K</kbd>Select conversation<kbd>X</kbd>Star
            conversation<kbd>S</kbd>Archive selected<kbd>E</kbd>Delete selected
            <kbd>Shift + 3</kbd>Mark as read / unread<kbd>Shift + I / U</kbd>
            Reply / reply all / forward<kbd>R / A / F</kbd>Return to list
            <kbd>U</kbd>Go to Inbox<kbd>G then I</kbd>
          </div>
        ) : dialog.type === "label" ? (
          <>
            <label className="dialog-label">
              Please enter a new label name:
              <input
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                aria-label="Label name"
              />
            </label>
            <label className="dialog-label">
              Nest label under:
              <select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
                aria-label="Parent label"
              >
                <option value="">No parent label</option>
                {labels
                  .filter(
                    (label) => label.id !== dialog.label?.id && !label.parentId,
                  )
                  .map((label) => (
                    <option key={label.id} value={label.id}>
                      {label.name}
                    </option>
                  ))}
              </select>
            </label>
            {error && <p className="dialog-error">{error}</p>}
          </>
        ) : dialog.type === "deleteLabel" ? (
          <p>
            Remove label "{dialog.label.name}" and its nested labels? Messages
            with this label will not be deleted.
          </p>
        ) : dialog.type === "deleteForever" ? (
          <p>
            {dialog.ids.length} conversations will be permanently deleted from
            this mock mailbox. This cannot be undone.
          </p>
        ) : (
          <label className="dialog-label">
            {dialog.title}
            <input
              autoFocus
              type={dialog.field === "after" ? "date" : "text"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              required
            />
          </label>
        )}
        <div className="dialog-actions">
          <button type="button" className="text-button" onClick={onClose}>
            {dialog.type === "help" ? "Close" : "Cancel"}
          </button>
          {dialog.type !== "help" && (
            <button className="primary-button" type="submit">
              {dialog.type === "label"
                ? dialog.label
                  ? "Save"
                  : "Create"
                : dialog.type === "deleteLabel"
                  ? "Remove"
                  : dialog.type === "deleteForever"
                    ? "Delete"
                    : "Search"}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
