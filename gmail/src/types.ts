export type Folder = "inbox" | "sent" | "drafts" | "archive" | "spam" | "trash";
export type Density = "default" | "comfortable" | "compact";
export type Label = {
  id: string;
  name: string;
  color?: string;
  textColor?: string;
  parentId?: string;
  visible?: boolean;
  visibility?: "show" | "hide" | "unread";
  messageVisible?: boolean;
};
export type Attachment = {
  id: string;
  name: string;
  type: "pdf" | "document" | "image" | "calendar";
  size: string;
  url?: string;
  inline?: boolean;
  previewText?: string;
};
export type Address = { name: string; email: string };
export type ConfidentialSettings = {
  expiresAt: string;
  expiration: string;
  passcode: "none" | "sms";
};
export type Message = {
  id: string;
  from: Address;
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  date: string;
  body: string;
  format: "plain" | "html";
  attachments?: Attachment[];
};
export type Email = {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  date: string;
  time: string;
  unread: boolean;
  starred: boolean;
  important: boolean;
  folder: Folder;
  labels: string[];
  messages: Message[];
  attachments: Attachment[];
  snoozedUntil?: string;
  muted?: boolean;
  scheduledFor?: string;
  replyToId?: string;
  replyMode?: "reply" | "replyAll" | "forward";
  hasDraft?: boolean;
  sent?: boolean;
  confidential?: ConfidentialSettings;
  mailMerge?: boolean;
  category?: "primary" | "social" | "promotions" | "updates" | "forums" | "purchases";
};
export type MailAction =
  | "archive"
  | "delete"
  | "spam"
  | "read"
  | "unread"
  | "star"
  | "unstar"
  | "important"
  | "unimportant"
  | "snooze"
  | "unsnooze"
  | "move"
  | "label"
  | "unlabel"
  | "mute"
  | "reply"
  | "replyAll"
  | "forward"
  | "filterSender"
  | "print"
  | "newWindow"
  | "task"
  | "unsubscribe"
  | "newLabel"
  | "filter"
  | "deleteForever";
export type OnAction = (
  action: MailAction,
  ids: string[],
  value?: string,
) => void;
export type ComposeDraft = {
  id?: string;
  replyToId?: string;
  replyMode?: "reply" | "replyAll" | "forward";
  labels?: string[];
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  html?: string;
  confidential?: ConfidentialSettings;
  mailMerge?: boolean;
  attachments: Attachment[];
};
export type SelectMode =
  "all" | "none" | "read" | "unread" | "starred" | "unstarred";
