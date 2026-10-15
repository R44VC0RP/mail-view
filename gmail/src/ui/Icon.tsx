import { useEffect, useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

// Exact source bytes and capture selectors are audited in bench/icon-manifest.json.
const bitmaps: Record<string, number> = {
  compose: 24,
  labelFilled: 24,
  bold: 20,
  italic: 20,
  underline: 20,
  chevronDown: 20,
  chevronUp: 20,
  chevronRight: 20,
  chevronLeft: 20,
  arrowBack: 20,
  plus: 20,
  inbox: 20,
  star: 20,
  starFilled: 20,
  clock: 20,
  send: 20,
  draft: 20,
  label: 20,
  more: 20,
  refresh: 20,
  archive: 20,
  trash: 20,
  spam: 20,
  mail: 20,
  mailOpen: 20,
  task: 20,
  move: 20,
  important: 20,
  importantFilled: 20,
  checkbox: 20,
  checkboxChecked: 20,
  checkboxMixed: 20,
  reply: 20,
  replyAll: 20,
  forward: 20,
  print: 20,
  openInNew: 20,
  download: 20,
  attachment: 20,
  check: 20,
  format: 20,
  link: 20,
  emoji: 20,
  photo: 20,
  lock: 20,
  calendar: 20,
  mute: 20,
  drive: 20,
  undo: 20,
  close16: 16,
  minimize16: 16,
  expand16: 16,
  exitFullscreen16: 16,
  popout16: 16,
  maximize16: 16,
  inboxOutline: 20,
  clockFilled: 20,
  sendFilled: 20,
  draftFilled: 20,
  spamFilled: 20,
  trashFilled: 20,
  scheduleSend: 20,
  scheduleSendFilled: 20,
  allMail: 20,
  allMailFilled: 20,
  social: 20,
  socialFilled: 20,
  updates: 20,
  updatesFilled: 20,
  forums: 20,
  forumsFilled: 20,
  promotions: 20,
  promotionsFilled: 20,
  arrowDropDown: 20,
  arrowRight: 20,
  mailUnreadIndicator: 20,
  attachmentHorizontal: 20,
  lockPlain: 20,
  textColor: 20,
  signature: 20,
  layout: 20,
  calendarAuto: 20,
  alignLeft: 20,
  alignCenter: 20,
  alignRight: 20,
  numberedList: 20,
  bulletedList: 20,
  indentDecrease: 20,
  indentIncrease: 20,
  quote: 20,
  strikethrough: 20,
  clearFormatting: 20,
  redo: 20,
  searchPlain: 20,
  formatSize: 20,
  spellCheck: 20,
  replyPopout: 20,
  trim: 20,
  recipientAdd: 20,
  formatArrow20: 20,
  sendArrow20: 20,
  contextArrow20: 20,
};

const fullColor: Record<string, { size: number; file: string; imageSize?: number }> = {
  "yellow-star": { size: 20, file: "yellow-star.png" },
  "orange-star": { size: 20, file: "orange-star.png" },
  "red-star": { size: 20, file: "red-star.png" },
  "purple-star": { size: 20, file: "purple-star.png" },
  "blue-star": { size: 20, file: "blue-star.png" },
  "green-star": { size: 20, file: "green-star.png" },
  // Preserve native CONTENT image dimensions inside the captured 20px frame.
  "red-bang": { size: 20, file: "red-bang.png", imageSize: 19 },
  "orange-guillemet": { size: 20, file: "orange-guillemet.png", imageSize: 19 },
  "yellow-bang": { size: 20, file: "yellow-bang.png", imageSize: 19 },
  "green-check": { size: 20, file: "green-check.png", imageSize: 19 },
  "blue-info": { size: 20, file: "blue-info.png", imageSize: 19 },
  "purple-question": { size: 20, file: "purple-question.png", imageSize: 19 },
  driveLogo20: { size: 20, file: "driveLogo20.png" },
  contactsLogo20: { size: 20, file: "contactsLogo20.png" },
  person: { size: 40, file: "person.png" },
  document: { size: 16, file: "document.png" },
  mimePdf: { size: 16, file: "mimePdf.png" },
  mimeImage: { size: 16, file: "mimeImage.png" },
  scanInfo: { size: 16, file: "scanInfo.png" },
  toastClose20: { size: 20, file: "toastClose20.png" },
  recipientWarning: { size: 24, file: "recipientWarning.svg" },
};

const vectors: Record<string, { viewBox: string; body: ReactNode }> = {
  photoSource: {
    viewBox: "0 -960 960 960",
    body: <path d="M460-80q-92,0-156-64T240-300q0-40 13-75.5T290-440H140q-25,0-42.5-17.5T80-500q0-92 64-156t156-64q40,0 75.5,13T440-670V-820q0-25 17.5-42.5T500-880q92,0 156,64t64,156q0,40-13,75.5T670-520H820q25,0 42.5,17.5T880-460q0,92-64,156T660-240q-40,0-75.5-13T520-290v150q0,25-17.5,42.5T460-80Zm60-442q51-8 85.5-46.5T640-660t-34.5-91.5T520-798v276ZM440-162V-438q-51,8-85.5,46.5T320-300t34.5,91.5T440-162ZM161-520H438q-8-51-46.5-85.5T300-640q-54,0-92.5,34.5T161-520ZM660-320q54,0 92.5-34.5T799-440H522q8,51 46.5,85.5T660-320Z" />,
  },
  pickerLink: {
    viewBox: "0 0 24 24",
    body: <path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z" />,
  },
  pickerUpload: {
    viewBox: "0 -960 960 960",
    body: <path d="M220-160q-24 0-42-18t-18-42v-143h60v143h520v-143h60v143q0 24-18 42t-42 18H220Zm230-153v-371L330-564l-43-43 193-193 193 193-43 43-120-120v371h-60Z" />,
  },
  pickerSearch: {
    viewBox: "0 0 24 24",
    body: <><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /><path d="M0 0h24v24H0z" fill="none" /></>,
  },
  pickerClear: {
    viewBox: "0 -960 960 960",
    body: <path d="m336-280 144-144 144 144 56-56-144-144 144-144-56-56-144 144-144-144-56 56 144 144-144 144 56 56ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />,
  },
  pickerFilter24: {
    viewBox: "0 0 24 24",
    body: <path d="M11 21v-6h2v2h8v2h-8v2Zm-8-2v-2h6v2Zm4-4v-2H3v-2h4V9h2v6Zm4-2v-2h10v2Zm4-4V3h2v2h4v2h-4v2ZM3 7V5h10v2Z" />,
  },
  pickerCheck: {
    viewBox: "0 0 24 24",
    body: <path fill="none" stroke="currentColor" d="M1.73,12.91 8.1,19.28 22.79,4.59" />,
  },
  mailUnreadToolbar: {
    viewBox: "0 -960 960 960",
    body: <path d="M168-192q-29.7,0-50.85-21.16T96-264.04V-696.28Q96-726 117.15-747T168-768H553q-2,17-1,35.5t6,36.5H168L480-517l140-81q14,13 37,24t41,16L480-432L168-611v347H792V-558.46q20-4.54 37.5-14.04T864-594v329.77Q864-234 842.5-213T792-192H168Zm0-504v432V-696Zm491,37q-35-35-35-85t35-85t85-35t85,35t35,85t-35,85t-85,35t-85-35Z" />,
  },
  linkText: {
    viewBox: "0 -960 960 960",
    body: <path d="M192-360v-72H576v72H192Zm0-168v-72H768v72H192Z" style={{ userSelect: "none" }} />,
  },
  driveList: {
    viewBox: "0 0 24 24",
    body: <path d="M4 13c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0 4c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0-8c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm3 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />,
  },
  driveGrid: {
    viewBox: "0 -960 960 960",
    body: <path d="M120-520V-840H440v320H120Zm0,400V-440H440v320H120ZM520-520V-840H840v320H520Zm0,400V-440H840v320H520ZM200-600H360V-760H200v160Zm400,0H760V-760H600v160Zm0,400H760V-360H600v160Zm-400,0H360V-360H200v160ZM600-600Zm0,240Zm-240,0Zm0-240Z" />,
  },
  expandAll: {
    viewBox: "0 -960 960 960",
    body: <path d="M480-96L252-324l51-51L480-198L657-375l51,51L480-96ZM303-585l-51-51L480-864L708-636l-51,51L480-762L303-585Z" />,
  },
  collapseAll: {
    viewBox: "0 -960 960 960",
    body: <path d="M289-95l-50-50L480-387L721-145L671-95L480-285L289-95ZM480-573L239-815l50-50L480-675L671-865l50,50L480-573Z" />,
  },
  downloadAttachment: {
    viewBox: "0 -960 960 960",
    body: <path d="M480-336L288-528l51-51L444-474V-816h72v342L621-579l51,51L480-336ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72H696v-72h72v72q0,29.7-21.16,50.85T695.96-192H263.72Z" />,
  },
  menu: {
    viewBox: "0 0 24 24",
    body: <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />,
  },
  search: {
    viewBox: "0 -960 960 960",
    body: <path d="M740-560q-1,0-8-6q-16-61-60.5-105.5T566-732q-2-1-6-8q0-2 6-8q61-16 105.5-60.5T732-914q1-2 8-6q2,0 8,6q17,61 61,105.5T914-748q2,0 6,8q0,1-6,8q-61,16-105.5,60.5T748-566q0,2-8,6Zm44,440L534-370q-34,25-73,37.5T380-320q-109,0-184.5-75.5T120-580t75.5-184.5T380-840q29,0 57,6.5T491-815l-40,70q-17-8-35-11.5T380-760q-75,0-127.5,52.5T200-580t52.5,127.5T380-400q69,0 120-45.5T559-560h80q-3,36-15,70.5T590-426L840-176l-56,56Z" />,
  },
  tune: {
    viewBox: "0 0 24 24",
    body: <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />,
  },
  close: {
    viewBox: "0 0 24 24",
    body: <><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /><path d="M0 0h24v24H0z" fill="none" /></>,
  },
  statusChevron: {
    viewBox: "0 0 24 24",
    body: <path d="m12 15.375-6-6 1.4-1.4 4.6 4.6 4.6-4.6 1.4 1.4Z" />,
  },
  help: {
    viewBox: "0 0 24 24",
    body: <><path fill="none" d="M0 0h24v24H0z" /><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" /></>,
  },
  settings: {
    viewBox: "0 0 24 24",
    body: <><path d="M13.85 22.25h-3.7c-.74 0-1.36-.54-1.45-1.27l-.27-1.89c-.27-.14-.53-.29-.79-.46l-1.8.72c-.7.26-1.47-.03-1.81-.65L2.2 15.53c-.35-.66-.2-1.44.36-1.88l1.53-1.19c-.01-.15-.02-.3-.02-.46 0-.15.01-.31.02-.46l-1.52-1.19c-.59-.45-.74-1.26-.37-1.88l1.85-3.19c.34-.62 1.11-.9 1.79-.63l1.81.73c.26-.17.52-.32.78-.46l.27-1.91c.09-.7.71-1.25 1.44-1.25h3.7c.74 0 1.36.54 1.45 1.27l.27 1.89c.27.14.53.29.79.46l1.8-.72c.71-.26 1.48.03 1.82.65l1.84 3.18c.36.66.2 1.44-.36 1.88l-1.52 1.19c.01.15.02.3.02.46s-.01.31-.02.46l1.52 1.19c.56.45.72 1.23.37 1.86l-1.86 3.22c-.34.62-1.11.9-1.8.63l-1.8-.72c-.26.17-.52.32-.78.46l-.27 1.91c-.1.68-.72 1.22-1.46 1.22zm-3.23-2h2.76l.37-2.55.53-.22c.44-.18.88-.44 1.34-.78l.45-.34 2.38.96 1.38-2.4-2.03-1.58.07-.56c.03-.26.06-.51.06-.78s-.03-.53-.06-.78l-.07-.56 2.03-1.58-1.39-2.4-2.39.96-.45-.35c-.42-.32-.87-.58-1.33-.77l-.52-.22-.37-2.55h-2.76l-.37 2.55-.53.21c-.44.19-.88.44-1.34.79l-.45.33-2.38-.95-1.39 2.39 2.03 1.58-.07.56a7 7 0 0 0-.06.79c0 .26.02.53.06.78l.07.56-2.03 1.58 1.38 2.4 2.39-.96.45.35c.43.33.86.58 1.33.77l.53.22.38 2.55z" /><circle cx="12" cy="12" r="3.5" /></>,
  },
  apps: {
    viewBox: "0 0 24 24",
    body: <path d="M6,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM16,6c0,1.1 0.9,2 2,2s2,-0.9 2,-2 -0.9,-2 -2,-2 -2,0.9 -2,2zM12,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2z" />,
  },
  studio: {
    viewBox: "0 0 24 24",
    body: <path fill="currentColor" d="M11.184 2.001a4.83 4.83 0 0 1 3.367 1.253l5.995 5.49c1.825 1.672 1.94 4.405.3 6.208l-.163.172c-.067.066-.135.125-.188.172l.001.001-5.946 5.448a4.8 4.8 0 0 1-2.418 1.18q-.342.06-.69.071l-.035.002a4.85 4.85 0 0 1-3.252-1.125c-1.635.71-3.626.4-4.94-.912-1.666-1.664-1.61-4.307.125-5.905l2.15-1.98-2.15-1.978c-1.736-1.597-1.792-4.242-.126-5.905 1.282-1.28 3.209-1.606 4.82-.963a4.8 4.8 0 0 1 2.248-1.13l.057-.01a5 5 0 0 1 .813-.088zm-.023 1.7a3 3 0 0 0-.367.037 2.98 2.98 0 0 0-1.86 1.065l-.024.028a2.715 2.715 0 0 0 .321 3.705L13.013 12 9.23 15.464a2.714 2.714 0 0 0-.315 3.71l.085.1a3.013 3.013 0 0 0 2.218 1.028l.03-.001q.289.003.575-.048a3 3 0 0 0 1.5-.734l5.946-5.448.006-.005.005-.006c.054-.048.093-.082.125-.114a2.72 2.72 0 0 0-.086-3.974l-5.996-5.49a3.03 3.03 0 0 0-2.104-.785zm-4.2.975a2.66 2.66 0 0 0-2.47.692 2.41 2.41 0 0 0 .075 3.506l3.48 3.204-3.479 3.202a2.41 2.41 0 0 0-.076 3.506 2.66 2.66 0 0 0 2.537.676c-.872-1.713-.537-3.835.98-5.225L10.45 12 8.008 9.763c-1.476-1.352-1.832-3.4-1.046-5.087m6.18 3.89a.913.913 0 0 1 1.252 0l2.095 2.009c.841.806.841 2.113 0 2.92l-2.095 2.008a.913.913 0 0 1-1.252 0 .824.824 0 0 1 0-1.2l2.095-2.008a.36.36 0 0 0 0-.52l-2.095-2.008a.824.824 0 0 1 0-1.2" />,
  },
  hideSidePanel: {
    viewBox: "0 0 24 24",
    body: <><path d="M8.59,16.59L13.17,12L8.59,7.41L10,6l6,6l-6,6L8.59,16.59z" /><path fill="none" d="M0,0h24v24H0V0z" /></>,
  },
  minimize: {
    viewBox: "0 -960 960 960",
    body: <path d="M288-144v-72H672v72H288Z" />,
  },
  maximize: {
    viewBox: "0 -960 960 960",
    body: <path d="M192-744v-72H768v72H192Z" />,
  },
  expand: {
    viewBox: "0 -960 960 960",
    body: <path d="M144-144V-432h72v165L693-744H528v-72H816v288H744V-693L267-216H432v72H144Z" />,
  },
  composeClose: {
    viewBox: "0 -960 960 960",
    body: <path d="M291-240l-51-51L429-480L240-669l51-51L480-531L669-720l51,51L531-480L720-291l-51,51L480-429L291-240Z" />,
  },
  exitFullscreen: {
    viewBox: "0 -960 960 960",
    body: <path d="M147-96L96-147L357-408H192v-72H480v288H408V-357L147-96ZM480-480V-768h72v165L813-864l51,51L603-552H768v72H480Z" />,
  },
};

const aliases: Record<string, string> = {
  back: "arrowBack",
  unread: "mail",
  read: "mailOpen",
  delete: "trash",
  snooze: "clock",
  mailRead: "mailOpen",
  mailUnread: "mail",
  markUnread: "mail",
  markRead: "mailOpen",
  newWindow: "openInNew",
  open: "openInNew",
  paperclip: "attachment",
  file: "document",
  edit: "compose",
  pencil: "compose",
  folder: "move",
  folderOpen: "move",
  chevron: "chevronDown",
  scheduled: "clock",
  moreVertical: "more",
  filter: "tune",
  fullscreen: "expand",
  recipientRemove: "close",
  warning: "recipientWarning",
};
const warnedIcons = new Set<string>();

export function Icon({
  name,
  size = name === "pickerCheck" ? 14 : 20,
  className = "",
  style,
  layers = 1,
  rasterize = false,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  layers?: 1 | 2;
  rasterize?: boolean;
}) {
  const maskId = useId();
  const [layerImage, setLayerImage] = useState<{ key: string; url: string }>();
  const key = Object.hasOwn(aliases, name) ? aliases[name] : name;
  const bitmapSize = Object.hasOwn(bitmaps, key) ? bitmaps[key] : undefined;
  const vector = Object.hasOwn(vectors, key) ? vectors[key] : undefined;
  const colorImage = Object.hasOwn(fullColor, key) ? fullColor[key] : undefined;
  const known = bitmapSize !== undefined || vector !== undefined || colorImage !== undefined;
  useEffect(() => {
    if (!known && !warnedIcons.has(name)) {
      warnedIcons.add(name);
      console.warn(`Icon "${name}" has no captured Gmail glyph; an empty SVG is rendered.`);
    }
  }, [known, name]);

  useEffect(() => {
    if (!rasterize || bitmapSize === undefined) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      // Match source raster sampling before SVG reduction.
      const canvas = document.createElement("canvas");
      canvas.width = size * window.devicePixelRatio;
      canvas.height = size * window.devicePixelRatio;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (active) setLayerImage({ key, url: canvas.toDataURL("image/png") });
    };
    image.src = `/icons/${key}.png`;
    return () => { active = false; };
  }, [key, bitmapSize, rasterize, size]);

  // The source paints the selected-Inbox glyph twice (.qj background + ::before)
  // directly against the row surface. Two CSS background layers reproduce those
  // exact sequential paint ops; a canvas precomp quantizes the combined alpha
  // before compositing and stays ±1 off the capture (bench/pixel-diagnosis.json).
  const nativeLayers = layers === 2 && bitmapSize !== undefined;
  const extent = bitmapSize ?? colorImage?.size ?? 24;
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox={vector?.viewBox ?? `0 0 ${extent} ${extent}`}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={nativeLayers ? {
        ...style,
        backgroundImage: `url(/icons/${key}.png), url(/icons/${key}.png)`,
        backgroundSize: `${size}px ${size}px, ${size}px ${size}px`,
        backgroundPosition: "50% 50%, 50% 50%",
        backgroundRepeat: "no-repeat, no-repeat",
      } : style}
      data-icon={key}
      data-missing-icon={known ? undefined : name}
    >
      {nativeLayers ? null : bitmapSize !== undefined ? (
        <>
          <defs>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={bitmapSize}
              height={bitmapSize}
              style={{ maskType: "alpha" }}
            >
              <image href={rasterize && layerImage?.key === key ? layerImage.url : `/icons/${key}.png`} width={bitmapSize} height={bitmapSize} />
            </mask>
          </defs>
          <rect width={bitmapSize} height={bitmapSize} fill="currentColor" mask={`url(#${maskId})`} />
        </>
      ) : colorImage ? (
        <image href={`/icons/${colorImage.file}`} width={colorImage.imageSize ?? colorImage.size} height={colorImage.imageSize ?? colorImage.size} />
      ) : vector?.body}
    </svg>
  );
}
