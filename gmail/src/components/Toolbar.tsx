import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import type { Email, Label, OnAction, SelectMode } from "../types";
import { Icon } from "../ui/Icon";
import { MailMenu } from "./MailMenus";
import type { MailMenuKind, MenuPosition } from "./MailMenus";
import "./mail-list.css";
import "./chrome-fidelity.css";

export type ToolbarProps = {
  selectedEmails: Email[];
  allSelected: boolean;
  someSelected: boolean;
  count: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onSelectAll: () => void;
  onSelectBy: (mode: SelectMode) => void;
  onRefresh: () => void;
  onAction: OnAction;
  labels: Label[];
  thread?: Email;
  onBack?: () => void;
  view?: string;
  onManageLabels?: () => void;
  sortControl?: ReactNode;
};

export function Toolbar({
  selectedEmails,
  allSelected,
  someSelected,
  count,
  page,
  pageSize,
  onPage,
  onSelectAll,
  onSelectBy,
  onRefresh,
  onAction,
  labels,
  thread,
  onBack,
  view,
  onManageLabels,
  sortControl,
}: ToolbarProps) {
  const [menu, setMenu] = useState<{
    kind: MailMenuKind;
    position: MenuPosition;
  } | null>(null);
  const activeEmails = thread ? [thread] : selectedEmails;
  const ids = activeEmails.map((email) => email.id);
  const hasUnread = activeEmails.some((email) => email.unread);
  const lastPage = thread
    ? Math.max(0, count - 1)
    : Math.max(0, Math.ceil(count / pageSize) - 1);
  const start = count ? page * pageSize + 1 : 0;
  const end = Math.min((page + 1) * pageSize, count);
  const openMenu = (
    kind: MailMenuKind,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    if (kind === "pagination" && menu?.kind === "pagination") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const anchor = event.currentTarget;
    setMenu((current) =>
      current?.kind === kind
        ? null
        : { kind, position: {
            x: kind === "select"
              ? anchor.parentElement?.getBoundingClientRect().left ?? rect.left
              : kind === "pagination" ? rect.left : activeEmails.length ? rect.left + (rect.width - 20) / 2 : rect.left + rect.width / 2,
            y: kind === "pagination" ? rect.bottom : rect.top + (rect.height + 20) / 2,
            anchor,
          } },
    );
  };

  return (
    <div
      className={`mail-toolbar${activeEmails.length && !thread ? " mail-toolbar--selection" : ""}`}
      role="toolbar"
      aria-label={thread ? "Conversation toolbar" : "Mailbox toolbar"}
    >
      <div className="mail-toolbar-actions">
        {thread ? (
          <button
            type="button"
            className="icon-button mail-toolbar-button"
            title="Back to inbox"
            aria-label="Back to inbox"
            onClick={onBack}
          >
            <Icon name="arrowBack" size={20} />
          </button>
        ) : (
          <div className="mail-toolbar-select">
            <button
              type="button"
              className="icon-button mail-toolbar-checkbox"
              role="checkbox"
              aria-checked={allSelected ? true : someSelected ? "mixed" : false}
              title="Select"
              aria-label="Select all messages"
              onClick={onSelectAll}
            >
              <Icon
                name={
                  allSelected
                    ? "checkboxChecked"
                    : someSelected
                      ? "checkboxMixed"
                      : "checkbox"
                }
                size={20}
              />
            </button>
            <button
              type="button"
              className="mail-toolbar-dropdown"
              title="Select options"
              aria-label="Select options"
              aria-haspopup="menu"
              aria-expanded={menu?.kind === "select"}
              onClick={(event) => openMenu("select", event)}
            >
              <Icon name="arrowDropDown" size={20} />
            </button>
          </div>
        )}
        {activeEmails.length ? (
          <>
            {view === "drafts" ? (
              <button
                type="button"
                className="mail-toolbar-discard"
                onClick={() => onAction("delete", ids)}
              >
                Discard drafts
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="icon-button mail-toolbar-button"
                  title="Archive"
                  aria-label="Archive"
                  onClick={() => onAction("archive", ids)}
                >
                  <Icon name="archive" size={20} />
                </button>
                <button
                  type="button"
                  className="icon-button mail-toolbar-button"
                  title="Report spam"
                  aria-label="Report spam"
                  onClick={() => onAction("spam", ids)}
                >
                  <Icon name="spam" size={20} />
                </button>
                <button
                  type="button"
                  className="icon-button mail-toolbar-button"
                  title="Delete"
                  aria-label="Delete"
                  onClick={() => onAction("delete", ids)}
                >
                  <Icon name="trash" size={20} />
                </button>
              </>
            )}
            <span className="mail-toolbar-divider" />
            <button
              type="button"
              className="icon-button mail-toolbar-button"
              title={hasUnread ? "Mark as read" : "Mark as unread"}
              aria-label={hasUnread ? "Mark as read" : "Mark as unread"}
              onClick={() => onAction(hasUnread ? "read" : "unread", ids)}
            >
              <Icon
                    name={hasUnread ? "mailOpen" : "mailUnreadToolbar"}
                size={20}
              />
            </button>
            <button
              type="button"
              className="icon-button mail-toolbar-button"
              title="Snooze"
              aria-label="Snooze"
              aria-haspopup="menu"
              aria-expanded={menu?.kind === "snooze"}
              onClick={(event) => openMenu("snooze", event)}
            >
              <Icon name="clock" size={20} />
            </button>
            <button
              type="button"
              className="icon-button mail-toolbar-button mail-toolbar-task"
              title="Add to Tasks"
              aria-label="Add to Tasks"
              onClick={() => onAction("task", ids)}
            >
              <Icon name="task" size={20} />
            </button>
            <span className="mail-toolbar-divider" />
            <button
              type="button"
              className="icon-button mail-toolbar-button"
              title="Move to"
              aria-label="Move to"
              aria-haspopup="menu"
              aria-expanded={menu?.kind === "move"}
              onClick={(event) => openMenu("move", event)}
            >
              <Icon name="move" size={20} />
            </button>
            <button
              type="button"
              className="icon-button mail-toolbar-button"
              title="Labels"
              aria-label="Labels"
              aria-haspopup="menu"
              aria-expanded={menu?.kind === "label"}
              onClick={(event) => openMenu("label", event)}
            >
              <Icon name="label" size={20} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="icon-button mail-toolbar-button"
            title="Refresh"
            aria-label="Refresh"
            onClick={onRefresh}
          >
            <Icon name="refresh" size={20} />
          </button>
        )}
        <button
          type="button"
          className="icon-button mail-toolbar-button"
          title="More"
          aria-label="More"
          aria-haspopup="menu"
          aria-expanded={menu?.kind === "more"}
          onClick={(event) => openMenu("more", event)}
        >
          <Icon name="more" size={20} />
        </button>
      </div>
      <div className="mail-toolbar-pagination">
        {sortControl}
        {thread ? (
          <span className="mail-toolbar-range">
            {Math.min(page + 1, count)} of {count.toLocaleString()}
          </span>
        ) : <button
          type="button"
          className="mail-toolbar-range"
          aria-haspopup="menu"
          aria-expanded={menu?.kind === "pagination"}
          aria-disabled={menu?.kind === "pagination"}
          onClick={(event) => openMenu("pagination", event)}
        >
          {`${start.toLocaleString()}\u2013${end.toLocaleString()} of ${count.toLocaleString()}`}
        </button>}
        <button
          type="button"
          className="icon-button mail-toolbar-button"
          title="Newer"
          aria-label="Newer"
          disabled={page <= 0}
          onClick={() => onPage(page - 1)}
        >
          <Icon name="chevronLeft" size={20} />
        </button>
        <button
          type="button"
          className="icon-button mail-toolbar-button"
          title="Older"
          aria-label="Older"
          disabled={page >= lastPage}
          onClick={() => onPage(page + 1)}
        >
          <Icon name="chevronRight" size={20} />
        </button>
      </div>
      {menu && (
        <MailMenu
          key={menu.kind}
          kind={menu.kind}
          position={menu.position}
          emails={activeEmails}
          labels={labels}
          onAction={onAction}
          onSelectBy={onSelectBy}
          onPage={onPage}
          page={page}
          lastPage={lastPage}
          onManageLabels={onManageLabels}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

export default Toolbar;
