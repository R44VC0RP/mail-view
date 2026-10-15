import type { Address, Attachment, Email, Label, Message } from "./types";

export const initialLabels: Label[] = [
  { id: "focus", name: "Focus", color: "#e2e3e3", visible: true },
  {
    id: "backlog-cleared",
    name: "Backlog Cleared",
    parentId: "focus",
    color: "#e2e3e3",
    visible: true,
  },
  {
    id: "blocked",
    name: "Blocked",
    parentId: "focus",
    color: "#e2e3e3",
    visible: true,
  },
  {
    id: "handle-later",
    name: "Handle Later",
    parentId: "focus",
    color: "#e2e3e3",
    visible: true,
  },
  {
    id: "social",
    name: "[Superhuman]/AI/Social",
    color: "#e2e3e3",
    visible: false,
  },
  {
    id: "marketing",
    name: "[Superhuman]/AI/Marketing",
    color: "#e2e3e3",
    visible: false,
  },
  {
    id: "pitch",
    name: "[Superhuman]/AI/Pitch",
    color: "#e2e3e3",
    visible: false,
  },
  { id: "work", name: "Work", color: "#e2e3e3", visible: false },
  { id: "personal", name: "Personal", color: "#e2e3e3", visible: false },
  { id: "receipts", name: "Receipts", color: "#e2e3e3", visible: false },
  { id: "travel", name: "Travel", color: "#e2e3e3", visible: false },
];

const me: Address = { name: "Avery", email: "avery@example.com" };

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (character) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }) as Record<string, string>
      )[character]!,
  );
}

function newsletter(
  brand: string,
  content: string,
  background = "#ffffff",
  accent = "#222222",
): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:${background};font-family:Arial,Helvetica,sans-serif;color:#242424"><div style="max-width:560px;margin:0 auto;padding:36px 28px"><div style="font-size:22px;font-weight:800;letter-spacing:-.5px;color:${accent};margin-bottom:32px">${escapeHtml(brand)}</div>${content}<div style="margin-top:40px;padding-top:20px;border-top:1px solid #dedede;font-size:11px;line-height:1.6;color:#777">You're receiving this email because you signed up for updates from ${escapeHtml(brand)}.<br><span style="text-decoration:underline">Manage preferences</span> &nbsp; · &nbsp; <span style="text-decoration:underline">Unsubscribe</span><br>2026 ${escapeHtml(brand)}. All rights reserved.</div></div></body></html>`;
}

const cta = (text: string, background = "#252525", color = "#ffffff") =>
  `<span style="display:inline-block;padding:14px 22px;border-radius:6px;background:${background};color:${color};font-size:14px;font-weight:bold">${escapeHtml(text)}</span>`;

type Seed = {
  sender: string;
  address?: string;
  subject: string;
  snippet: string;
  body: string;
  date?: string;
  time?: string;
  unread?: boolean;
  starred?: boolean;
  important?: boolean;
  labels?: string[];
  folder?: Email["folder"];
  category?: Email["category"];
  format?: Message["format"];
  attachments?: Attachment[];
  history?: { body: string; from?: Address; date?: string }[];
  to?: Address[];
  snoozedUntil?: string;
  muted?: boolean;
};

function makeEmail(id: string, seed: Seed): Email {
  const date = seed.date ?? "2026-08-26T09:00:00.000Z";
  const from = {
    name: seed.address === me.email ? me.name : seed.sender,
    email:
      seed.address ??
      `${seed.sender
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.|\.$/g, "")}@example.com`,
  };
  const attachments = (seed.attachments ?? []).map((attachment, index) => ({
    ...attachment,
    id: `${id}-attachment-${index + 1}`,
    previewText:
      attachment.previewText ||
      (attachment.type === "pdf"
        ? `From: ${seed.sender}\n\n${seed.subject}\n\n${seed.snippet}\n\nGenerated sample attachment - Gopen local mailbox`
        : undefined),
    url:
      attachment.url ||
      (attachment.type === "pdf"
        ? samplePdf(attachment.name, seed.sender, seed.subject, seed.snippet)
        : undefined),
  }));
  const messages: Message[] = (seed.history ?? []).map(
    (previous, index, history) => ({
      id: `${id}-message-${index + 1}`,
      from: previous.from ?? from,
      to: previous.from?.email === me.email ? [from] : [me],
      date:
        previous.date ??
        new Date(
          new Date(date).getTime() - (history.length - index) * 86_400_000,
        ).toISOString(),
      body: previous.body,
      format: "plain",
    }),
  );
  messages.push({
    id: `${id}-message-${messages.length + 1}`,
    from,
    to: seed.to ?? [me],
    date,
    body: seed.body,
    format: seed.format ?? "plain",
    attachments,
  });
  return {
    id,
    sender: seed.sender,
    senderEmail: from.email,
    subject: seed.subject,
    snippet: seed.snippet,
    date,
    time:
      seed.time ??
      new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    unread: seed.unread ?? false,
    starred: seed.starred ?? false,
    important: seed.important ?? false,
    folder: seed.folder ?? "inbox",
    labels: [...(seed.labels ?? [])],
    messages,
    attachments,
    category:
      seed.category ??
      (seed.labels?.includes("social")
        ? "social"
        : seed.labels?.includes("marketing")
          ? "promotions"
          : "primary"),
    ...(seed.snoozedUntil ? { snoozedUntil: seed.snoozedUntil } : {}),
    ...(seed.muted ? { muted: true } : {}),
  };
}

function samplePdf(
  name: string,
  sender: string,
  subject: string,
  snippet: string,
): string {
  const text = (value: string) =>
    value.replace(/[^\x20-\x7e]/g, " ").replace(/[\\()]/g, "\\$&");
  const lines = [
    name,
    "",
    `From: ${sender}`,
    subject,
    "",
    ...(snippet.match(/.{1,72}(?:\s|$)|.{1,72}/g) || []),
    "",
    "Generated sample attachment - Gopen local mailbox",
  ];
  const stream = `BT /F1 12 Tf 50 750 Td 22 TL ${lines.map((line, index) => `${index ? "T* " : ""}(${text(line)}) Tj`).join("\n")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${btoa(pdf)}`;
}

const firstEmails: Seed[] = [
  {
    sender: "Porchlight Forums",
    address: "digest@example.com",
    subject: '"Best way to keep basil alive indoors?"',
    snippet:
      "p/WindowsillGardens: Neighbors compare grow lights, pots, and watering habits.",
    date: "2026-08-26T20:15:00.000Z",
    time: "8:15 PM",
    labels: ["social"],
    body: 'Your evening Porchlight digest\n\n"Best way to keep basil alive indoors?"\np/WindowsillGardens\n\nA new member asked why every basil plant they buy wilts within two weeks. The replies turned into a friendly checklist: repot out of the grocery-store container, pinch the tops before it flowers, and water the soil rather than the leaves.\n\nAlso in your neighborhood forums:\n- Free moving boxes on Elm Street\n- Which bakery has the best rye this month?\n\nThis fictional digest was generated for the demo inbox.',
  },
  {
    sender: "Choir Commons",
    address: "music@example.com",
    subject: "Open rehearsal: learn a round in one evening",
    snippet:
      "No sight-reading required. We teach the melody by ear and sing it together by nine.",
    date: "2026-08-26T18:20:00.000Z",
    time: "6:20 PM",
    unread: true,
    labels: ["marketing"],
    format: "html",
    body: newsletter(
      "Choir Commons",
      `<h1 style="font-size:38px;line-height:1.1;letter-spacing:-1.2px;margin:0 0 20px">Learn a round<br>in one evening.</h1><p style="font-size:17px;line-height:1.65">Our autumn open rehearsal is for anyone who has ever sung along in the car. We teach a short three-part round by ear, one line at a time.</p><div style="border-radius:12px;background:#203a43;color:#f6efe2;padding:24px;margin:28px 0"><div style="font-size:12px;letter-spacing:2px;color:#e9c46a">TUESDAY &middot; 7:30 PM</div><p style="font-size:20px;margin:10px 0 0">Old Mill Hall, upstairs room</p></div><h2 style="font-size:22px">What to bring</h2><p style="font-size:15px;line-height:1.7">A water bottle and your curiosity. Lyric sheets, tea, and a patient section leader are provided. By the end of the night you will hear the melody come back around in three voices.</p>${cta("Save my spot", "#2a9d8f")}<p style="font-size:13px;margin-top:24px;color:#5f6b6d">A fictional community choir created for this demo.</p>`,
      "#f6f1e7",
      "#203a43",
    ),
  },
  {
    sender: "Tidewater Observatory",
    address: "live@example.com",
    subject: "Live tonight: counting meteors from the pier",
    snippet:
      "The livestream starts at dusk. Bring a blanket or watch from home with the volunteer astronomers.",
    date: "2026-08-26T16:43:00.000Z",
    time: "4:43 PM",
    format: "html",
    body: newsletter(
      "Tidewater Observatory",
      `<div style="padding:26px;background:#14213d;border-radius:8px;color:white"><div style="font-size:12px;font-weight:bold;letter-spacing:1.6px;color:#fca311">STREAMING AT DUSK</div><h1 style="font-size:30px;line-height:1.15;margin:16px 0">Counting meteors<br>from the pier</h1><p style="font-size:17px;margin:0">Volunteer astronomers will narrate the sky until midnight.</p></div><h2 style="margin-top:30px">Watch together</h2><p style="font-size:16px;line-height:1.7">Join us at the end of the fishing pier or follow the livestream from your couch. We will keep a running tally, answer questions in the chat, and point the big telescope at the moon between showers.</p>${cta("Open the livestream", "#fca311", "#14213d")}<p style="font-size:13px;line-height:1.7;color:#68616f;margin-top:24px">You asked for reminders about night-sky events. This observatory and stream are fictional.</p>`,
      "#f4f6fb",
      "#14213d",
    ),
  },
  {
    sender: "crumb drafts",
    address: "drafts@example.com",
    subject: "[DRAFT] Sourdough Saturday - with GIF",
    snippet:
      "Newsletter draft: a looping GIF of the morning bake, then this week's loaf list.",
    date: "2026-08-26T10:42:00.000Z",
    time: "10:42 AM",
    format: "html",
    attachments: [
      {
        id: "",
        name: "morning-bake-loop.gif",
        type: "image",
        size: "842 KB",
        inline: true,
      },
    ],
    body: newsletter(
      "CRUMB & CO.",
      `<div style="background:#3d2b1f;color:#fbf3e4;padding:28px;border-radius:4px"><div style="font-size:12px;color:#f2c57c;letter-spacing:2px">SOURDOUGH SATURDAY</div><h1 style="font-size:34px;line-height:1.1">Out of the oven at 7.</h1><p style="line-height:1.7">Country loaf, seeded rye, and a cardamom bun that only exists on Saturdays.</p><div style="padding:22px;border:1px solid #8a6a4f;font-size:24px;font-weight:bold;text-align:center;color:#f2c57c">48 loaves &middot; first come, first served</div></div><p style="line-height:1.7">The attached GIF shows the morning bake on a loop. This version opens with the oven shot and keeps the menu short.</p>${cta("See this week's loaves", "#f2c57c", "#3d2b1f")}<p style="font-size:13px;color:#666">Draft only. Not sent to subscribers.</p>`,
      "#fffaf2",
      "#3d2b1f",
    ),
  },
  {
    sender: "Odile from Inkwell Sketch",
    address: "odile@example.com",
    subject: "Three shortcuts hiding in your sketchbook app",
    snippet:
      "Pinch to merge layers, two-finger tap to undo, and a ruler you can bend.",
    date: "2026-08-26T10:40:00.000Z",
    time: "10:40 AM",
    unread: true,
    labels: ["marketing"],
    format: "html",
    body: newsletter(
      "Inkwell Sketch",
      `<h1 style="font-size:30px;line-height:1.2;letter-spacing:-1px">Small gestures,<br>faster sketches.</h1><p style="font-size:16px;line-height:1.7">Hi Avery,</p><p style="font-size:16px;line-height:1.7">You've filled eleven pages this month. Here are three gestures that make the next eleven even quicker.</p><div style="background:#eaf4ee;border-radius:12px;padding:24px;margin:26px 0"><p style="margin:0 0 18px"><strong style="color:#2f7a55">01 &nbsp; Pinch to merge layers.</strong><br><span style="line-height:1.8">Squeeze two layers together in the panel to flatten them.</span></p><p style="margin:0 0 18px"><strong style="color:#2f7a55">02 &nbsp; Two-finger tap to undo.</strong><br><span style="line-height:1.8">Three fingers brings the stroke back.</span></p><p style="margin:0"><strong style="color:#2f7a55">03 &nbsp; Bend the ruler.</strong><br><span style="line-height:1.8">Hold the ruler and drag its middle to draw a smooth curve.</span></p></div>${cta("Open my sketchbook", "#2f7a55")}<p style="line-height:1.7;margin-top:26px">Keep drawing,<br><strong>Odile</strong><br>Inkwell Sketch</p>`,
      "#ffffff",
      "#2f7a55",
    ),
  },
  {
    sender: "crumb drafts",
    address: "drafts@example.com",
    subject: "[DRAFT] Sourdough Saturday - handwritten note",
    snippet:
      "Newsletter draft written like a note taped to the bakery door.",
    date: "2026-08-26T10:26:00.000Z",
    time: "10:26 AM",
    body: "Hi neighbor,\n\nThe starter was extra lively this week, so Saturday's country loaf has a big open crumb and a crackly crust. We are also trying a fig and walnut loaf for the first time. If it disappears by nine, we will make it again.\n\nThe door opens at 7. Bring your own bag if you have one; we will have paper ones if you don't.\n\nSee you Saturday,\nthe crumb crew\n\nDraft notes: handwritten-note variation. Mock copy for the demo, not a sent newsletter.",
  },
  {
    sender: "crumb drafts",
    address: "drafts@example.com",
    subject: "[DRAFT] Sourdough Saturday - menu card",
    snippet:
      "Newsletter draft laid out like a chalkboard menu with prices and bake times.",
    date: "2026-08-26T10:17:00.000Z",
    time: "10:17 AM",
    format: "html",
    body: newsletter(
      "CRUMB & CO.",
      `<div style="border:1px solid #dedede;border-radius:16px;overflow:hidden"><div style="background:#2b2b2b;color:#fbf3e4;padding:24px"><span style="font-size:12px;color:#f2c57c">THIS SATURDAY</span><h1 style="font-size:28px;margin:12px 0 0">The menu board</h1></div><div style="padding:24px"><table style="width:100%;font-size:15px;line-height:2"><tr><td>Country loaf</td><td style="text-align:right">$8</td></tr><tr><td>Seeded rye</td><td style="text-align:right">$9</td></tr><tr><td>Fig &amp; walnut (new)</td><td style="text-align:right">$10</td></tr><tr><td>Cardamom bun</td><td style="text-align:right">$4</td></tr></table><div style="border-top:1px solid #eee;padding-top:16px;margin-top:12px">Doors open <strong>7:00 AM</strong></div></div></div><p style="line-height:1.7">Prices and loaves are fictional. This layout tests whether a menu-first email feels clearer than a story.</p>${cta("Plan my Saturday", "#f2c57c", "#2b2b2b")}<p style="font-size:13px;color:#777">Menu-card draft.</p>`,
    ),
  },
  {
    sender: "crumb drafts",
    address: "drafts@example.com",
    subject: "[DRAFT] Sourdough Saturday",
    snippet:
      "Final draft: shorter opening, the new fig loaf up top, and one clear time to show up.",
    date: "2026-08-26T09:43:00.000Z",
    time: "9:43 AM",
    body: "Fig and walnut is here.\n\nThis Saturday we are baking our first fig and walnut loaf next to the usual country loaf and seeded rye. Doors open at 7. The cardamom buns usually last about an hour.\n\nThanks for keeping a tiny bakery busy,\nthe crumb crew\n\nDraft notes: final subject line, new loaf first, one time. The earlier revisions are below.",
    history: [
      {
        body: "First pass at the Saturday email: a paragraph about the starter, the full menu, and the story of the oven. Probably too long for a phone.",
        date: "2026-08-24T14:00:00.000Z",
      },
      {
        body: "Could we open with the fig loaf and move the oven story to next week? People mostly want to know what is new and when to come.",
        from: me,
        date: "2026-08-25T15:15:00.000Z",
      },
      {
        body: "Moved the fig loaf to the top and cut the menu to three lines. I'll send the shorter version tomorrow so we can compare all the layouts.",
        date: "2026-08-25T18:40:00.000Z",
      },
    ],
  },
  {
    sender: "Porchlight Forums",
    address: "digest@example.com",
    subject: '"Show us your balcony garden"',
    snippet:
      "Tomatoes in buckets, herbs on a ladder, and one very ambitious pumpkin.",
    date: "2026-08-23T20:10:00.000Z",
    labels: ["social"],
    body: 'Your Porchlight weekly\n\n"Show us your balcony garden"\n\nNeighbors shared photos of small-space gardens: tomatoes growing in five-gallon buckets, herbs on an old ladder, and a pumpkin vine that has claimed most of a railing. The top tip was to check your balcony weight limits before adding more soil.\n\nOther threads: a lost cat found near the library, and recommendations for a reliable bike mechanic.',
  },
  {
    sender: "Riverbend Makerspace",
    address: "makerspace@example.com",
    subject: "New laser cutter: orientation sessions are open",
    snippet:
      "Book a 45-minute safety orientation before your first cut. Weeknight and weekend slots available.",
    date: "2026-08-23T15:25:00.000Z",
    labels: ["marketing"],
    format: "html",
    body: newsletter(
      "Riverbend Makerspace",
      '<h1 style="font-size:28px;line-height:1.2">Meet the new laser cutter.</h1><p style="line-height:1.8">The bigger bed fits a full sheet of plywood, and the air assist leaves cleaner edges on acrylic. Before your first project, every member completes a short hands-on orientation.</p><h2>In the session</h2><p style="line-height:1.8">Loading material, focusing the lens, safe settings for wood and cardboard, and what never goes in the machine. You will leave with a small engraved coaster.</p>' +
        cta("Book an orientation", "#e76f51", "#ffffff"),
      "#ffffff",
      "#264653",
    ),
  },
  {
    sender: "Plantwise",
    address: "hello.plantwise@example.com",
    subject: "Your fern needs less water than you think",
    snippet: "A quick seasonal care note for the plants in your list.",
    date: "2026-08-23T13:30:00.000Z",
    labels: ["marketing"],
    body: "Hi Avery,\n\nAs the days get shorter, the Boston fern on your plant list will drink a little less. Try checking the top inch of soil before watering instead of sticking to a fixed day.\n\nYour pothos, on the other hand, is in its happy season. If a vine is getting long, snip it just below a leaf node and put the cutting in a glass of water. In a few weeks you will have a new plant to share.\n\nSmall checks, happier leaves.\nThe Plantwise Team",
  },
  {
    sender: "Halvorsen Piano Care",
    address: "tuning@example.com",
    subject: "Accepted: Piano tuning visit",
    snippet:
      "Your piano tuning is confirmed for Thursday, August 27 at 2:00 PM.",
    date: "2026-08-23T11:05:00.000Z",
    labels: [],
    attachments: [
      {
        id: "",
        name: "piano-tuning.ics",
        type: "calendar",
        size: "2 KB",
        url: `data:text/calendar;charset=utf-8,${encodeURIComponent("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Gopen Mock//EN\r\nBEGIN:VEVENT\r\nUID:piano-demo@example.com\r\nDTSTAMP:20260823T110500Z\r\nDTSTART:20260827T210000Z\r\nDTEND:20260827T220000Z\r\nSUMMARY:Piano tuning visit (demo)\r\nLOCATION:Home\r\nEND:VEVENT\r\nEND:VCALENDAR")}`,
      },
    ],
    body: "Hi Avery,\n\nYour piano tuning visit is confirmed.\n\nThursday, August 27, 2026\n2:00 PM - 3:00 PM Pacific\n\nThe tuning takes about an hour. If any keys stick or a pedal squeaks, leave a note on the music stand and I will take a look while I'm there. Please clear the top of the piano so I can open the lid.\n\nThe calendar invitation is attached. If the time no longer works, reply and we will find another afternoon.\n\nThank you,\nHalvorsen Piano Care\n\nThis is a fictional appointment for the demo inbox.",
  },
  {
    sender: "Pathfinder Maps",
    address: "maps@example.com",
    subject: "Your offline trail pack is ready",
    snippet: "Six trails around Cedar Lake are saved for use without a signal.",
    date: "2026-08-21T17:12:00.000Z",
    body: "Hi Avery,\n\nThe Cedar Lake trail pack finished downloading. You can now open these maps without a signal:\n\n- Lakeshore Loop (3.1 mi)\n- Fire Lookout Climb (5.4 mi)\n- Mossy Falls Spur (1.2 mi)\n- and three connector trails\n\nThe pack includes elevation profiles and the two water refill points along the lookout trail. Maps refresh automatically next time you are on Wi-Fi.\n\nHappy hiking,\nPathfinder Maps\n\nFictional trails and app for the demo inbox.",
  },
  {
    sender: "Sunniva Dahl",
    address: "sunniva@example.com",
    subject: "Swap notes on community radio?",
    snippet:
      "I host a tiny neighborhood radio hour and loved your zine about local makers.",
    date: "2026-08-21T13:40:00.000Z",
    labels: ["pitch"],
    body: "Hi Avery,\n\nI picked up your zine about local makers at the library and read it cover to cover on the bus. The interview with the bicycle frame builder was lovely.\n\nI host a one-hour neighborhood radio show on Sunday mornings and I'm planning a short series on people who make things by hand. Would you be open to a short chat about how you found the people in the zine? No recording, just swapping notes over coffee.\n\nEither way, thank you for making it.\n\nSunniva",
  },
  {
    sender: "Porchlight Forums",
    address: "digest@example.com",
    subject: '"First time building a birdhouse, advice?"',
    snippet:
      "Untreated cedar, a sloped roof, and leave out the perch.",
    date: "2026-08-21T08:00:00.000Z",
    labels: ["social"],
    body: 'Your morning roundup\n\n"First time building a birdhouse, advice?"\n\nA member shared plans for their first birdhouse and asked for feedback. The replies agreed on a few basics: use untreated wood, drill small ventilation holes near the top, give the roof an overhang, and skip the perch so predators have nothing to grip.\n\nAlso popular: a recipe swap for late-summer zucchini.',
  },
  {
    sender: "crumb drafts",
    address: "drafts@example.com",
    subject: "Idea: name the loaf of the month?",
    snippet: "A playful idea for getting regulars to vote on the next special.",
    date: "2026-08-20T16:00:00.000Z",
    body: "What if regulars named the loaf of the month?\n\nWe put three names on the chalkboard next to the register and let people vote with a bean in a jar. The winning name goes on the sign for the whole month.\n\nCandidates for September: The Foggy Morning, Rye Not, and Big Crumb Energy.\n\nthe crumb crew\n\nInternal mock idea for the demo inbox.",
  },
  {
    sender: "crumb drafts",
    address: "drafts@example.com",
    subject: "Bread club: who is bringing the starter?",
    snippet:
      "Planning the first bread club meetup. Four people, one jar of starter, and a borrowed oven.",
    date: "2026-08-20T10:30:00.000Z",
    body: "The first bread club meetup is set.\n\nFour people, one shared jar of starter, and the community kitchen oven from 6 to 9. Everyone takes home a loaf and a spoonful of starter for next time.\n\nI'll bring flour and the scale. See you there.\n\nthe crumb crew",
    history: [
      {
        body: "Thinking about a small bread club for regulars who want to learn. Would a weeknight evening at the community kitchen work?",
      },
      {
        body: "Yes, a weeknight is perfect. Keep it small so everyone gets hands in the dough.",
        from: me,
      },
      {
        body: "Booked the community kitchen for Wednesday. Now we just need someone to bring the starter.",
      },
    ],
  },
  {
    sender: "Northgate Community Pool",
    address: "pool@example.com",
    subject: "Lane booking waitlisted: Saturday 8:00 AM",
    snippet:
      "Demo notice: your lap lane request is on the waitlist. You'll hear from us if a lane opens.",
    date: "2026-08-18T18:20:00.000Z",
    category: "updates",
    body: "Northgate Community Pool - booking update\n\nYour request for a lap lane on Saturday at 8:00 AM is on the waitlist. All six lanes are booked for that hour.\n\nWe will email you if a lane opens up. You can also choose a different time from the schedule; weekday mornings before 7:00 AM usually have room.\n\nRequest: Lap lane, 45 minutes\nStatus: Waitlisted (position 2)\nMember: Fictional demo account\n\nThis is sample content. No real membership or booking is associated with this inbox.",
    history: [
      {
        body: "Demo confirmation: we received your lap lane request for Saturday at 8:00 AM. We'll confirm availability shortly.",
      },
      {
        body: "Demo update: Saturday mornings are popular this month. We're checking for cancellations before sending a final status.",
      },
    ],
  },
  {
    sender: "Porchlight Forums",
    address: "digest@example.com",
    subject: '"Which hiking boots survived your winter?"',
    snippet:
      "Neighbors share the boots that stayed dry and the ones that didn't.",
    date: "2026-08-18T17:00:00.000Z",
    labels: ["social"],
    body: 'Your Porchlight roundup\n\n"Which hiking boots survived your winter?"\n\nA long, practical thread about boots that stayed waterproof through slush and mud. The consensus: break them in before a long hike, re-wax leather in the fall, and buy half a size up for thick socks.\n\nMore from your neighborhood: a free piano needs a new home, and the farmers market moves indoors next month.',
  },
  {
    sender: "Bramblewood Seeds",
    address: "orders@example.com",
    subject: "Order confirmation - DEMO-5190",
    snippet:
      "Your heirloom tomato sampler is confirmed. The packing list and receipt are attached.",
    date: "2026-08-18T15:45:00.000Z",
    category: "updates",
    format: "html",
    attachments: [
      {
        id: "",
        name: "Packing list",
        type: "document",
        size: "24 KB",
        url: "data:text/plain;charset=utf-8,Demo%20order%20DEMO-5190%0AHeirloom%20tomato%20sampler%0ATotal%3A%20%2424.00",
      },
      { id: "", name: "receipt-DEMO-5190.pdf", type: "pdf", size: "118 KB" },
    ],
    body: newsletter(
      "Bramblewood Seeds",
      '<h1 style="font-size:28px">Your seeds are on their way.</h1><p style="line-height:1.7">Hi Avery, thanks for your order. We hand-pack every envelope and include a planting card for each variety.</p><div style="border:1px solid #dedede;border-radius:8px;padding:24px;margin:26px 0"><div style="font-size:12px;color:#777">ORDER NUMBER</div><div style="font-size:18px;margin:8px 0 24px">DEMO-5190</div><table style="width:100%;font-size:14px;line-height:2"><tr><td>Heirloom tomato sampler (6 varieties)</td><td style="text-align:right">$18.00</td></tr><tr><td>Pea shoot microgreens</td><td style="text-align:right">$6.00</td></tr><tr><td style="border-top:1px solid #ddd;font-weight:bold">Total</td><td style="border-top:1px solid #ddd;text-align:right;font-weight:bold">$24.00 USD</td></tr></table></div><p style="line-height:1.7">The packing list and PDF receipt are attached. This fictional order involves no real shipment or payment.</p>',
      "#f7faf3",
      "#3f6b35",
    ),
  },
  {
    sender: "Starlight Cinema",
    address: "cinema@example.com",
    subject: "Your free popcorn voucher expires Sunday",
    snippet:
      "Show this email at the counter for a small popcorn with any ticket this week.",
    date: "2026-08-18T14:20:00.000Z",
    labels: ["marketing"],
    format: "html",
    body: newsletter(
      "Starlight Cinema",
      '<div style="padding:28px;background:#1d1a2f;color:white"><div style="color:#ffd166;font-size:12px;letter-spacing:2px">MEMBER VOUCHER</div><h1 style="font-size:34px;line-height:1.1">One small popcorn,<br>on us.</h1><p style="line-height:1.8">This week only: show this email at the counter with any ticket. Our late-summer series is classic heist films, every evening at 8.</p>' +
        cta("See showtimes", "#ffd166", "#1d1a2f") +
        '</div><p style="line-height:1.7">This voucher and cinema are fictional. Nothing is redeemed by this demo.</p>',
    ),
  },
  {
    sender: "Harbor Bike Share",
    address: "bikes@example.com",
    subject: "Your annual pass renews in 7 days",
    snippet:
      "No action needed unless you want to change plans. You rode 214 miles this year.",
    date: "2026-08-18T12:40:00.000Z",
    category: "updates",
    body: "Hi Avery,\n\nYour annual Harbor Bike Share pass renews in 7 days. No action is needed if you want to keep riding.\n\nYour year so far: 96 rides, 214 miles, and a favorite dock at the waterfront library.\n\nIf you would rather switch to a monthly plan or pause over the winter, you can change it in your account settings before the renewal date.\n\nThis mock notice contains no real account or payment information.\n\nHarbor Bike Share",
  },
  {
    sender: "Cedar Hills Vet Clinic",
    address: "vet@example.com",
    subject: "Reminder: Biscuit is due for a checkup",
    snippet:
      "Biscuit's annual checkup and vaccines are due next month. Book a visit when convenient.",
    date: "2026-08-18T11:10:00.000Z",
    category: "updates",
    body: "Hello,\n\nOur records show that Biscuit is due for an annual checkup and booster vaccines in September.\n\nPet: Biscuit (beagle mix)\nDue: September 2026\nVisit length: about 30 minutes\n\nYou can book online or reply to this email with a few times that work. Please bring any notes about appetite or energy changes.\n\nCedar Hills Vet Clinic\n\nThis fictional reminder was generated for the demo inbox.",
  },
  {
    sender: "Dr. Amara Singh",
    address: "amara@example.com",
    subject: "Would you judge the regional science fair?",
    snippet:
      "We need a few volunteers to talk with student teams about their projects for one morning.",
    date: "2026-08-18T09:30:00.000Z",
    unread: true,
    labels: ["pitch"],
    body: "Hi Avery,\n\nI coordinate the regional middle-school science fair, and we are looking for a few volunteers to judge the engineering and design category.\n\nIt is one Saturday morning in October. You would visit six to eight student tables, ask a few questions, and fill in a short scoring sheet. Mostly we want people who will be encouraging and curious about how the students built things.\n\nWould you be interested? I can send the judging guide and schedule so you can decide.\n\nWarmly,\nAmara\n\nFictional outreach for this demo inbox.",
  },
  {
    sender: "Fernhill Outfitters",
    address: "outfitters@example.com",
    subject: "Rain shells for the trail season",
    snippet: "Light, packable layers that fold into their own pocket.",
    date: "2026-08-18T08:10:00.000Z",
    unread: true,
    labels: ["marketing"],
    format: "html",
    body: newsletter(
      "Fernhill Outfitters",
      '<div style="background:#d8e2dc;padding:28px"><h1 style="font-size:32px;line-height:1.15">Ready for the<br>first rain.</h1><p style="line-height:1.7">Our packable rain shells weigh less than a sandwich and fold into their own chest pocket. Taped seams, pit zips, and a hood that actually stays put.</p></div><p style="line-height:1.7">Pick a color you can spot on the trail and stash one in every daypack.</p>' +
        cta("Browse rain shells", "#3a5a40"),
      "#fbfdfb",
      "#3a5a40",
    ),
  },
];

const projects = [
  "Bramble",
  "Studio",
  "Relay",
  "Field Notes",
  "Pocket Atlas",
  "Common Ground",
  "Sidecar",
  "Good Measure",
  "Canvas",
  "Daybreak",
  "Waypoint",
  "Northstar",
  "Little Things",
  "Open Desk",
  "Weekender",
  "Paper Trail",
];
const people = [
  "Maya Chen",
  "Jordan Ellis",
  "Sam Rivera",
  "Priya Shah",
  "Alex Morgan",
  "Nina Park",
  "Theo Brooks",
  "Emma Wilson",
  "Leo Santos",
  "Claire Martin",
  "Devon Reed",
  "Robin Kim",
  "Jules Harper",
  "Riley Stone",
  "Casey Lin",
  "Morgan Bell",
];

function recurringEmail(index: number): Seed {
  const kind = index % 24;
  const round = Math.floor(index / 24);
  const project = projects[round % projects.length]!;
  const person = people[(round + kind) % people.length]!;
  const build = 184 + round * 7 + kind;
  const week = 34 - round;
  const base: Seed = {
    sender: person,
    subject: `${project}: a few thoughts`,
    snippet: "A quick update on the next step.",
    body: "",
    date: new Date(
      Date.UTC(2026, 7, 17, 18) - index * 6 * 3_600_000,
    ).toISOString(),
    // A spread of 251 unread among 368 older threads, plus the four above.
    unread:
      Math.floor(((index + 1) * 251) / 368) > Math.floor((index * 251) / 368),
    starred: index % 31 === 7,
    important: index % 11 === 3,
    labels: ["work"],
  };
  switch (kind) {
    case 0:
      return {
        ...base,
        sender: "Sketchpad",
        address: "sketchpad@example.com",
        subject: `${person} commented on ${project} / Onboarding`,
        snippet:
          "Could we give the welcome screen a little more breathing room?",
        body: `${person} left a comment in ${project} / Onboarding.\n\n"Could we give the welcome screen a little more breathing room? The secondary action feels close to the main button at the smaller breakpoint."\n\nFrame: Welcome / Mobile\n\nThe updated prototype includes a wider gutter and a calmer empty state. Take a look when you have a minute.`,
        category: "updates",
      };
    case 1:
      return {
        ...base,
        sender: "BuildBay",
        address: "builds@example.com",
        subject: `Build ${build} succeeded: ${project} - main`,
        snippet:
          "Your iOS build is ready for internal testing. All checks passed.",
        body: `Build ${build} succeeded.\n\nProject: ${project}\nWorkflow: Main / Internal testing\nBranch: main\nChecks: 42 passed, 0 failed\n\nThe build includes the updated onboarding copy and a fix for the keyboard covering the final form field. Please run through the first-launch checklist on a small device before sharing it with the wider group.\n\nThis is a fictional build notification.`,
        category: "updates",
      };
    case 2:
      return {
        ...base,
        sender: "Tablewise",
        address: "database@example.com",
        subject: `${project}: weekly database insights - week ${week}`,
        snippet:
          "Query latency is steady. Two queries could benefit from a new index.",
        body: `${project} database insights\nWeek ${week}\n\nThe busiest queries stayed within the usual latency range this week. Two dashboard queries repeatedly scan the activity table before filtering by workspace.\n\nSuggested review:\n- Add workspace_id to the activity lookup index.\n- Confirm the archive view uses cursor pagination.\n- Review the preview branch before the next deploy request.\n\nNo production changes were made. These are sample metrics for the demo.`,
        category: "updates",
      };
    case 3:
      return {
        ...base,
        sender: "Codeyard",
        address: "codeyard@example.com",
        subject: `[${project.toLowerCase().replaceAll(" ", "-")}] Pull request #${80 + round}: simplify keyboard navigation`,
        snippet: `${person} requested your review. Focus stays visible as you move through the list.`,
        body: `${person} requested your review on pull request #${80 + round}.\n\nSummary\nThis change keeps the active row in view when navigating with the keyboard and restores focus after closing the detail panel.\n\nVerified manually:\n- Arrow keys move through the visible results.\n- Escape returns to the previous row.\n- Tab reaches the primary action without a trap.\n\nThe diff is small. Feedback on the focus behavior would be especially useful.`,
        history: [
          {
            body: `Opening the ${project} keyboard navigation change for review. I have the basic behavior working and am checking the empty state next.`,
          },
          {
            from: me,
            body: "The row navigation feels good. Could you also check where focus goes after the detail panel closes?",
          },
        ],
      };
    case 4:
      return {
        ...base,
        sender: "Teamthread",
        address: "teamthread@example.com",
        subject: `${project}: new messages in #design-feedback`,
        snippet: `${person}: Dropped the updated empty states in the channel.`,
        body: `While you were away in ${project}\n\n#design-feedback\n${person}: Dropped the updated empty states in the channel. The copy is a little shorter and the illustration no longer pushes the action below the fold.\n\n#shipping\nJordan: The release checklist is ready. Please add anything that needs a second set of eyes before we send the internal build.\n\nYou can catch up when it suits your schedule.`,
        category: "updates",
      };
    case 5:
      return {
        ...base,
        sender: "Pagebook",
        address: "pagebook@example.com",
        subject: `${person} mentioned you in ${project} planning`,
        snippet:
          "Do we want to include the import flow in this milestone or keep it separate?",
        body: `${person} mentioned you in ${project} planning.\n\n"Do we want to include the import flow in this milestone or keep it separate? I added a short checklist for each option so we can compare scope."\n\nThe page now has three sections: what is ready, what needs a decision, and what can wait. Your input is requested only on the import question.\n\nThe mock workspace is not connected to a real Pagebook account.`,
        labels: ["work", "focus", round % 2 ? "blocked" : "handle-later"],
      };
    case 6:
      return {
        ...base,
        sender: "The Steady Engineer",
        address: "engineering.news@example.com",
        subject: `Small teams, thoughtful tools: issue ${210 + round}`,
        snippet:
          "This week: keeping the development loop short without adding more process.",
        body: newsletter(
          "The Steady Engineer",
          `<h1 style="font-size:28px;line-height:1.2">A shorter loop beats<br>a bigger checklist.</h1><p style="line-height:1.8">Issue ${210 + round} explores how small teams stay close to the work. A fast local environment, useful error messages, and a release that is easy to undo often matter more than another dashboard.</p><h2 style="font-size:20px">Three things to try</h2><p style="line-height:1.8">Measure the slowest step in your daily loop. Remove a handoff that no longer helps. Write down the one decision that would unblock the next person.</p><p style="line-height:1.8">In the community spotlight: a team building ${escapeHtml(project)} shares how they reduced the gap between an idea and a working preview.</p>`,
        ),
        format: "html",
        labels: ["marketing"],
        category: "promotions",
      };
    case 7:
      return {
        ...base,
        sender: person,
        subject: `${project}: coffee and a quick catch-up?`,
        snippet:
          "I will be near your neighborhood Thursday. Would late morning work?",
        body: `Hey Avery,\n\nI'll be nearby Thursday and thought it would be nice to catch up. Would late morning work for a coffee?\n\nI'd love to hear how ${project} is going, but mostly it would be good to get away from the screen for a bit. No agenda.\n\nIf this week is busy, we can aim for next week instead.\n\n${person.split(" ")[0]}`,
        labels: ["personal"],
        history: [
          {
            body: `Hey! It has been a while. How is ${project} coming along? We should find time for a catch-up soon.`,
          },
          {
            from: me,
            body: "Definitely. A coffee would be nice. Let me know when you are going to be nearby.",
          },
        ],
      };
    case 8:
      return {
        ...base,
        sender: "Field Supply",
        address: "shop@example.com",
        subject: `Your Field Supply order is on its way - FS-${1000 + round}`,
        snippet:
          "Your notebook and cable organizer have shipped. A receipt is attached.",
        body: `Hi Avery,\n\nYour fictional Field Supply order FS-${1000 + round} is on its way.\n\n1 x Dot-grid notebook - $12.00\n1 x Cable organizer - $8.00\nShipping - $0.00\nTotal - $20.00\n\nThe order receipt is attached for your records. There is no real shipment or tracking number associated with this demo.\n\nThanks for supporting small, useful things.\nField Supply`,
        labels: ["receipts"],
        category: "updates",
        attachments: [
          {
            id: "",
            name: `field-supply-receipt-${1000 + round}.pdf`,
            type: "pdf",
            size: "96 KB",
          },
        ],
      };
    case 9:
      return {
        ...base,
        sender: "BuildBay",
        address: "builds@example.com",
        subject: `Build ${build} failed: ${project} - release-preview`,
        snippet:
          "One UI check needs attention: the welcome screen did not become visible in time.",
        body: `Build ${build} failed during UI verification.\n\nProject: ${project}\nBranch: release-preview\nFailed check: WelcomeScreen / first launch\n\nThe test waited for the welcome title, but the permission sheet was still visible on the simulator. The application compiled successfully.\n\nSuggested next step: reproduce first launch with a clean simulator and inspect the permission flow before rerunning the check.\n\nThe attached report is a mock artifact.`,
        category: "updates",
        labels: ["work", "blocked"],
        attachments: [
          {
            id: "",
            name: `${project.toLowerCase().replaceAll(" ", "-")}-build-report.pdf`,
            type: "pdf",
            size: "1.8 MB",
          },
        ],
      };
    case 10:
      return {
        ...base,
        sender: "Tracklane",
        address: "tracklane@example.com",
        subject: `${project}: your week in review`,
        snippet:
          "Four issues completed, one decision waiting, and a smaller backlog.",
        body: `${project} - week ${week}\n\nCompleted\n- Keep the selected item visible after filtering.\n- Make long titles wrap instead of clipping.\n- Add a clear empty state for saved items.\n- Simplify the first-run checklist.\n\nWaiting for a decision\nShould the export action live in the menu or next to the primary action?\n\nThe next cycle has room for focused work. Nothing was automatically moved.`,
        labels: ["work", "focus", "backlog-cleared"],
        category: "updates",
      };
    case 11:
      return {
        ...base,
        sender: "Shipyard Deploys",
        address: "deploys@example.com",
        subject: `${project}: production deployment is ready`,
        snippet:
          "Your latest deployment completed successfully. Preview checks passed.",
        body: `Deployment complete\n\nProject: ${project}\nEnvironment: Production (mock)\nBranch: main\nBuild duration: 38 seconds\n\nThe latest changes include clearer loading feedback and a smaller image payload on the landing page. The previous deployment remains available for comparison.\n\nThis notification is fictional and does not reference a live site.`,
        category: "updates",
      };
    case 12:
      return {
        ...base,
        sender: "Design Notes",
        address: "design.notes@example.com",
        subject: `Design Notes ${90 + round}: quieter interfaces`,
        snippet:
          "A closer look at spacing, useful contrast, and knowing what to leave out.",
        body: newsletter(
          "DESIGN NOTES",
          `<h1 style="font-size:30px;line-height:1.2">Not everything needs<br>to ask for attention.</h1><p style="line-height:1.8">This week, we study the small decisions that make an interface feel calmer: a border instead of a shadow, a label instead of a tooltip, and a little more space around the action that matters.</p><h2 style="font-size:20px">From the sketchbook</h2><p style="line-height:1.8">The ${escapeHtml(project)} concept starts with one useful question: what should someone notice first? Everything else is arranged around that answer.</p><p style="line-height:1.8">Try removing one competing accent from the screen you are working on. Then look at it again at phone size.</p>`,
          "#f6f4ef",
          "#4c6156",
        ),
        format: "html",
        labels: ["marketing"],
        category: "promotions",
      };
    case 13:
      return {
        ...base,
        sender: person,
        subject: `${project}: notes from today's walkthrough`,
        snippet:
          "The new flow is clearer. I marked three small things to revisit before sharing.",
        body: `Hi Avery,\n\nThanks for walking me through ${project}. The new flow makes much more sense than the earlier version.\n\nThree small notes:\n1. The first button could say what happens next.\n2. The success state disappears a little quickly.\n3. On my phone, the helper text wraps to three lines.\n\nNone of these block the next preview. I put annotated screenshots in the attached document so you can look when you have time.\n\n${person.split(" ")[0]}`,
        attachments: [
          {
            id: "",
            name: `${project.toLowerCase().replaceAll(" ", "-")}-walkthrough-notes.docx`,
            type: "document",
            size: "238 KB",
          },
        ],
      };
    case 14:
      return {
        ...base,
        sender: "Codeyard",
        address: "codeyard@example.com",
        subject: `[${project.toLowerCase().replaceAll(" ", "-")}] Issue #${140 + round}: preserve selection after search`,
        snippet: `${person} opened a new issue with a short reproduction and a proposed behavior.`,
        body: `${person} opened issue #${140 + round}.\n\nWhen I search for an item, open it, and clear the search, the selection jumps back to the first row. It would be more helpful to keep the item selected if it still exists.\n\nReproduction:\n1. Search for "welcome".\n2. Open the second result.\n3. Clear the query.\n\nExpected: the same item remains selected.\nActual: the first item becomes selected.\n\nHappy to help verify a fix in the next ${project} preview.`,
        category: "forums",
      };
    case 15:
      return {
        ...base,
        sender: "Northline Travel",
        address: "travel@example.com",
        subject: `Your itinerary is ready - ${project} community weekend`,
        snippet:
          "A simple summary of the mock trip, with the workshop schedule attached.",
        body: `Hi Avery,\n\nHere is the sample itinerary for the ${project} community weekend.\n\nFriday\nArrive in the afternoon. Optional welcome coffee at 5:00 PM.\n\nSaturday\nCommunity workshop, project demos, and an open afternoon for exploring.\n\nSunday\nBreakfast and a short wrap-up before heading home.\n\nThe schedule is attached. This is a fictional itinerary: no tickets, reservations, or personal travel details are stored here.\n\nNorthline Travel`,
        labels: ["travel", "personal"],
        attachments: [
          {
            id: "",
            name: `community-weekend-itinerary-${round + 1}.pdf`,
            type: "pdf",
            size: "320 KB",
          },
        ],
      };
    case 16:
      return {
        ...base,
        sender: "Edgeway",
        address: "cloud.news@example.com",
        subject: `Developer roundup ${50 + round}: small services, big ideas`,
        snippet:
          "This month: useful edge patterns and the projects developers are sharing.",
        body: newsletter(
          "Edgeway Developers",
          `<h1 style="font-size:28px;line-height:1.2">Build one useful thing.</h1><p style="line-height:1.8">The best side project often starts with a small annoyance. This roundup looks at webhook helpers, personal dashboards, and lightweight services that make everyday work easier.</p><h2 style="font-size:20px">Community spotlight: ${escapeHtml(project)}</h2><p style="line-height:1.8">A focused interface, a fast response, and a simple deployment path. The team shares what they kept small and where they chose to invest.</p><p style="line-height:1.8">Also inside: debugging tips, an overview of cache behavior, and ways to make logs more useful without collecting more data.</p>`,
          "#fffaf4",
          "#c86b26",
        ),
        format: "html",
        labels: ["marketing"],
        category: "promotions",
      };
    case 17:
      return {
        ...base,
        sender: person,
        subject: `${project}: a couple of references you might like`,
        snippet:
          "Found these while looking at simple onboarding patterns. The second one is especially nice.",
        body: `Hey Avery,\n\nI was collecting references for ${project} and found a few patterns you might appreciate.\n\nThe first uses a short checklist instead of a tour. The second lets people try the main action before asking them to configure anything. The third is just a really good empty state.\n\nI attached a contact sheet rather than sending a pile of links. The annotations explain what I liked about each one.\n\nNo need to reply quickly. Just thought these might be useful.\n\n${person.split(" ")[0]}`,
        attachments: [
          {
            id: "",
            name: `onboarding-references-${round + 1}.png`,
            type: "image",
            size: "2.4 MB",
          },
        ],
      };
    case 18:
      return {
        ...base,
        sender: "Harbor Coffee",
        address: "coffee@example.com",
        subject: `Your Harbor Coffee receipt - ${round + 1}`,
        snippet:
          "One flat white, one oat cookie, and a little break from the screen.",
        body: `Harbor Coffee - sample receipt\n\nFlat white - $4.50\nOat cookie - $3.00\nSubtotal - $7.50\nTax - $0.60\nTotal - $8.10\n\nThank you for stopping by. We hope the coffee made your afternoon a little better.\n\nThis receipt is fictional. No real purchase or payment details are included.`,
        labels: ["receipts", "personal"],
        category: "updates",
      };
    case 19:
      return {
        ...base,
        sender: "Indie Makers",
        address: "makers@example.com",
        subject: `What shipped this week: edition ${160 + round}`,
        snippet:
          "A tiny reading app, a better timer, and a project that finally left the drafts folder.",
        body: `Indie Makers - edition ${160 + round}\n\nThis week's projects are a reminder that useful does not have to mean large.\n\nA reading app that remembers exactly where you stopped.\nA timer that makes the current task visible without nagging.\n${project}, a small tool built around a clear first action.\n\nThe common thread: each maker chose one thing to do well and shipped a version people could actually try.\n\nPrompt for the weekend: what can you finish if you remove one feature?`,
        labels: ["marketing"],
        category: "promotions",
      };
    case 20:
      return {
        ...base,
        sender: person,
        subject: `${project}: can you review the release notes?`,
        snippet:
          "Kept the changes user-facing and removed the internal issue numbers.",
        body: `Hi Avery,\n\nCould you give the ${project} release notes a quick read?\n\nDraft:\n- Find saved items faster with a simpler search.\n- Keep your place when moving between the list and detail view.\n- Read longer titles comfortably on a phone.\n\nI left out the implementation details and grouped the smaller fixes into one line. If the tone feels right, I'll use this for the next internal preview.\n\nThanks,\n${person.split(" ")[0]}`,
        history: [
          {
            body: `The ${project} preview is nearly ready. Would you like a technical changelog or a shorter set of user-facing notes?`,
          },
          {
            from: me,
            body: "User-facing notes, please. Focus on what someone will notice and leave the internal issue numbers out.",
          },
        ],
        labels: ["work", "handle-later"],
      };
    case 21:
      return {
        ...base,
        sender: "Filecrate",
        address: "files@example.com",
        subject: `${person} shared the ${project} assets folder`,
        snippet:
          "The final icons and a short usage guide are ready for the next preview.",
        body: `${person} shared a mock folder with you: ${project} / Assets.\n\nContents:\n- Final app icons at standard sizes\n- Light and dark wordmarks\n- A short guide to spacing and background colors\n\nThe attached contact sheet shows the assets together. Please use the newest exports rather than the earlier sketches.\n\nThis demo does not access a real Filecrate folder.`,
        attachments: [
          {
            id: "",
            name: `${project.toLowerCase().replaceAll(" ", "-")}-asset-contact-sheet.png`,
            type: "image",
            size: "4.6 MB",
          },
        ],
        category: "updates",
      };
    case 22:
      return {
        ...base,
        sender: "Neighborhood Library",
        address: "library@example.com",
        subject: `Your reading list: collection ${round + 1}`,
        snippet:
          "A few books about making things, paying attention, and finishing small projects.",
        body: `Hello Avery,\n\nYour latest sample reading list is ready.\n\nThis collection focuses on making things with intention: practical design, creative routines, and the value of finishing a small project before starting a larger one.\n\nIf you enjoyed the notes from ${project}, you might like the chapter on turning a vague idea into a concrete first step.\n\nThere are no real loans or due dates attached to this notification.\n\nHappy reading,\nYour neighborhood library`,
        labels: ["personal"],
        category: "updates",
      };
    default:
      return {
        ...base,
        sender: person,
        subject: `${project}: looks good to me`,
        snippet:
          "Tried the preview on desktop and my phone. The new flow feels much better.",
        body: `Hey Avery,\n\nI tried the ${project} preview on desktop and on my phone. The new flow feels much better, especially the way it keeps my place after I go back.\n\nThe only tiny thing I noticed is that the helper text could be a little shorter. That's not a blocker from my side.\n\nThanks for turning the feedback around so quickly. Looks good to me.\n\n${person.split(" ")[0]}`,
        labels: ["work", "focus", "backlog-cleared"],
        history: [
          {
            from: me,
            body: `The updated ${project} preview is ready. I simplified the first screen and fixed the back-navigation behavior. Could you try it on your phone?`,
          },
        ],
      };
  }
}

const inbox: Email[] = [
  ...firstEmails.map((seed, index) =>
    makeEmail(`inbox-${String(index + 1).padStart(3, "0")}`, seed),
  ),
  ...Array.from({ length: 368 }, (_, index) =>
    makeEmail(
      `inbox-${String(index + 26).padStart(3, "0")}`,
      recurringEmail(index),
    ),
  ),
];

const drafts: Seed[] = [
  {
    sender: "me",
    address: me.email,
    to: [{ name: "Maya Chen", email: "maya@example.com" }],
    subject: "A few notes on the onboarding flow",
    snippet:
      "I tried the shorter version this morning. The first screen feels much clearer...",
    body: "Hi Maya,\n\nI tried the shorter version this morning. The first screen feels much clearer, and I think we can simplify the next step too.\n\nA couple of thoughts before I forget:\n- Keep the primary action above the fold.\n- Let people try the demo before choosing a workspace.\n\n",
    date: "2026-08-26T15:12:00.000Z",
    time: "3:12 PM",
    labels: ["work"],
  },
  {
    sender: "me",
    address: me.email,
    to: [{ name: "Amara Singh", email: "amara@example.com" }],
    subject: "Re: Would you judge the regional science fair?",
    snippet:
      "Thanks for thinking of me. Judging sounds fun. Could you send the guide...",
    body: "Hi Amara,\n\nThanks for thinking of me. Judging the engineering category sounds fun. Could you send the judging guide and the start time for the Saturday?\n\n",
    date: "2026-08-25T11:10:00.000Z",
    labels: ["pitch"],
  },
  {
    sender: "me",
    address: me.email,
    to: [],
    subject: "Weekend project ideas",
    snippet:
      "A tiny menu bar timer, a calmer reading list, a shortcut for studio lights...",
    body: "A few ideas to revisit:\n\n- A tiny menu bar timer that shows one task.\n- A calmer reading list with a real end.\n- A shortcut for setting up the studio.\n\nPick one. Keep it small.",
    date: "2026-08-24T09:20:00.000Z",
    labels: ["personal"],
  },
];

const sentSubjects = [
  "Re: Piano tuning visit",
  "Re: Bramble release notes",
  "The updated prototype is ready",
  "Re: Coffee on Thursday?",
  "A small keyboard navigation fix",
  "Re: Asset exports",
  "Thanks for the walkthrough",
  "Weekend workshop notes",
];
const sentRecipients: Address[] = [
  { name: "Halvorsen Piano Care", email: "tuning@example.com" },
  { name: "Jordan Ellis", email: "jordan@example.com" },
  { name: "Maya Chen", email: "maya@example.com" },
  { name: "Priya Shah", email: "priya@example.com" },
  { name: "Alex Morgan", email: "alex@example.com" },
  { name: "Nina Park", email: "nina@example.com" },
  { name: "Theo Brooks", email: "theo@example.com" },
  { name: "Emma Wilson", email: "emma@example.com" },
];
const sentBodies = [
  "Thanks for confirming. Thursday at 2:00 PM works. The middle C key has been sticking a little, so I will leave a note on the music stand.\n\nSee you then,\nAvery",
  "These read well. I like that the first bullet describes what someone can do instead of how we implemented it. Let us keep this version for the internal preview.\n\nAvery",
  "The updated prototype is ready. The mobile layout has more room around the primary action, and the empty state is shorter. Please try the first-run flow when you have a moment.\n\nAvery",
  "Thursday sounds good. Late morning would be easiest for me. Looking forward to a little time away from the screen.\n\nAvery",
  "I pushed a small change that keeps the selected row visible after filtering. Escape now restores focus to the row that opened the detail view. Could you give it a quick try?\n\nAvery",
  "Thanks for sending the final exports. I replaced the older icons and checked both light and dark backgrounds. Everything looks consistent now.\n\nAvery",
  "Thanks for the thoughtful walkthrough. The annotated screenshots made the layout issue easy to understand. I will start with the button copy and the helper text.\n\nAvery",
  "Here are the short workshop notes. I kept the scope to one useful action and a demo people can try immediately. We can leave the deeper implementation details for questions.\n\nAvery",
];

const archiveSeeds: Seed[] = [
  {
    sender: "Maya Chen",
    subject: "Bramble: final icon exports",
    snippet:
      "All set. The final exports are in the folder, including the small sizes.",
    body: "Hi Avery,\n\nThe final icon exports are ready. I checked the small sizes and simplified the detail that was getting lost. Thanks for the clear feedback.\n\nMaya",
    labels: ["work", "focus", "backlog-cleared"],
  },
  {
    sender: "Field Supply",
    subject: "Your desk organizer receipt",
    snippet:
      "Thanks for your order. Here is your sample receipt for the desk organizer.",
    body: "Field Supply\n\nDesk organizer - $28.00\nShipping - $0.00\nTotal - $28.00\n\nThis is a fictional receipt. No purchase was made.",
    labels: ["receipts"],
    attachments: [
      {
        id: "",
        name: "desk-organizer-receipt.pdf",
        type: "pdf",
        size: "84 KB",
      },
    ],
  },
  {
    sender: "Jordan Ellis",
    subject: "Coffee was a good idea",
    snippet: "Nice to catch up. I will send the book title when I find it.",
    body: "Hey Avery,\n\nReally nice to catch up. It was good to talk about something other than a backlog for a little while. I will send the book title when I find it in my notes.\n\nJordan",
    labels: ["personal"],
  },
  {
    sender: "Codeyard",
    subject: "[relay] Pull request #72 merged",
    snippet: "The empty-state copy update has been merged into main.",
    body: "Pull request #72 was merged into main.\n\nThe empty state now explains what belongs in the list and gives one clear action for getting started. Thanks to everyone who reviewed the wording.",
    labels: ["work"],
    category: "updates",
  },
  {
    sender: "Pagebook",
    subject: "Studio planning: decision recorded",
    snippet: "The first milestone will focus on recording, not on publishing.",
    body: "The Studio planning page has a new decision.\n\nMilestone one focuses on a reliable recording workflow. Publishing tools will stay in the later list until the basic setup feels comfortable.\n\nThe next action is a short in-studio test.",
    labels: ["focus", "backlog-cleared"],
  },
  {
    sender: "Community Forum",
    subject: "Weekly desk setup thread",
    snippet: "A few new replies to the workspace thread you muted.",
    body: "New replies in the weekly workspace thread:\n\nA better cable route, a small lamp, and a surprisingly useful notebook stand. This fictional thread is muted and will stay out of the inbox.",
    labels: ["social"],
    category: "forums",
    muted: true,
  },
];

const snoozedSeeds: Seed[] = [
  {
    sender: "Priya Shah",
    subject: "Revisit the import flow next week",
    snippet:
      "No rush on this one. Let us compare the two options after the preview ships.",
    body: "Hi Avery,\n\nNo rush on the import flow. Let us compare the two options after the preview ships so we can make the decision with a little more context.\n\nI wrote down the trade-offs in the planning page.\n\nPriya",
    labels: ["work", "handle-later"],
    snoozedUntil: "2026-08-31T09:00:00.000Z",
  },
  {
    sender: "Northline Travel",
    subject: "Community weekend: choose a workshop",
    snippet: "The workshop list is ready whenever you want to take a look.",
    body: "Hello Avery,\n\nThe sample workshop list is ready. There is a practical design session, a small-tools session, and an open project room. You can decide later; nothing is reserved or charged in this demo.",
    labels: ["travel", "handle-later"],
    snoozedUntil: "2026-08-28T09:00:00.000Z",
  },
  {
    sender: "Emma Wilson",
    subject: "A little feedback on the landing page",
    snippet:
      "The headline works. I have two thoughts about the section below it.",
    body: "Hey Avery,\n\nThe headline is much clearer now. I have two thoughts about the section below it, but they can wait until you finish the current release.\n\nMostly I think one example would say more than the longer explanation.\n\nEmma",
    labels: ["work", "handle-later"],
    snoozedUntil: "2026-08-27T16:00:00.000Z",
  },
];

export const initialEmails: Email[] = [
  ...inbox,
  ...drafts.map((seed, index) =>
    makeEmail(`draft-${String(index + 1).padStart(3, "0")}`, {
      ...seed,
      folder: "drafts",
    }),
  ),
  ...sentSubjects.map((subject, index) =>
    makeEmail(`sent-${String(index + 1).padStart(3, "0")}`, {
      sender: "me",
      address: me.email,
      to: [sentRecipients[index]!],
      subject,
      snippet: sentBodies[index]!.split("\n")[0]!,
      body: sentBodies[index]!,
      date: new Date(
        Date.UTC(2026, 7, 26, 14) - index * 18 * 3_600_000,
      ).toISOString(),
      time: index === 0 ? "2:00 PM" : undefined,
      folder: "sent",
      labels: [index === 3 ? "personal" : "work"],
    }),
  ),
  ...archiveSeeds.map((seed, index) =>
    makeEmail(`archive-${String(index + 1).padStart(3, "0")}`, {
      ...seed,
      folder: "archive",
      date: new Date(
        Date.UTC(2026, 7, 20, 10) - index * 86_400_000,
      ).toISOString(),
    }),
  ),
  ...snoozedSeeds.map((seed, index) =>
    makeEmail(`snoozed-${String(index + 1).padStart(3, "0")}`, {
      ...seed,
      folder: "archive",
      date: new Date(
        Date.UTC(2026, 7, 25, 12) - index * 86_400_000,
      ).toISOString(),
    }),
  ),
  ...[
    {
      sender: "Growth Offer",
      subject: "Promote your project to a bigger audience",
      snippet: "An unsolicited promotional offer moved to spam.",
      body: "This fictional promotional message was moved to spam. It contains no links, real offer, or requested action.",
    },
    {
      sender: "Directory Listings",
      subject: "Your listing needs a review",
      snippet: "A generic directory pitch that you did not subscribe to.",
      body: "This is a mock unsolicited directory pitch. No listing exists and no account information is requested.",
    },
    {
      sender: "Campaign Services",
      subject: "A shortcut to more newsletter subscribers",
      snippet: "Unwanted marketing copy, safely kept out of your inbox.",
      body: "This sample marketing message is classified as spam. There is no external campaign, tracking URL, or real sender behind it.",
    },
  ].map((seed, index) =>
    makeEmail(`spam-${String(index + 1).padStart(3, "0")}`, {
      ...seed,
      folder: "spam",
      unread: true,
      labels: ["marketing"],
      date: new Date(
        Date.UTC(2026, 7, 24, 8) - index * 86_400_000,
      ).toISOString(),
    }),
  ),
  ...[
    {
      sender: "Design Notes",
      subject: "Design Notes: an older edition",
      snippet: "An older newsletter you already finished reading.",
      body: "An archived sample from Design Notes. This edition discussed useful spacing, readable type, and keeping the first action clear.",
    },
    {
      sender: "BuildBay",
      subject: "Build 102 succeeded: old preview",
      snippet:
        "A superseded build notification from an earlier internal preview.",
      body: "Build 102 succeeded. This fictional notification is no longer needed because a newer preview is available.",
    },
    {
      sender: "Calendar",
      subject: "Canceled: project catch-up",
      snippet: "The old catch-up was canceled when a new time was agreed.",
      body: "The fictional project catch-up was canceled. A different time was agreed in the newer thread. No real calendar event was changed.",
    },
  ].map((seed, index) =>
    makeEmail(`trash-${String(index + 1).padStart(3, "0")}`, {
      ...seed,
      folder: "trash",
      date: new Date(
        Date.UTC(2026, 7, 22, 8) - index * 86_400_000,
      ).toISOString(),
    }),
  ),
].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
