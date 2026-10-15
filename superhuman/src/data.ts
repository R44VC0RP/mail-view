export { readSaved as loadSaved } from "./storage.ts";

export type Attachment = {
  name: string;
  size: number;
  type: string;
  data?: string;
};
export type Message = {
  id: string;
  from: string;
  email: string;
  to: string;
  cc?: string;
  bcc?: string;
  date: string;
  body: string;
  attachments?: Attachment[];
  scheduledAt?: string;
  cancelled?: boolean;
};
export type Mail = {
  id: string;
  account: string;
  from: string;
  email: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  group: string;
  split: string;
  folder: string;
  unread: boolean;
  starred: boolean;
  labels: string[];
  messages: Message[];
  opened?: string;
  muted?: boolean;
  reminder?: string;
  scheduled?: string;
  reminderAt?: number;
  receivedAt?: number;
};
export type Draft = {
  id: string;
  account: string;
  mode: "new" | "reply" | "replyAll" | "forward";
  threadId?: string;
  popOut?: boolean;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments: Attachment[];
  updated: number;
};
export type SendOptions = { instant?: boolean; markDone?: boolean };
export type Preferences = {
  theme: string;
  density: string;
  font: string;
  fontSize: string;
  defaultReply: string;
  sendDelay: string;
  readReceipts: boolean;
  desktopNotifications: boolean;
  notificationSound: boolean;
  showSnippets: boolean;
  recentOpens: boolean;
  signature: string;
  signatureEnabled: boolean;
  autoAdvance: boolean;
  markRead: boolean;
  spellcheck: boolean;
  splits: string[];
  startWeek: string;
  timeFormat: string;
  timezone: string;
  [key: string]: unknown;
};

export const accounts = ["avery@example.com", "avery.work@example.com"];
export const folders = [
  ["Inbox", "i", "Inbox"],
  ["Starred", "s", "Star"],
  ["Drafts", "d", "PencilSquircle"],
  ["Sent", "t", "Send"],
  ["Done", "e", "Check"],
  ["Auto Archived", "", "Check"],
  ["Scheduled", "", "Send"],
  ["Reminders", "h", "Clock"],
  ["Muted", "m", "Envelope"],
  ["Snippets", ";", "Snippet"],
  ["Spam", "!", "Shield"],
  ["Trash", "#", "Trash"],
  ["All Mail", "a", "Envelope"],
];
export const defaultPreferences: Preferences = {
  theme: "Carbon",
  density: "Comfortable",
  font: "Super Sans",
  fontSize: "Normal",
  defaultReply: "Reply all",
  sendDelay: "10 seconds",
  readReceipts: true,
  desktopNotifications: true,
  notificationSound: false,
  showSnippets: true,
  recentOpens: true,
  signature: "Avery Lane",
  signatureEnabled: false,
  autoAdvance: true,
  markRead: true,
  spellcheck: true,
  splits: ["Important", "Github", "Inbound", "Calendar", "Other"],
  startWeek: "Sunday",
  timeFormat: "12 hour",
  timezone: "America/New_York",
};
export const contacts = [
  { name: "Alex Morgan", email: "alex@example.com" },
  { name: "Jamie Chen", email: "jamie@example.com" },
  { name: "Sam Rivera", email: "sam@example.com" },
  { name: "Taylor Brooks", email: "taylor@example.com" },
  { name: "Avery Lane", email: accounts[0] },
  { name: "Jordan Lee", email: "jordan@example.com" },
  { name: "Fernway", email: "hello@fernway.example.com" },
  { name: "Shelfnote", email: "digest@shelfnote.example.com" },
];
export const recentSeeds = [
  [
    "Juniper Okoye",
    "2 hrs ago",
    "Inquiry: kiln rental for a pottery workshop",
    "",
  ],
  [
    "Saltmarsh Hostel",
    "Wed 4:12 PM",
    "Booking change for your October stay",
    "Last 7 days",
  ],
  ["Quill & Ladle", "Wed 9:30 AM", "Your recipe box is almost full", ""],
  ["Ines Moreau", "Fri Aug 21", "Mural color swatches", "August"],
  ["dara@example.com", "Wed Aug 19", "Spare tent for the lake trip?", ""],
  ["Hollow Oak Print Shop", "Mon Aug 17", "Proof ready: event posters", ""],
  [
    "Pebble Post Returns",
    "Fri Aug 14",
    "Return label for order DEMO-7731",
    "",
  ],
  [
    "hello@seedswap.example.com",
    "Thu Aug 13",
    "Seed swap sign-up confirmed",
    "",
  ],
  [
    "kai@example.com",
    "Tue Aug 11",
    "Quote request | Choir concert recording",
    "",
  ],
  [
    "avery.work@example.com",
    "Tue Aug 11",
    "Quote request | Choir concert recording",
    "",
  ],
  ["Rosalind Ota", "Sat Aug 8", "Sketches for the library zine", ""],
  ["Bram Keller", "Thu Aug 6", "Carpool for Saturday's workshop", ""],
  ["felix@example.com", "Thu Aug 6", "Re: Bike repair night supplies", ""],
  [
    "volunteers@example.org",
    "Tue Aug 4",
    "Shift swap request - Sunday market",
    "",
  ],
  ["Tessa Moon", "Mon Aug 3", "Feedback on the trail map draft", ""],
  ["Arlo Bennett", "Sun Aug 2", "Re: Borrowing the projector", ""],
  ["Lantern Radio", "Sat Aug 1", "Your listener question made the show", ""],
  [
    "avery.work@example.com",
    "Wed Jul 29",
    "Train tickets for the design retreat",
    "July",
  ],
  ["Tessa Moon", "Wed Jul 29", "Trail map draft v2", ""],
  ["noah@example.com", "Mon Jul 27", "Potluck sign-up sheet", ""],
  ["Mira", "Mon Jul 20", "Test from the new printer", ""],
  ["Gus", "Sat Jul 11", "Re: Fence paint colors", ""],
  ["Hana Iwata", "Fri Jul 10", "Thank-you note draft", ""],
  ["Leif Andersen", "Tue Jul 7", "Re: Your quilt pattern question", ""],
];

const message = (
  id: string,
  from: string,
  email: string,
  subject: string,
  body: string,
  date = "8:45 AM",
): Message => ({ id, from, email, to: accounts[0], date, body });
function mail(
  id: string,
  from: string,
  subject: string,
  snippet: string,
  split: string,
  date: string,
  unread = false,
  body?: string,
): Mail {
  const email = `${from.toLowerCase().replace(/[^a-z]/g, "")}@example.com`;
  return {
    id,
    account: accounts[0],
    from,
    email,
    to: accounts[0],
    subject,
    snippet,
    split,
    date,
    group: "Today",
    folder: "Inbox",
    unread,
    starred: false,
    labels: [],
    messages: [
      message(
        `${id}-1`,
        from,
        email,
        subject,
        body ||
          `<p>Hey Avery,</p><p>${snippet}</p><p>Let me know what you think.</p><p>Thanks,<br>${from}</p>`,
        date,
      ),
    ],
  };
}
export function seedMail(): Mail[] {
  const result: Mail[] = [
    mail(
      "fernway-apps",
      "Fernway",
      "Fernway apps are here: watering reminders on every device",
      "Your garden plan now fits in your pocket. Get a gentle nudge on your phone when the tomatoes are thirsty, and keep the full planting map open on your desktop...",
      "Important",
      "8:45 AM",
      true,
      '<h2>Fernway apps are here</h2><p>Hi Avery,</p><p>Your garden plan now fits in your pocket. The new <a href="https://fernway.example.com">phone and desktop apps</a> sync with the planting map you already made.</p><ul><li><strong>Watering nudges</strong> arrive on your phone when the soil sensor or the forecast says it is time.</li><li><strong>Frost alerts</strong> give you an evening warning to cover the seedlings.</li><li><strong>The desktop app</strong> keeps your full planting map open next to your seed catalog.</li></ul><p>Everything you planned on the web is already there when you sign in.</p><p>Happy growing,<br>The Fernway crew</p>',
    ),
    mail(
      "saved-reads",
      "Shelfnote",
      "3 saved reads for your weekend",
      "Hi Avery, here are the articles you saved this week: a gentle guide to bread hydration, fixing a slipping bike chain in ten minutes, and what lives in a tide pool at low tide...",
      "Important",
      "8:01 AM",
      false,
      "<p>Hi Avery,</p><p>You saved <strong>3 articles</strong> this week. Here they are, ready for a slow weekend.</p><blockquote><strong>Bread hydration, gently explained</strong><p>Why a wetter dough gives you a more open crumb, and how to handle it without a mess. 8 min read.</p></blockquote><blockquote><strong>Fix a slipping bike chain in ten minutes</strong><p>A worn chain, a loose derailleur, or a stretched cable: how to tell which one you have. 6 min read.</p></blockquote><blockquote><strong>What lives in a tide pool</strong><p>Anemones, hermit crabs, and the sea stars that hide under ledges at low tide. 11 min read.</p></blockquote><p>Enjoy the reading,<br>Shelfnote</p>",
    ),
    mail(
      "garden-chat",
      "Wren Alvarez",
      "Wren started a thread in Community Garden Volunteers",
      "Community Garden Volunteers Wren: Who can water the herb beds while I'm away next week? I can swap for any Saturday in October. Reply in the thread or join the chat...",
      "Important",
      "7:36 AM",
      true,
      "<p><strong>Community Garden Volunteers</strong></p><p><strong>Wren Alvarez</strong> started a new thread:</p><blockquote><p>Who can water the herb beds while I'm away next week? It takes about twenty minutes in the evening. I can swap for any Saturday in October.</p></blockquote><p>Reply in the thread or open the chat to join in.</p><p>You get these emails because you joined Community Garden Volunteers. Change your notification settings any time.</p>",
    ),
    mail(
      "fernway-digest",
      "Fernway",
      "Elm Street Garden, plot 14: this week's activity",
      "Elm Street Garden This week in plot 14: the first squash flowers opened, rainfall was 0.8 inches, and Wren logged a watering on Tuesday. Next up: thin the carrot rows...",
      "Important",
      "7:08 AM",
      true,
      "<h2>Elm Street Garden &middot; plot 14</h2><p>Here's what happened in your plot this week.</p><ul><li>The first squash flowers opened on Monday.</li><li>Rainfall: 0.8 inches, so only one watering was needed.</li><li>Wren logged that watering on Tuesday evening.</li></ul><p><strong>Next up:</strong> thin the carrot rows and start the fall lettuce seeds.</p><p>Fernway</p>",
    ),
    mail(
      "inbound-kiln",
      "Juniper Okoye",
      "Inquiry: kiln rental for a pottery workshop",
      "Hi Avery, a friend mentioned you sometimes lend out the small test kiln. I'm planning a four-person pottery evening in late September and would love to rent it.",
      "Inbound",
      "Yesterday",
      true,
    ),
    mail(
      "calendar-invite",
      "Ines Moreau",
      "Invitation: Mural planning walk @ Wed Sep 2, 2026 2pm",
      "You have been invited to Mural planning walk. Wednesday, September 2, 2:00 PM - 2:30 PM (Eastern Time)",
      "Calendar",
      "Yesterday",
      true,
      '<div class="meeting-invite"><h2>Mural planning walk</h2><p>Wednesday, September 2, 2026<br>2:00 PM - 2:30 PM (Eastern Time)<br>Elm Street underpass</p><p>Ines Moreau has invited you to a meeting.</p><p>Let\'s walk the wall together, measure the panels, and hold up the color swatches in daylight.</p></div>',
    ),
  ];
  const githubSubjects = [
    "[lanternkit] Improve keyboard navigation (#2841)",
    "[lanternkit] Fix streaming response cleanup (#2839)",
    "[beacon] Add webhook delivery receipts (#182)",
    "[tabpilot] Support persistent sessions (#92)",
    "[lanternkit] Conversation layout refinements (#2836)",
    "[fieldnotes] New pull request review (#12)",
    "[lanternkit] Update the release workflow (#2829)",
  ];
  for (let i = 0; i < 22; i++)
    result.push(
      mail(
        `github-${i}`,
        ["Codeyard", "Sam Rivera", "Jamie Chen", "Taylor Brooks"][i % 4],
        githubSubjects[i % githubSubjects.length],
        [
          "A new commit was pushed to this pull request. Review the changes and join the conversation.",
          "Approved these changes. This looks good to me, thanks for taking care of it!",
          "The workflow run has completed successfully. All checks have passed.",
        ][i % 3],
        "Github",
        i < 6 ? `${10 - i}:24 AM` : "Yesterday",
        i < 15,
      ),
    );
  const otherSenders = [
    "Tracklane",
    "Sketchpad",
    "Shipyard",
    "Pagebook",
    "The Margin",
    "Paywise",
    "Layoutly",
    "Portfolio Club",
    "Inkletter",
    "Lumen Post",
    "Edgeway",
    "Codeyard",
    "Filecrate",
    "Staybird",
    "Moodboard Co.",
    "Appvale",
  ];
  const otherSubjects = [
    "Your weekly digest",
    "A little inspiration for your next project",
    "Your deployment is ready",
    "What's new this month",
    "Five things worth reading",
    "Your receipt is ready",
    "Made for the way you work",
    "A new update from the team",
    "The details that matter",
    "Here's the latest activity",
    "Your project is looking good",
    "An update on your subscription",
    "Files shared with you",
    "Your next adventure starts here",
    "A few things we saved this week",
    "The latest from Appvale",
  ];
  for (let i = 0; i < 480; i++) {
    const m = mail(
      `other-${i}`,
      otherSenders[i % 16],
      otherSubjects[i % 16],
      [
        "Take a look at what happened this week. A collection of ideas, updates, and things we thought you would enjoy.",
        "Hello Avery, here are the latest updates for your workspace. There is something new to explore.",
        "Thanks for being part of the community. Here is everything you need to know.",
      ][i % 3],
      "Other",
      i < 9
        ? `${9 - Math.floor(i / 2)}:${i % 2 ? "18" : "42"} AM`
        : i < 24
          ? "Yesterday"
          : `Aug ${Math.max(1, 31 - Math.floor(i / 16))}`,
      i % 3 !== 0,
    );
    m.group = i < 9 ? "Today" : i < 24 ? "Yesterday" : "Last 7 days";
    result.push(m);
  }
  recentSeeds.forEach(([from, opened, subject, group], i) => {
    const m = mail(
      `sent-${i}`,
      from,
      subject,
      "Thanks for the update! I took a look and everything looks good. Happy to chat more about this whenever you have a chance.",
      "Important",
      opened,
      false,
      `<p>Hey ${from.split(" ")[0]},</p><p>Thanks for the update! I took a look and everything looks good.</p><p>Happy to chat more about this whenever you have a chance. Let me know what works for you.</p><p>Best,<br>Avery</p>`,
    );
    m.folder = "Sent";
    m.opened = opened;
    m.group = group;
    m.to = m.email;
    m.messages[0].from = "Avery Lane";
    m.messages[0].email = accounts[0];
    m.messages[0].to = m.email;
    m.starred = i < 3;
    if (i === 0)
      m.messages.unshift(
        message(
          "beta-original",
          from,
          m.email,
          subject,
          "<p>Hi Avery,</p><p>A friend mentioned you sometimes lend out the small test kiln. I'm planning a four-person pottery evening in late September and would love to rent it for one firing.</p><p>Would that be possible, and what would you need from me?</p><p>Thanks!<br>Juniper</p>",
          "Yesterday",
        ),
      );
    result.push(m);
  });
  for (const [i, folder] of [
    "Done",
    "Done",
    "Done",
    "Reminders",
    "Reminders",
    "Spam",
    "Spam",
    "Trash",
    "Trash",
  ].entries()) {
    const m = mail(
      `${folder}-${i}`,
      ["Alex Morgan", "Jamie Chen", "Tracklane"][i % 3],
      [
        "A quick follow-up",
        "Project notes and next steps",
        "Your weekly workspace update",
      ][i % 3],
      "Here are the notes from our conversation. Thanks again for making the time.",
      "Important",
      "Aug 28",
      false,
    );
    m.folder = folder;
    m.starred = i === 0;
    if (folder === "Reminders")
      m.reminder = i === 3 ? "Tomorrow, 9:00 AM" : "Monday, 9:00 AM";
    result.push(m);
  }
  for (let i = 0; i < 12; i++) {
    const m = mail(
      `work-${i}`,
      ["Jamie Chen", "Alex Morgan", "Codeyard", "Tracklane"][i % 4],
      [
        "Studio review",
        "Re: Launch plans",
        "Pull request ready for review",
        "Your team activity",
      ][i % 4],
      "A quick update on what we are working on this week. Let me know if you have any questions.",
      i < 4 ? "Important" : i < 7 ? "Github" : "Other",
      "Yesterday",
      i < 4,
    );
    m.account = accounts[1];
    m.to = accounts[1];
    result.push(m);
  }
  return result;
}
export const seedDrafts: Draft[] = [
  {
    id: "draft-one",
    account: accounts[0],
    mode: "new",
    to: "alex@example.com",
    cc: "",
    bcc: "",
    subject: "A few thoughts on the next iteration",
    body: "<p>Hey Alex,</p><p>I spent some time with the latest build. A few small things stood out:</p>",
    attachments: [],
    updated: 1788258000000,
  },
  {
    id: "draft-two",
    account: accounts[0],
    mode: "new",
    to: "jamie@example.com",
    cc: "",
    bcc: "",
    subject: "Friday catch-up",
    body: "<p>Are you free for a quick catch-up on Friday?</p>",
    attachments: [],
    updated: 1788248000000,
  },
  {
    id: "draft-three",
    account: accounts[0],
    mode: "new",
    to: "",
    cc: "",
    bcc: "",
    subject: "September project notes",
    body: "<p>A few things to keep in mind for September.</p>",
    attachments: [],
    updated: 1788148000000,
  },
  {
    id: "draft-four",
    account: accounts[0],
    mode: "new",
    to: "sam@example.com",
    cc: "",
    bcc: "",
    subject: "Re: Preview is ready",
    body: "<p>Thanks Sam! This is looking really good.</p>",
    attachments: [],
    updated: 1788048000000,
  },
];
export function displayDate(value: string) {
  if (!/^\d{4}-\d\d-\d\dT/.test(value)) return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : value;
}

export function reminderTime(value: string) {
  const raw = value.toLowerCase();
  if (raw === "never" || raw === "someday") return undefined;
  if (/^\d{4}-\d\d-\d\dT/.test(value)) return Date.parse(value);
  const date = new Date();
  const amount = raw.match(/(\d+)\s*(minutes?|hours?|days?|weeks?)/);
  if (amount)
    return (
      Date.now() +
      Number(amount[1]) *
        (amount[2].startsWith("minute")
          ? 60000
          : amount[2].startsWith("hour")
            ? 3600000
            : amount[2].startsWith("week")
              ? 604800000
              : 86400000)
    );
  if (raw.includes("tomorrow")) date.setDate(date.getDate() + 1);
  else if (raw.includes("weekend"))
    date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7 || 7));
  else if (raw.includes("week") || raw.includes("monday"))
    date.setDate(date.getDate() + ((1 - date.getDay() + 7) % 7 || 7));
  const time = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  date.setHours(
    time ? (Number(time[1]) % 12) + (time[3] === "pm" ? 12 : 0) : 8,
    time ? Number(time[2] || 0) : 0,
    0,
    0,
  );
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  return date.getTime();
}
