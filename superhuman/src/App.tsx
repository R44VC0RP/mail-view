import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type MouseEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  accounts,
  defaultPreferences,
  displayDate,
  folders,
  loadSaved,
  reminderTime,
  seedDrafts,
  seedMail,
  type Draft,
  type Mail,
  type Preferences,
  type SendOptions,
} from "./data";
import { Icon, IconButton, Key, Modal } from "./components";
import Composer from "./Composer";
import ThreadView from "./ThreadView";
import Settings from "./Settings";
import CalendarView from "./CalendarView";
import Snippets from "./Snippets";
import { useMailMotion } from "./mail-motion";
import { shortcutGroups } from "./shortcuts";
import {
  advanceMail,
  appendOutgoing,
  moveMail,
  normalizeSchedule,
  remindMail,
  restoreMail,
} from "./mail-model";
import { readText, removeSaved, writeSaved, writeText } from "./storage";
import { usePersistence } from "./use-persistence";
import FolderNavigation from "./FolderNavigation";
import MailRows from "./MailRows";
import RecentOpens from "./RecentOpens";
import { selectMailView } from "./mail-view";
import { escapeHTML, plainText } from "./mail-text";
import { resolveMailShortcut } from "./mail-shortcuts";
import MailCommandDialog, { type CommandItem } from "./MailCommandDialog";
import IssueReporter from "./IssueReporter";
import { captureIssueReport, type IssueReport } from "./issue-reports";

type Route = {
  account: string;
  folder: string;
  split: string;
  thread?: string;
  draft?: string;
  view?: string;
};
type Overlay =
  | "command"
  | "remind"
  | "label"
  | "shortcuts"
  | "accounts"
  | "help"
  | "profile"
  | "searchTips"
  | null;
const searchTips = [
  ["from:alex", "from Alex"],
  ["to:jamie", "to Jamie"],
  ['"be brilliant"', 'contains "be brilliant"'],
  ["has:attachment", "with attachments"],
  ["subject:project", 'subject contains "project"'],
  ["in:sent", "in Sent"],
  ["in:inbox", "in the Inbox"],
  ["-in:inbox", "not in the Inbox"],
  ["label:Projects", "in this label"],
  ["is:unread", "unread conversations"],
  ["is:starred", "starred conversations"],
  ["before:2026/08/01", "before August 2026"],
  ["after:2026/08/01", "August 2026 or later"],
  ["older_than:3d", "more than 3 days ago"],
  ["newer_than:1m", "1 month ago or later"],
];
function readRoute(): Route {
  const params = new URLSearchParams(location.hash.replace(/^#\/?/, ""));
  return {
    account: params.get("account") || accounts[0],
    folder: params.get("folder") || "Inbox",
    split: params.get("split") || "Important",
    thread: params.get("thread") || undefined,
    draft: params.get("draft") || undefined,
    view: params.get("view") || undefined,
  };
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [mail, setMail] = useState<Mail[]>(() =>
    loadSaved("mail", seedMail()).map(normalizeSchedule),
  );
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    loadSaved("drafts", seedDrafts),
  );
  const [preferences, setPreferences] = useState<Preferences>(() => ({
    ...defaultPreferences,
    ...loadSaved("preferences", {}),
  }));
  const [navigation, setNavigation] = useState(false);
  const [settings, setSettings] = useState(false);
  const [settingsPage, setSettingsPage] = useState<string>();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [issueReporter, setIssueReporter] = useState<{
    draft: IssueReport | null;
  } | null>(null);
  const [capturingIssue, setCapturingIssue] = useState(false);
  const issueCapturePending = useRef(false);
  const [overlayIds, setOverlayIds] = useState<string[] | null>(null);
  const [commandDraftId, setCommandDraftId] = useState<string | null>(null);
  const commandMode =
    overlay === "command" ||
    overlay === "remind" ||
    overlay === "label" ||
    overlay === "accounts"
      ? overlay
      : null;
  const [labelEdit, setLabelEdit] = useState<{
    name: string;
    value: string;
    deleting: boolean;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [mailFilter, setMailFilter] = useState<string | null>(null);
  const [availabilityRequest, setAvailabilityRequest] = useState(0);
  const [replyRequest, setReplyRequest] = useState(0);
  const [calendarInitialView, setCalendarInitialView] = useState<
    "day" | "week"
  >("week");
  const [labelMode, setLabelMode] = useState<"toggle" | "move" | "navigate">(
    "toggle",
  );
  const [searchHistory, setSearchHistory] = useState<string[]>(() =>
    loadSaved("searches", []),
  );
  const [highlight, setHighlight] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [customLabels, setCustomLabels] = useState<string[]>(() =>
    loadSaved("labels", [
      "Projects",
      "Marketing",
      "News",
      "Pitch",
      "Social",
      "Orders",
      "Payments",
      "Low Priority",
      "Focus",
      "Focus/Backlog Cleared",
      "Focus/Blocked",
      "Focus/Handle Later",
      "Verifications",
      "Customer Feedback",
      "[Docs]",
      "Open Source",
      "Tax Info",
      "Deploy Bot Messages",
    ]),
  );
  const [notice, setNotice] = useState<{
    text: string;
    undo?: () => void;
  } | null>(null);
  const [noticeFading, setNoticeFading] = useState(false);
  const [noticeHovered, setNoticeHovered] = useState(false);
  const [profile, setProfile] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [userProfile, setUserProfile] = useState(() =>
    loadSaved("profile", {
      name: "Avery Lane",
      location: "Remote",
      bio: "Designer and builder at Orchard Labs. I make small, useful tools and like learning how things work.",
      website: "averylane.example.com",
    }),
  );
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const searchInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const sequence = useRef({ key: "", time: 0 });
  const searchOrigin = useRef<Route | null>(null);
  const accountOptions = useMemo(
    () => [
      ...new Set([
        accounts[1],
        accounts[0],
        ...(Array.isArray(preferences.additionalAccounts)
          ? (preferences.additionalAccounts as string[])
          : []),
      ]),
    ],
    [preferences.additionalAccounts],
  );
  const deferredQuery = useDeferredValue(query);
  const resultQuery = searchSubmitted ? query : deferredQuery;
  const accountMail = useMemo(
    () => mail.filter((message) => message.account === route.account),
    [mail, route.account],
  );
  const recent = useMemo(
    () =>
      accountMail
        .filter((message) => message.opened && message.folder !== "Trash")
        .slice(0, 30),
    [accountMail],
  );
  const contacts = useMemo(
    () => [
      ...new Map(
        accountMail.map((message) => [
          message.email,
          { name: message.from, email: message.email },
        ]),
      ).values(),
    ],
    [accountMail],
  );
  const {
    visibleMail,
    shownSplits,
    splitCounts,
    inboxCount,
    entries,
    totalHeight,
    rowHeight,
  } = useMemo(
    () =>
      selectMailView(
        accountMail,
        route.account,
        route.folder,
        route.split,
        preferences,
        search,
        resultQuery,
        mailFilter,
      ),
    [
      accountMail,
      route.account,
      route.folder,
      route.split,
      preferences,
      search,
      resultQuery,
      mailFilter,
    ],
  );
  const accountDrafts = useMemo(
    () => drafts.filter((d) => d.account === route.account),
    [drafts, route.account],
  );
  const isDrafts = route.folder === "Drafts" && !search;
  const currentMail = accountMail.find((m) => m.id === route.thread);
  // A reply keeps its thread association when the user changes its From account.
  const currentDraft =
    drafts.find((d) => d.id === route.draft) ||
    (currentMail
      ? drafts.find((d) => d.threadId === currentMail.id)
      : undefined);
  const rowCount = isDrafts ? accountDrafts.length : visibleMail.length;
  const virtualized =
    !isDrafts && (!search || searchSubmitted) && entries.length > 100;
  const displayedRows = isDrafts ? accountDrafts : visibleMail;
  const rowsKey = useMemo(
    () =>
      `${preferences.density}:${displayedRows.map((item) => item.id).join("|")}`,
    [preferences.density, displayedRows],
  );
  const targetIds =
    commandMode && commandMode !== "accounts" && overlayIds
      ? overlayIds
      : selected.length
        ? selected
        : currentMail
          ? [currentMail.id]
          : visibleMail[highlight]
            ? [visibleMail[highlight].id]
            : [];
  const targets = mail.filter((m) => targetIds.includes(m.id));
  const dark =
    !["Light", "light"].includes(preferences.theme) &&
    (!["System", "Match System"].includes(preferences.theme) || systemDark);
  const motion = useMailMotion(list, {
    rowsKey: search && !searchSubmitted ? `suggestions:${query}` : rowsKey,
    viewKey: `${route.account}:${route.folder}:${route.split}:${search ? `search:${searchSubmitted ? resultQuery : "suggestions"}` : "list"}:${route.thread || route.draft || route.view || ""}`,
    highlight,
    focused: !navigation && !searchFocused,
  });
  useLayoutEffect(() => {
    const root = list.current;
    if (!root) return;
    root.scrollTop = listScroll.current;
  }, [route.thread, route.draft, route.view, search, searchSubmitted]);

  const storageFailure = () =>
    setNotice({
      text: "Browser storage is unavailable or full. Your changes remain open but could not be saved.",
    });
  usePersistence("mail", mail, storageFailure);
  usePersistence("drafts", drafts, storageFailure);
  usePersistence("preferences", preferences, storageFailure);
  usePersistence("labels", customLabels, storageFailure);
  usePersistence("searches", searchHistory, storageFailure);
  usePersistence("profile", userProfile, storageFailure);
  useEffect(() => {
    const deliver = () => setMail((all) => advanceMail(all, Date.now()));
    deliver();
    const timer = setInterval(deliver, 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.style =
      preferences.themeStyle === "Classic" ? "Classic" : "Superlocal";
    document.documentElement.dataset.density =
      preferences.density.toLowerCase();
    document.title = `${currentMail?.subject || (route.draft ? "New Message" : route.folder === "Inbox" ? route.split : route.folder)} - Superlocal`;
  }, [
    dark,
    preferences.themeStyle,
    preferences.density,
    currentMail?.subject,
    route,
  ]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setSystemDark(media.matches);
    media.addEventListener("change", listener);
    const pop = () => {
      setRoute(readRoute());
      closeNavigation();
      setSelected([]);
    };
    addEventListener("popstate", pop);
    return () => {
      media.removeEventListener("change", listener);
      removeEventListener("popstate", pop);
    };
  }, []);
  useEffect(() => {
    setNoticeHovered(false);
  }, [notice]);
  useEffect(() => {
    setNoticeFading(false);
    if (!notice || noticeHovered) return;
    const lifetime = notice.undo ? 10000 : 4000;
    const fade = setTimeout(() => setNoticeFading(true), lifetime);
    const remove = setTimeout(() => setNotice(null), lifetime + 2000);
    return () => {
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, [notice, noticeHovered]);
  useEffect(() => {
    if (search) searchInput.current?.focus();
  }, [search]);
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>('[data-highlighted="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  function navigate(patch: Partial<Route>) {
    const next = { ...route, ...patch };
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    history.pushState(null, "", `#/${params}`);
    setRoute(next);
    closeNavigation();
    setProfile(false);
    setMobileSidebar(false);
  }
  function closeNavigation() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".folder-panel"))
      active.blur();
    setNavigation(false);
  }
  function goFolder(
    folder: string,
    split = preferences.splits[0] || "Important",
  ) {
    motion.prepare("switch");
    listScroll.current = 0;
    if (list.current) list.current.scrollTop = 0;
    navigate({
      folder,
      split,
      thread: undefined,
      draft: undefined,
      view: folder === "Snippets" ? "snippets" : undefined,
    });
    setSearch(false);
    setMailFilter(null);
    setQuery("");
    setSelected([]);
    setHighlight(0);
  }
  function openOverlay(value: Overlay, ids = targetIds) {
    if (value === "label") setLabelMode("toggle");
    if (value === "command") {
      const draft =
        (currentDraft &&
        (!currentDraft.popOut ||
          document.activeElement?.closest(".compose-view"))
          ? currentDraft
          : undefined) ||
        (isDrafts && !route.thread
          ? accountDrafts[highlight]
          : ids.length === 1
            ? drafts.find((draft) => draft.threadId === ids[0])
            : undefined);
      setCommandDraftId(draft?.id || null);
      if (draft) ids = draft.threadId ? [draft.threadId] : [];
    }
    setOverlayIds(
      value === "command" || value === "remind" || value === "label"
        ? ids
        : null,
    );
    setOverlay(value);
    closeNavigation();
  }
  function updatePreferences(patch: Partial<Preferences>) {
    setPreferences((p) => ({ ...p, ...patch }));
    if (patch.splits && !patch.splits.includes(route.split))
      navigate({ split: patch.splits[0] || "Other" });
    if (typeof patch.profileName === "string")
      setUserProfile((p) => ({ ...p, name: patch.profileName as string }));
    if (typeof patch.profileLocation === "string")
      setUserProfile((p) => ({
        ...p,
        location: patch.profileLocation as string,
      }));
  }
  async function reportIssue() {
    if (issueCapturePending.current) return;
    issueCapturePending.current = true;
    flushSync(() => {
      setOverlay(null);
      setCapturingIssue(true);
    });
    try {
      const app = document.querySelector<HTMLElement>(".app");
      if (!app) throw new Error("The page is unavailable.");
      setIssueReporter({ draft: await captureIssueReport(app) });
    } catch {
      setNotice({
        text: "Could not capture the page. Try the Issue command again.",
      });
    } finally {
      issueCapturePending.current = false;
      setCapturingIssue(false);
    }
  }
  function openSettings(page?: string) {
    setSettingsPage(page);
    setSettings(true);
    setMobileSidebar(true);
    closeNavigation();
    setOverlay(null);
  }
  function startSearch(floatingDraftId?: string) {
    motion.prepare("search");
    searchOrigin.current = route;
    flushSync(() => {
      if (floatingDraftId)
        setDrafts((all) =>
          all.map((draft) =>
            draft.id === floatingDraftId ? { ...draft, popOut: true } : draft,
          ),
        );
      navigate({ thread: undefined, draft: floatingDraftId, view: undefined });
      setSearch(true);
      setSearchSubmitted(false);
      setSelected([]);
      setHighlight(0);
    });
    searchInput.current?.focus();
  }
  function closeSearch() {
    motion.prepare("return");
    setSearchFocused(false);
    setSearchSubmitted(false);
    setSearch(false);
    setQuery("");
    if (searchOrigin.current) {
      const origin = searchOrigin.current;
      navigate({
        ...origin,
        draft: drafts.some((draft) => draft.id === origin.draft)
          ? origin.draft
          : undefined,
      });
      searchOrigin.current = null;
    }
  }
  function changeSearchQuery(value: string, submit = false) {
    motion.prepare(submit ? "return" : "search");
    setQuery(value);
    setSearchSubmitted(submit);
    setHighlight(0);
    if (submit) searchInput.current?.blur();
  }
  function openMail(m: Mail) {
    if (list.current) listScroll.current = list.current.scrollTop;
    motion.prepare("switch");
    if (preferences.markRead && m.unread)
      setMail((all) =>
        all.map((v) => (v.id === m.id ? { ...v, unread: false } : v)),
      );
    navigate({ thread: m.id, draft: undefined, view: undefined });
    setSelected([]);
  }
  function handleMailRow(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const row = event.target.closest<HTMLElement>("[data-mail-id]");
    // Animated exit clones are not interactive rows owned by this list.
    if (!row || row.parentElement !== event.currentTarget) return;
    const index = Number(row.getAttribute("aria-rowindex")) - 1;
    const mail = visibleMail[index];
    if (!mail || mail.id !== row.dataset.mailId) return;
    if (event.type === "mousedown") {
      setHighlight(index);
      return;
    }
    if (event.type === "contextmenu") {
      event.preventDefault();
      setHighlight(index);
      openOverlay("command", [mail.id]);
      return;
    }
    const action =
      event.target.closest<HTMLElement>("[data-mail-action]")?.dataset
        .mailAction;
    if (!action) {
      openMail(mail);
      return;
    }
    event.stopPropagation();
    if (action === "select") {
      setSelected((items) =>
        items.includes(mail.id)
          ? items.filter((id) => id !== mail.id)
          : [...items, mail.id],
      );
    } else if (action === "done") {
      applyAction("done", [mail.id]);
    } else if (action === "remind" || action === "command") {
      setHighlight(index);
      openOverlay(action, [mail.id]);
    }
  }
  function goBack() {
    motion.prepare("return");
    if (
      route.draft &&
      currentDraft &&
      !currentDraft.to &&
      !currentDraft.cc &&
      !currentDraft.bcc &&
      !currentDraft.subject &&
      !plainText(currentDraft.body).trim() &&
      !currentDraft.attachments.length
    )
      setDrafts((all) => all.filter((d) => d.id !== route.draft));
    navigate({ thread: undefined, draft: undefined, view: undefined });
    setProfile(false);
  }
  function toggleComposeFocus() {
    if (document.activeElement?.closest(".compose-view"))
      (
        list.current ||
        document.querySelector<HTMLElement>(
          ".thread-view [data-thread-message]",
        )
      )?.focus();
    else
      document
        .querySelector<HTMLElement>(".compose-view [contenteditable=true]")
        ?.focus();
  }
  function newDraft(
    subject = "",
    body = "",
    popOut = false,
    availability = false,
  ) {
    motion.prepare("switch");
    setAvailabilityRequest((value) => (availability ? value + 1 : 0));
    const draft: Draft = {
      id: `draft-${crypto.randomUUID()}`,
      account: route.account,
      mode: "new",
      popOut,
      to: "",
      cc: "",
      bcc:
        preferences.autoBccEnabled && Array.isArray(preferences.autoBcc)
          ? (preferences.autoBcc as string[]).join(", ")
          : "",
      subject,
      body,
      attachments: [],
      updated: Date.now(),
    };
    flushSync(() => {
      setDrafts((all) => [...all, draft]);
      navigate({ draft: draft.id, thread: undefined, view: undefined });
      setSearch(false);
    });
  }
  function composeReply(
    mode: "reply" | "replyAll" | "forward",
    popOut = false,
  ) {
    if (!currentMail) return;
    setReplyRequest((value) => value + 1);
    const message = currentMail.messages.at(-1)!;
    const existing =
      currentDraft?.threadId === currentMail.id ? currentDraft : undefined;
    if (existing) {
      setDrafts((all) =>
        all.map((d) =>
          d.id === existing.id
            ? { ...d, popOut: popOut || d.popOut, updated: Date.now() }
            : d,
        ),
      );
      if (existing.mode !== mode)
        setNotice({
          text: "Resumed your saved draft. Discard it to start a different reply.",
        });
      return;
    }
    const to =
      mode === "forward"
        ? ""
        : message.email === route.account
          ? message.to
          : message.email;
    const draft: Draft = {
      id: `draft-${crypto.randomUUID()}`,
      account: route.account,
      mode,
      popOut,
      threadId: currentMail.id,
      to,
      cc: mode === "replyAll" ? message.cc || "" : "",
      bcc:
        preferences.autoBccEnabled && Array.isArray(preferences.autoBcc)
          ? (preferences.autoBcc as string[]).join(", ")
          : "",
      subject: `${mode === "forward" ? "Fwd: " : /^re:/i.test(currentMail.subject) ? "" : "Re: "}${currentMail.subject}`,
      body:
        mode === "forward"
          ? `<p><br></p><blockquote><p>---------- Forwarded message ---------<br>From: ${escapeHTML(message.from)} &lt;${escapeHTML(message.email)}&gt;<br>Date: ${escapeHTML(message.date)}<br>Subject: ${escapeHTML(currentMail.subject)}<br>To: ${escapeHTML(message.to)}</p>${message.body}</blockquote>`
          : "",
      attachments: mode === "forward" ? message.attachments || [] : [],
      updated: Date.now(),
    };
    setDrafts((all) => [...all.filter((d) => d.id !== draft.id), draft]);
  }
  function updateDraft(draft: Draft) {
    setDrafts((all) =>
      all.map((d) =>
        d.id === draft.id ? { ...draft, updated: Date.now() } : d,
      ),
    );
  }
  function discardDraft(id = currentDraft?.id) {
    const old = drafts.find((draft) => draft.id === id);
    if (!old) return false;
    if (
      (old.to ||
        old.cc ||
        old.bcc ||
        old.subject ||
        plainText(old.body).trim() ||
        old.attachments.length) &&
      !window.confirm("Discard this draft?")
    )
      return false;
    const previousRoute = route;
    const previousHighlight = highlight;
    const previousIndex = drafts.indexOf(old);
    const nextDrafts = drafts.filter((draft) => draft.id !== old.id);
    if (!writeSaved("drafts", nextDrafts)) {
      storageFailure();
      return false;
    }
    const reminder = readText(`draft-reminder:${old.id}`);
    removeSaved(`draft-reminder:${old.id}`);
    setDrafts(nextDrafts);
    if (route.draft === old.id) goBack();
    if (isDrafts)
      setHighlight((value) =>
        Math.max(
          0,
          Math.min(
            value,
            nextDrafts.filter((draft) => draft.account === route.account)
              .length - 1,
          ),
        ),
      );
    setNotice({
      text: "Draft discarded",
      undo: () => {
        if (reminder) writeText(`draft-reminder:${old.id}`, reminder);
        setDrafts((all) => {
          const restored = all.filter((draft) => draft.id !== old.id);
          restored.splice(Math.min(previousIndex, restored.length), 0, old);
          return restored;
        });
        setHighlight(previousHighlight);
        navigate(previousRoute);
      },
    });
    return true;
  }
  function sendDraft(draft: Draft, when?: string, options?: SendOptions) {
    if (options?.instant) when = undefined;
    const original = mail.find(
      (m) => m.id === draft.threadId && m.account === draft.account,
    );
    let sent: Mail;
    try {
      sent = appendOutgoing(original, draft, {
        sender: userProfile.name,
        preview: plainText(draft.body),
        when,
        markDone: options?.markDone,
      });
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Could not prepare this message. Your draft has been kept.",
      });
      return false;
    }
    const id = sent.id;
    const draftReminder = readText(`draft-reminder:${draft.id}`);
    if (draftReminder) {
      sent.reminder = draftReminder;
      sent.reminderAt = reminderTime(draftReminder);
    }
    const nextMail = [sent, ...mail.filter((m) => m.id !== id)];
    if (!writeSaved("mail", nextMail)) {
      setNotice({
        text: "Not sent: browser storage is full. Your draft has been kept.",
      });
      return false;
    }
    setMail(nextMail);
    setDrafts((all) => all.filter((d) => d.id !== draft.id));
    goBack();
    setNotice({
      text: when
        ? `Scheduled for ${new Date(when).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
        : "Message sent",
      undo: () => {
        setMail((all) =>
          original
            ? all.map((m) => (m.id === id ? original : m))
            : all.filter((m) => m.id !== id),
        );
        setDrafts((all) => [...all, draft]);
        navigate({ draft: draft.id, thread: undefined, view: undefined });
      },
    });
    return true;
  }
  function applyAction(action: string, ids = targetIds) {
    if (action === "more") {
      openOverlay("command", ids);
      return;
    }
    if (action === "remind" || action === "label") {
      openOverlay(action, ids);
      return;
    }
    if (!ids.length) return;
    motion.prepare("remove");
    const previousRoute = route;
    const previousHighlight = highlight;
    const before = mail.filter((m) => ids.includes(m.id));
    if (
      action === "done" &&
      before.every((m) => ["Done", "Trash"].includes(m.folder))
    )
      action = "inbox";
    const starred = before.some((m) => !m.starred);
    const unread = before.some((m) => !m.unread);
    const muted = before.some((m) => !m.muted);
    setMail((all) =>
      all.map((m) =>
        !ids.includes(m.id)
          ? m
          : action === "star"
            ? { ...m, starred }
            : action === "mute"
              ? {
                  ...m,
                  muted,
                  folder: muted && m.folder === "Inbox" ? "Done" : m.folder,
                }
              : action === "unread"
                ? { ...m, unread }
                : moveMail(
                    m,
                    (
                      {
                        done: "Done",
                        trash: "Trash",
                        spam: "Spam",
                        inbox: "Inbox",
                      } as Record<string, string>
                    )[action] || m.folder,
                  ),
      ),
    );
    const labels: Record<string, string> = {
      done: "Marked as Done.",
      trash: "Moved to Trash",
      spam: "Moved to Spam",
      inbox: "Moved to Inbox",
      star: starred ? "Starred" : "Unstarred",
      unread: unread ? "Marked unread" : "Marked read",
      mute: muted ? "Muted" : "Unmuted",
    };
    setNotice({
      text: `${before.length > 1 ? `${before.length} conversations: ` : ""}${labels[action] || "Updated"}`,
      undo: () => undoMailChange(before, previousRoute, previousHighlight),
    });
    setSelected([]);
    if (
      currentMail &&
      ["done", "trash", "spam", "inbox", "mute"].includes(action)
    ) {
      const next =
        visibleMail[
          visibleMail.findIndex((m) => m.id === currentMail.id) +
            (preferences.advanceDirection === "Previous conversation" ? -1 : 1)
        ];
      if (preferences.autoAdvance && next) openMail(next);
      else goBack();
    }
    if (!["star", "unread"].includes(action))
      setHighlight((v) => Math.max(0, Math.min(v, rowCount - 2)));
    setOverlay(null);
  }
  function undoMailChange(
    before: Mail[],
    previousRoute: Route,
    previousHighlight: number,
  ) {
    motion.prepare("undo");
    setMail((all) => restoreMail(all, before));
    navigate(previousRoute);
    setHighlight(previousHighlight);
  }
  function remind(when: string) {
    motion.prepare("remove");
    const before = targets;
    const previousRoute = route;
    const previousHighlight = highlight;
    setMail((all) =>
      all.map((m) =>
        targetIds.includes(m.id) ? remindMail(m, when, reminderTime(when)) : m,
      ),
    );
    setOverlay(null);
    setSelected([]);
    if (currentMail) {
      const next =
        visibleMail[
          visibleMail.findIndex((m) => m.id === currentMail.id) +
            (preferences.advanceDirection === "Previous conversation" ? -1 : 1)
        ];
      if (preferences.autoAdvance && next) openMail(next);
      else goBack();
    }
    setNotice({
      text: `Reminder set for ${displayDate(when)}`,
      undo: () => undoMailChange(before, previousRoute, previousHighlight),
    });
  }
  function changeLabel(label: string) {
    if (labelMode === "navigate") {
      goFolder(label);
      setOverlay(null);
      return;
    }
    motion.prepare("remove");
    const before = targets;
    const previousRoute = route;
    const previousHighlight = highlight;
    const destination = ["Inbox", "Done", "Trash", "Spam"].includes(label);
    const remove =
      labelMode === "toggle" && targets.every((m) => m.labels.includes(label));
    setMail((all) =>
      all.map((m) =>
        targetIds.includes(m.id)
          ? {
              ...(labelMode === "move"
                ? moveMail(m, destination ? label : "Done")
                : m),
              labels:
                labelMode === "move" && destination
                  ? m.labels
                  : remove
                    ? m.labels.filter((l) => l !== label)
                    : [...new Set([...m.labels, label])],
            }
          : m,
      ),
    );
    setNotice({
      text:
        labelMode === "move"
          ? `Moved to ${label}`
          : remove
            ? `Removed ${label}`
            : `Added ${label}`,
      undo: () => undoMailChange(before, previousRoute, previousHighlight),
    });
    if (labelMode === "move") {
      setSelected([]);
      setOverlay(null);
      if (currentMail) goBack();
    }
  }
  function removeLabels(all = false, delta = 0) {
    if (!all && !customLabels.includes(route.folder)) {
      if (route.folder === "Inbox") applyAction("done");
      else if (route.folder === "Starred") applyAction("star");
      return;
    }
    const before = targets;
    const previousRoute = route;
    const previousHighlight = highlight;
    const next =
      delta && currentMail
        ? visibleMail[
            visibleMail.findIndex((m) => m.id === currentMail.id) + delta
          ]
        : undefined;
    motion.prepare("remove");
    setMail((items) =>
      items.map((m) =>
        targetIds.includes(m.id)
          ? {
              ...m,
              labels: all
                ? []
                : m.labels.filter((label) => label !== route.folder),
            }
          : m,
      ),
    );
    setSelected([]);
    if (currentMail && !all) {
      if (next) openMail(next);
      else goBack();
    }
    setNotice({
      text: all ? "Removed all labels" : `Removed ${route.folder}`,
      undo: () => undoMailChange(before, previousRoute, previousHighlight),
    });
  }
  function editLabel(name: string) {
    closeNavigation();
    setOverlay(null);
    setLabelEdit({ name, value: name, deleting: false });
  }
  function saveLabel() {
    if (!labelEdit) return;
    const { name, deleting } = labelEdit,
      value = labelEdit.value.trim();
    if (
      !deleting &&
      (!value ||
        customLabels.some(
          (l) => l !== name && l.toLowerCase() === value.toLowerCase(),
        ))
    ) {
      setNotice({ text: "Choose a unique label name." });
      return;
    }
    setCustomLabels((labels) =>
      deleting
        ? labels.filter((l) => l !== name)
        : labels.map((l) => (l === name ? value : l)),
    );
    setMail((all) =>
      all.map((m) =>
        m.labels.includes(name)
          ? {
              ...m,
              labels: deleting
                ? m.labels.filter((l) => l !== name)
                : m.labels.map((l) => (l === name ? value : l)),
            }
          : m,
      ),
    );
    if (route.folder === name) goFolder(deleting ? "Inbox" : value);
    setLabelEdit(null);
    setNotice({ text: deleting ? "Label deleted" : "Label renamed" });
  }
  function navigateThread(delta: number) {
    const index = visibleMail.findIndex((m) => m.id === currentMail?.id);
    const next = visibleMail[index + delta];
    if (next) {
      setHighlight(index + delta);
      openMail(next);
    }
  }
  const commandDraft = drafts.find((draft) => draft.id === commandDraftId);
  const commandItems: CommandItem[] = [
    ...(commandDraft
      ? [
          {
            label: "Discard Draft",
            detail: "Discard this unsent draft",
            key: "⌘ Shift ,",
            icon: "Trash",
            run: () => {
              if (discardDraft(commandDraft.id)) setOverlay(null);
            },
          },
        ]
      : []),
    {
      label: "Mark Done",
      detail: "Move this conversation out of your inbox",
      key: "E",
      icon: "Check",
      run: () => applyAction("done"),
    },
    {
      label: "Remind Me",
      detail: "Bring this conversation back later",
      key: "H",
      icon: "Clock",
      run: () => openOverlay("remind"),
    },
    {
      label: "Star",
      detail: "Keep this conversation close",
      key: "S",
      icon: "Star",
      run: () => applyAction("star"),
    },
    {
      label: "Mark Unread",
      detail: "Change the read status",
      key: "U",
      icon: "Envelope",
      run: () => applyAction("unread"),
    },
    {
      label: "Move to Trash",
      detail: "Move this conversation to Trash",
      key: "#",
      icon: "Trash",
      run: () => applyAction("trash"),
    },
    {
      label: "Label",
      detail: "Organize your conversations",
      key: "L",
      icon: "Label",
      run: () => openOverlay("label"),
    },
    {
      label: "Compose",
      detail: "Write a new message",
      key: "C",
      icon: "PencilSquircle",
      run: () => {
        setOverlay(null);
        newDraft();
      },
    },
    {
      label: "Search",
      detail: "Find anything in your mailbox",
      key: "/",
      icon: "Search",
      run: () => {
        setOverlay(null);
        startSearch();
      },
    },
    {
      label: "Reply",
      detail: "Reply to this message",
      key: "R",
      icon: "Reply",
      run: () => {
        setOverlay(null);
        if (currentMail) composeReply("reply");
        else if (targets[0]) openMail(targets[0]);
      },
    },
    {
      label: "Forward",
      detail: "Forward this conversation",
      key: "F",
      icon: "Forward",
      run: () => {
        setOverlay(null);
        if (currentMail) composeReply("forward");
        else if (targets[0]) openMail(targets[0]);
      },
    },
    {
      label: "Move to Inbox",
      detail: "Return this conversation to your inbox",
      key: "Shift E",
      icon: "Inbox",
      run: () => applyAction("inbox"),
    },
    {
      label: "Report Spam",
      detail: "Move to Spam",
      key: "!",
      icon: "Shield",
      run: () => applyAction("spam"),
    },
    ...folders.map(([label, key, icon]) => ({
      label: `Go to ${label}`,
      detail: `Open ${label}`,
      key: key ? `G then ${key.toUpperCase()}` : "",
      icon,
      run: () => {
        setOverlay(null);
        goFolder(label);
      },
    })),
    {
      label: "Settings",
      detail: "Customize Superlocal",
      key: ",",
      icon: "Gear",
      run: () => openSettings(),
    },
    {
      label: "Theme",
      detail: "Change appearance and style",
      key: "",
      icon: "Gear",
      run: () => openSettings("Theme"),
    },
    {
      label: "Split Inbox",
      detail: "Manage your inbox splits",
      key: "",
      icon: "Inbox",
      run: () => openSettings("Split Inbox"),
    },
    {
      label: "Signatures",
      detail: "Manage your email signature",
      key: "",
      icon: "PencilSquircle",
      run: () => openSettings("Signatures"),
    },
    {
      label: "Switch Account",
      detail: "Open another mailbox",
      key: "Control 1–9",
      icon: "User",
      run: () => openOverlay("accounts"),
    },
    {
      label: "Snippets",
      detail: "Write faster with saved snippets",
      key: "G ;",
      icon: "Snippet",
      run: () => {
        setOverlay(null);
        navigate({ view: "snippets", thread: undefined, draft: undefined });
      },
    },
    {
      label: "Keyboard Shortcuts",
      detail: "View keyboard shortcuts",
      key: "",
      icon: "Keyboard",
      run: () => openOverlay("shortcuts"),
    },
    {
      label: "Issue",
      detail: "Capture this page and describe a problem",
      key: "",
      icon: "PencilSquircle",
      run: () => {
        void reportIssue();
      },
    },
    {
      label: "Saved issues",
      detail: "Open locally saved issue reports",
      key: "",
      icon: "LinesThree",
      run: () => {
        setOverlay(null);
        setIssueReporter({ draft: null });
      },
    },
  ];
  function selectAccount(account: string) {
    motion.prepare("switch");
    setMailFilter(null);
    listScroll.current = 0;
    if (list.current) list.current.scrollTop = 0;
    setOverlay(null);
    navigate({
      account,
      folder: "Inbox",
      split: "Important",
      thread: undefined,
      draft: undefined,
      view: undefined,
    });
    setHighlight(0);
    setSelected([]);
    setSearch(false);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    const editing = target?.closest(
      "input,textarea,[contenteditable=true],select",
    );
    const intent = resolveMailShortcut(e, {
      mode:
        target?.closest(".compose-view") ||
        (route.draft && !currentDraft?.popOut)
          ? "composer"
          : route.view
            ? "auxiliary"
            : currentMail
              ? "reader"
              : "list",
      editing: !!editing,
      richText: !!editing?.hasAttribute("contenteditable"),
      interactive: !!target?.closest("button,a"),
      modal: !!document.querySelector("[aria-modal=true]"),
      navigation,
      settings,
      floatingDraft: !!currentDraft?.popOut,
      isDrafts,
      accountDialog: overlay === "accounts",
      sequence:
        sequence.current.key === "g" &&
        Date.now() - sequence.current.time < 1500,
      search,
      hasHighlightedMail: !!visibleMail[highlight],
    });
    if (!intent) return;
    if (intent.clearSequence) sequence.current.key = "";
    if (intent.type === "account") {
      const account = accountOptions[intent.index];
      if (account) {
        e.preventDefault();
        selectAccount(account);
      }
      return;
    }
    if (intent.type === "sequence") {
      sequence.current = {
        key: intent.phase === "start" ? "g" : "",
        time: Date.now(),
      };
      return;
    }
    if (!["escape", "toggleSelection", "undo"].includes(intent.type))
      e.preventDefault();
    switch (intent.type) {
      case "command":
        openOverlay("command");
        break;
      case "escape":
        if (overlay) setOverlay(null);
        else if (navigation) closeNavigation();
        else if (settings) {
          setSettings(false);
          setMobileSidebar(false);
        } else if (route.thread || route.draft || route.view) goBack();
        else if (search) {
          if (searchSubmitted && !searchFocused) {
            searchInput.current?.focus();
            searchInput.current?.select();
          } else closeSearch();
        } else if (selected.length) setSelected([]);
        break;
      case "toggleFocus":
        toggleComposeFocus();
        break;
      case "calendar":
        setCalendarInitialView(intent.view);
        navigate({ view: "calendar", thread: undefined, draft: undefined });
        break;
      case "copyLink":
        void navigator.clipboard.writeText(location.href).then(
          () => setNotice({ text: "Private link copied" }),
          () => setNotice({ text: "Could not copy the link" }),
        );
        break;
      case "selectAll":
        setSelected(
          visibleMail
            .slice(intent.fromHere ? highlight : 0)
            .map((mail) => mail.id),
        );
        break;
      case "jump":
        setHighlight(intent.edge === "top" ? 0 : Math.max(0, rowCount - 1));
        break;
      case "drawerNavigate": {
        const buttons = [
          ...document.querySelectorAll<HTMLButtonElement>(
            ".folder-panel button",
          ),
        ].filter((button) => button.offsetParent !== null);
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        buttons[
          Math.max(0, Math.min(buttons.length - 1, index + intent.delta))
        ]?.focus();
        break;
      }
      case "drawerActivate":
        if (
          document.activeElement instanceof HTMLButtonElement &&
          document.activeElement.closest(".folder-panel")
        )
          document.activeElement.click();
        else closeNavigation();
        break;
      case "goFolder":
        goFolder(intent.folder, intent.split);
        break;
      case "labelMode":
        openOverlay("label");
        setLabelMode(intent.mode);
        break;
      case "compose":
        newDraft("", "", intent.popOut);
        break;
      case "search":
        startSearch();
        break;
      case "settings":
        openSettings();
        break;
      case "split": {
        const index = shownSplits.indexOf(route.split);
        goFolder(
          "Inbox",
          shownSplits[
            (index + intent.delta + shownSplits.length) % shownSplits.length
          ],
        );
        break;
      }
      case "openDrawer":
        setNavigation(true);
        break;
      case "openConversation":
        if (intent.drafts && accountDrafts[highlight])
          navigate({ draft: accountDrafts[highlight].id });
        else if (visibleMail[highlight]) openMail(visibleMail[highlight]);
        break;
      case "page": {
        const delta =
          Math.max(
            1,
            Math.floor((list.current?.clientHeight || 600) / rowHeight),
          ) * intent.delta;
        setHighlight((value) =>
          Math.max(0, Math.min(rowCount - 1, value + delta)),
        );
        break;
      }
      case "filter":
        motion.prepare("switch");
        setMailFilter((value) => (value === intent.name ? null : intent.name));
        setHighlight(0);
        listScroll.current = 0;
        if (list.current) list.current.scrollTop = 0;
        break;
      case "navigateConversation":
        if (currentMail) navigateThread(intent.delta);
        else
          setHighlight((value) =>
            Math.max(0, Math.min(rowCount - 1, value + intent.delta)),
          );
        break;
      case "reply":
        composeReply(intent.mode, intent.popOut);
        break;
      case "toggleSelection": {
        const id = visibleMail[highlight]?.id;
        if (id)
          setSelected((items) =>
            items.includes(id)
              ? items.filter((item) => item !== id)
              : [...items, id],
          );
        break;
      }
      case "removeLabels":
        removeLabels(intent.all, intent.delta);
        break;
      case "triage":
        applyAction(intent.action);
        break;
      case "undo":
        if (notice?.undo) {
          notice.undo();
          setNotice(null);
        }
        break;
      default: {
        const unhandled: never = intent;
        throw new Error(`Unhandled mail shortcut: ${unhandled}`);
      }
    }
  });
  useEffect(() => {
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const composer = currentDraft && (
    <Composer
      draft={currentDraft}
      preferences={preferences}
      onChange={updateDraft}
      onSend={sendDraft}
      onDiscard={() => discardDraft()}
      onClose={goBack}
      onSearch={() => startSearch(currentDraft.id)}
      onToggleFocus={toggleComposeFocus}
      availabilityRequest={availabilityRequest}
      onNavigate={(delta) => {
        if (isDrafts) {
          const index = accountDrafts.findIndex(
            (d) => d.id === currentDraft.id,
          );
          const next = accountDrafts[index + delta];
          if (next) navigate({ draft: next.id });
        } else {
          const next =
            visibleMail[
              Math.max(0, Math.min(visibleMail.length - 1, highlight + delta))
            ];
          if (next) openMail(next);
        }
      }}
    />
  );

  return (
    <div
      className={`app ${navigation ? "navigation-open" : ""} ${settings ? "settings-open" : ""} ${mobileSidebar ? "mobile-sidebar-open" : ""} ${route.view === "calendar" || route.view === "snippets" ? "auxiliary-view" : ""}`}
    >
      <nav className="app-rail" aria-label="Apps">
        <IconButton
          name="Bolt"
          title="Superlocal Command (⌘K)"
          className="rail-command"
          onClick={() => openOverlay("command")}
        />
        <div className="app-switcher">
          <IconButton
            name="Envelope"
            title="Mail"
            className={route.view !== "calendar" ? "active" : ""}
            onClick={() => goFolder("Inbox")}
          />
          <IconButton
            name="Calendar"
            title="Calendar"
            className={route.view === "calendar" ? "active" : ""}
            onClick={() =>
              navigate({
                view: "calendar",
                thread: undefined,
                draft: undefined,
              })
            }
          />
        </div>
        <div className="rail-mobile-actions">
          <IconButton
            name="Gear"
            title="Settings"
            onClick={() => openSettings()}
          />
          <IconButton
            name="Eye"
            title="Recent Opens"
            onClick={() => {
              setSettings(false);
              setMobileSidebar(true);
            }}
          />
        </div>
      </nav>
      <main className="mail-workspace" data-folder={route.folder}>
        {route.view === "calendar" ? (
          <CalendarView
            initialView={calendarInitialView}
            onBack={goBack}
            account={route.account}
            preferences={preferences}
            onOpenSettings={() => openSettings()}
            onShareAvailability={() => newDraft("", "", false, true)}
          />
        ) : route.view === "snippets" ? (
          <Snippets
            onBack={goBack}
            onCompose={newDraft}
            onOpenFolders={() => setNavigation(true)}
            onOpenSettings={() => openSettings()}
          />
        ) : route.draft && currentDraft && !currentDraft.popOut ? (
          composer
        ) : currentMail ? (
          <ThreadView
            key={currentMail.id}
            mail={currentMail}
            draft={currentDraft}
            account={route.account}
            preferences={preferences}
            onBack={goBack}
            onNavigate={navigateThread}
            onAction={applyAction}
            onCompose={composeReply}
            replyRequest={replyRequest}
            onDraftChange={updateDraft}
            onSend={sendDraft}
            onDiscard={() => discardDraft()}
            onSearch={() => currentDraft && startSearch(currentDraft.id)}
            onToggleFocus={toggleComposeFocus}
            onOpenProfile={() => {
              setProfile(true);
              setMobileSidebar(true);
            }}
          />
        ) : (
          <>
            <header className={`mail-header ${search ? "searching" : ""}`}>
              {!search && (
                <IconButton
                  name="LinesThree"
                  title="Switch folders"
                  className="folder-switch"
                  onClick={() => setNavigation(!navigation)}
                />
              )}
              {search ? (
                <div className="search-field">
                  <input
                    ref={searchInput}
                    aria-label="Search mail"
                    placeholder="Search"
                    value={query}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    onChange={(e) => {
                      changeSearchQuery(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && query.trim()) {
                        motion.prepare("return");
                        setSearchSubmitted(true);
                        setSearchHistory((h) =>
                          [query, ...h.filter((s) => s !== query)].slice(0, 8),
                        );
                        e.currentTarget.blur();
                      }
                    }}
                  />
                  {query && (
                    <IconButton
                      name="Close"
                      title="Clear search"
                      onClick={() => {
                        setQuery("");
                        searchInput.current?.focus();
                      }}
                    />
                  )}
                  <IconButton
                    name="ChevronDown"
                    title="Search tips"
                    onClick={() => openOverlay("searchTips")}
                  />
                </div>
              ) : selected.length ? (
                <div className="selection-toolbar">
                  <button
                    onClick={() =>
                      setSelected(
                        selected.length === visibleMail.length
                          ? []
                          : visibleMail.map((m) => m.id),
                      )
                    }
                  >
                    <span className="select-square checked">
                      <Icon name="Check" size={11} />
                    </span>
                    <span>{selected.length} selected</span>
                    <Icon name="ChevronDown" size={13} />
                  </button>
                  {[
                    ["Check", "Mark Done", "done"],
                    ["Clock", "Remind Me", "remind"],
                    ["Star", "Star", "star"],
                    ["Envelope", "Mark Unread", "unread"],
                    ["Label", "Label", "label"],
                    ["Trash", "Trash", "trash"],
                  ].map(([icon, title, action]) => (
                    <IconButton
                      key={action}
                      name={icon}
                      title={title}
                      onClick={() => applyAction(action)}
                    />
                  ))}
                </div>
              ) : route.folder === "Inbox" ? (
                <div
                  className="split-tabs"
                  role="tablist"
                  aria-label="Split Inbox"
                >
                  {shownSplits.map((split) => (
                    <button
                      key={split}
                      role="tab"
                      aria-selected={route.split === split}
                      className={route.split === split ? "active" : ""}
                      onClick={() => goFolder("Inbox", split)}
                    >
                      <span className="split-tab-label">{split}</span>
                      <span className="split-tab-count">
                        {splitCounts[split] || ""}
                      </span>
                    </button>
                  ))}
                  <IconButton
                    name="Gear"
                    title="Split Inbox Settings"
                    className="split-settings"
                    onClick={() => openSettings("Split Inbox")}
                  />
                </div>
              ) : (
                <h1 className="folder-title">{route.folder}</h1>
              )}
              {!selected.length && (
                <div className="header-actions">
                  {mailFilter && (
                    <button
                      className="mail-filter"
                      onClick={() => {
                        motion.prepare("switch");
                        setMailFilter(null);
                      }}
                      aria-label={`Clear ${mailFilter} filter`}
                    >
                      {mailFilter}
                      <Icon name="Close" size={12} />
                    </button>
                  )}
                  {search ? (
                    <IconButton
                      name="Close"
                      title="Close search"
                      onClick={closeSearch}
                    />
                  ) : (
                    <>
                      <IconButton
                        name="PencilSquircle"
                        title="Compose (C)"
                        onClick={() => newDraft()}
                      />
                      <IconButton
                        name="Search"
                        title="Search (/)"
                        onClick={() => startSearch()}
                      />
                    </>
                  )}
                </div>
              )}
            </header>
            <div
              className="mail-list animated-mail-list"
              ref={list}
              role="table"
              tabIndex={-1}
              aria-rowcount={rowCount}
              onMouseDown={handleMailRow}
              onClick={handleMailRow}
              onContextMenu={handleMailRow}
              onScroll={(event) => {
                listScroll.current = event.currentTarget.scrollTop;
              }}
              aria-label={
                search
                  ? "Search results"
                  : `${route.folder === "Inbox" ? route.split : route.folder} conversations`
              }
            >
              {search && (!query || !searchSubmitted) ? (
                <div className="search-start">
                  <div className="search-contacts">
                    {contacts
                      .filter(
                        (contact) =>
                          !query ||
                          `${contact.name} ${contact.email}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      )
                      .slice(0, 4)
                      .map((contact) => (
                        <button
                          key={contact.email}
                          onClick={() =>
                            changeSearchQuery(`from:${contact.email}`, true)
                          }
                        >
                          <span>{contact.name}</span>
                          <span>{contact.email}</span>
                        </button>
                      ))}
                  </div>
                  <div className="search-terms">
                    {(searchHistory.length
                      ? searchHistory
                      : [
                          "fernway",
                          "project",
                          "design",
                          "github",
                          "kiln",
                          "saved reads",
                          "studio",
                          "preview",
                        ]
                    ).map((s) => (
                      <button
                        key={s}
                        onClick={() => changeSearchQuery(s, true)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : isDrafts ? (
                accountDrafts.map((draft, i) => (
                  <div
                    key={draft.id}
                    data-motion-id={draft.id}
                    role="row"
                    className={`mail-row draft-row ${highlight === i ? "highlighted" : ""}`}
                    data-highlighted={highlight === i}
                    onClick={() => {
                      setHighlight(i);
                      navigate({ draft: draft.id, thread: undefined });
                    }}
                  >
                    <span className="row-from">
                      <span className="draft-tag">Draft</span>
                      {draft.to || "(no recipients)"}
                    </span>
                    <span className="row-content">
                      <span className="row-subject">
                        {draft.subject || "(no subject)"}
                      </span>
                      <span className="row-snippet">
                        {plainText(draft.body)}
                      </span>
                    </span>
                    <time>Draft</time>
                  </div>
                ))
              ) : (
                <MailRows
                  entries={entries}
                  totalHeight={totalHeight}
                  rowHeight={rowHeight}
                  virtualized={virtualized}
                  highlight={highlight}
                  selected={selected}
                  sent={route.folder === "Sent"}
                  showSnippets={preferences.showSnippets}
                  container={list}
                  scrollPosition={listScroll}
                  onWindowCommit={motion.refreshHighlight}
                />
              )}
              {rowCount === 0 &&
                !motion.hasExits &&
                !(search && (!query || !searchSubmitted)) && (
                  <div
                    className={`empty-mailbox ${route.folder === "Inbox" ? "inbox-zero" : ""}`}
                  >
                    {route.folder === "Inbox" && (
                      <Icon name="Check" size={34} />
                    )}
                    {(search || route.folder !== "Inbox") && (
                      <h2>
                        {search ? "No results" : "No conversations found here."}
                      </h2>
                    )}
                    <p>
                      {search
                        ? "Try another search or check your spelling."
                        : route.folder === "Inbox"
                          ? "You are all done."
                          : ""}
                    </p>
                    {route.folder === "Inbox" && (
                      <button
                        className="primary-button"
                        onClick={() => newDraft()}
                      >
                        New Message
                      </button>
                    )}
                  </div>
                )}
              {motion.layers}
            </div>
          </>
        )}
        {route.draft && currentDraft?.popOut && composer}
      </main>
      <aside
        className="right-sidebar"
        aria-label={
          settings
            ? "Settings"
            : currentMail || route.draft
              ? "Contact details"
              : "Recent Opens"
        }
      >
        <IconButton
          className="mobile-sidebar-close"
          name="Close"
          title="Close sidebar"
          onClick={() => setMobileSidebar(false)}
        />
        <span className="notification-count">4</span>
        <div
          className="sidebar-content"
          onClick={(event) => {
            if (!(event.target instanceof Element)) return;
            const id = event.target.closest<HTMLElement>(
              "[data-recent-mail-id]",
            )?.dataset.recentMailId;
            const message = id && recent.find((message) => message.id === id);
            if (message) openMail(message);
          }}
        >
          {settings ? (
            <Settings
              key={settingsPage || "root"}
              preferences={preferences}
              onChange={updatePreferences}
              onClose={() => {
                setSettings(false);
                setMobileSidebar(false);
              }}
              onOpenShortcuts={() => openOverlay("shortcuts")}
              initialPage={settingsPage}
              account={route.account}
            />
          ) : search && !currentMail ? (
            <section className="search-sidebar">
              <h2>Tips</h2>
              <div>
                {searchTips.map(([value, description]) => (
                  <button key={value} onClick={() => setQuery(value)}>
                    <span>{value}</span>
                    <span>{description}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : currentMail || route.draft || profile ? (
            <div className="contact-panel">
              <h2>
                {route.draft || currentMail?.folder === "Sent"
                  ? userProfile.name
                  : currentMail?.from || userProfile.name}
              </h2>
              <div className="contact-identity">
                <div className="contact-avatar">
                  <Icon name="User" size={45} />
                  <span>
                    <Icon name="Envelope" size={12} />
                  </span>
                </div>
                <div>
                  <b>
                    {route.draft
                      ? route.account
                      : currentMail?.email || route.account}
                  </b>
                  <p>{route.draft ? userProfile.location : ""}</p>
                </div>
              </div>
              {route.draft ? (
                <>
                  <button
                    className="primary-button"
                    onClick={() => openOverlay("profile")}
                  >
                    Edit Profile
                  </button>
                  <p className="contact-bio">{userProfile.bio}</p>
                  <button
                    className="contact-link"
                    onClick={() =>
                      window.open(
                        `https://${userProfile.website}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <Icon name="Link" />
                    {userProfile.website}
                  </button>
                  <button
                    className="contact-link"
                    onClick={() =>
                      window.open(
                        "https://orchard.example.org",
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <Icon name="Link" />
                    orchard.example.org
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="contact-link"
                    onClick={() => {
                      newDraft();
                      setDrafts((all) => {
                        const d = all.at(-1);
                        return d
                          ? all.map((v) =>
                              v.id === d.id
                                ? { ...v, to: currentMail?.email || "" }
                                : v,
                            )
                          : all;
                      });
                    }}
                  >
                    <Icon name="Envelope" />
                    Compose email
                  </button>
                  <h3>Recent conversations</h3>
                  {accountMail
                    .filter((m) => m.email === currentMail?.email)
                    .slice(0, 5)
                    .map((m) => (
                      <button
                        key={m.id}
                        className="related-mail"
                        onClick={() => openMail(m)}
                      >
                        {m.subject}
                        <span>{m.date}</span>
                      </button>
                    ))}
                  {currentMail?.opened && (
                    <div className="contact-read-status">
                      <Icon name="Eye" />
                      Last opened {currentMail.opened}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : preferences.recentOpens ? (
            <RecentOpens mail={recent} />
          ) : (
            <div className="sidebar-calendar">
              <h2>September 2026</h2>
              <div className="mini-calendar">
                {"SMTWTFS".split("").map((d, i) => (
                  <span key={`day-${i}`} className="day-name">
                    {d}
                  </span>
                ))}
                {Array.from({ length: 35 }, (_, i) => (
                  <button
                    className={i === 2 ? "today" : ""}
                    key={i}
                    onClick={() => navigate({ view: "calendar" })}
                  >
                    {i < 2 ? 30 + i : i < 32 ? i - 1 : i - 31}
                  </button>
                ))}
              </div>
              <p>No more events today</p>
              <button
                className="text-button"
                onClick={() => navigate({ view: "calendar" })}
              >
                Open calendar
              </button>
            </div>
          )}
        </div>
        <footer className="sidebar-footer">
          <div>
            <IconButton
              name="QuestionSquircle"
              title="Help"
              onClick={() => openOverlay("help")}
            />
            <IconButton
              name="Calendar"
              title="Calendar"
              onClick={() =>
                navigate({
                  view: "calendar",
                  thread: undefined,
                  draft: undefined,
                })
              }
            />
            <IconButton
              name="Gear"
              title="Settings"
              className={settings ? "active" : ""}
              onClick={() => (settings ? setSettings(false) : openSettings())}
            />
          </div>
        </footer>
      </aside>
      <FolderNavigation
        open={navigation}
        account={route.account}
        folder={route.folder}
        inboxCount={inboxCount}
        labels={customLabels}
        onClose={() => closeNavigation()}
        onAccounts={() => openOverlay("accounts")}
        onFolder={goFolder}
        onSnippets={() =>
          navigate({ view: "snippets", thread: undefined, draft: undefined })
        }
        onCreateLabel={() => {
          openOverlay("label");
        }}
        onEditLabel={editLabel}
      />
      <MailCommandDialog
        mode={commandMode ?? "command"}
        open={commandMode !== null}
        onClose={() => setOverlay(null)}
        commands={commandItems}
        labels={customLabels}
        labelMode={labelMode}
        targets={targets}
        onLabel={changeLabel}
        onCreateLabel={(label) => {
          setCustomLabels((labels) => [...labels, label]);
          changeLabel(label);
        }}
        onRemind={remind}
        accounts={accountOptions}
        currentAccount={route.account}
        onAccount={selectAccount}
        onSettings={openSettings}
      />
      {capturingIssue && (
        <div data-issue-ui className="issue-capture-status" role="status">
          Capturing screenshot…
        </div>
      )}
      {issueReporter && (
        <IssueReporter
          draft={issueReporter.draft}
          onClose={() => setIssueReporter(null)}
          onSaved={() => {
            setIssueReporter(null);
            setNotice({ text: "Issue saved locally" });
          }}
        />
      )}
      {overlay && !commandMode && (
        <Modal
          label={overlay}
          onClose={() => setOverlay(null)}
          className={`app-modal ${overlay === "shortcuts" ? "shortcuts-modal" : ""}`}
        >
          <>
            <div className="simple-modal-header">
              <h2>
                {
                  (
                    {
                      shortcuts: "Keyboard Shortcuts",
                      help: "Help",
                      profile: "Edit Profile",
                      searchTips: "Search",
                    } as Record<string, string>
                  )[overlay]
                }
              </h2>
              <IconButton
                name="Close"
                title="Close"
                onClick={() => setOverlay(null)}
              />
            </div>
            {overlay === "shortcuts" && (
              <div className="shortcuts-content">
                {shortcutGroups.map(([name, rows]) => (
                  <section key={name}>
                    <h3>{name}</h3>
                    {rows.map(([label, key]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <Key>{key}</Key>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )}
            {overlay === "help" && (
              <div className="help-options">
                <button onClick={() => openOverlay("shortcuts")}>
                  <Icon name="Keyboard" />
                  Keyboard Shortcuts
                  <Icon name="ChevronRight" />
                </button>
                <button onClick={() => openOverlay("searchTips")}>
                  <Icon name="Search" />
                  Search tips
                  <Icon name="ChevronRight" />
                </button>
                <button onClick={() => openSettings()}>
                  <Icon name="Gear" />
                  Settings
                  <Icon name="ChevronRight" />
                </button>
              </div>
            )}
            {overlay === "profile" && (
              <form
                className="simple-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setOverlay(null);
                  setNotice({ text: "Profile updated" });
                }}
              >
                {(["name", "location", "bio", "website"] as const).map(
                  (field) => (
                    <label key={field}>
                      {
                        {
                          name: "Name",
                          location: "Location",
                          bio: "About",
                          website: "Website",
                        }[field]
                      }
                      {field === "bio" ? (
                        <textarea
                          value={userProfile[field]}
                          onChange={(e) =>
                            setUserProfile((v) => ({
                              ...v,
                              [field]: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <input
                          value={userProfile[field]}
                          onChange={(e) =>
                            setUserProfile((v) => ({
                              ...v,
                              [field]: e.target.value,
                            }))
                          }
                        />
                      )}
                    </label>
                  ),
                )}
                <button type="submit" className="primary-button">
                  Save
                </button>
              </form>
            )}
            {overlay === "searchTips" && (
              <div className="search-tips">
                {[
                  ["from:alex", "From a person"],
                  ["to:jamie", "Sent to a person"],
                  ["subject:project", "Words in the subject"],
                  ["is:unread", "Unread messages"],
                  ["is:starred", "Starred conversations"],
                  ["has:attachment", "Messages with files"],
                  ["in:sent", "A specific mailbox"],
                  ["label:Projects", "Messages with a label"],
                ].map(([value, description]) => (
                  <button
                    key={value}
                    onClick={() => {
                      setOverlay(null);
                      goBack();
                      setSearch(true);
                      setQuery(value);
                    }}
                  >
                    <code>{value}</code>
                    <span>{description}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        </Modal>
      )}
      {labelEdit && (
        <Modal
          label={labelEdit.deleting ? "Delete label" : "Rename label"}
          onClose={() => setLabelEdit(null)}
          className="app-modal"
        >
          <div className="simple-modal-header">
            <h2>{labelEdit.deleting ? "Delete label?" : "Rename label"}</h2>
            <IconButton
              name="Close"
              title="Close label settings"
              onClick={() => setLabelEdit(null)}
            />
          </div>
          <form
            className="simple-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveLabel();
            }}
          >
            {labelEdit.deleting ? (
              <p>
                Delete "{labelEdit.name}"? Messages with this label will not be
                deleted.
              </p>
            ) : (
              <label>
                Label name
                <input
                  autoFocus
                  value={labelEdit.value}
                  onChange={(e) =>
                    setLabelEdit({ ...labelEdit, value: e.target.value })
                  }
                />
              </label>
            )}
            <div className="label-edit-actions">
              <button className="primary-button" type="submit">
                {labelEdit.deleting ? "Delete label" : "Save"}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setLabelEdit(null)}
              >
                Cancel
              </button>
              {!labelEdit.deleting && (
                <button
                  type="button"
                  className="label-delete"
                  onClick={() => setLabelEdit({ ...labelEdit, deleting: true })}
                >
                  Delete label
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
      {notice && (
        <div
          className={`toast ${noticeFading ? "is-fading" : ""}`}
          role="status"
          onMouseEnter={() => setNoticeHovered(true)}
          onMouseLeave={() => setNoticeHovered(false)}
        >
          <span className="toast-status">{notice.text}</span>
          {notice.undo && (
            <button
              className="toast-undo"
              onClick={() => {
                notice.undo?.();
                setNotice(null);
              }}
            >
              Undo
            </button>
          )}
          <IconButton
            name="Notification-closeIcon"
            title="Dismiss notification"
            size={10}
            className="toast-close"
            onClick={() => setNotice(null)}
          />
        </div>
      )}
    </div>
  );
}
