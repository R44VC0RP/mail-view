const results = [];
const assert = (value, message) => {
  if (!value) throw new Error(message);
  results.push(message);
};
const inbox = () =>
  page
    .locator(".gmail-navigation")
    .getByRole("button", { name: /^Inbox/ })
    .click();
const row = (id) => page.locator(`[data-email-id="${id}"]`);
const toolbar = page.getByRole("toolbar", {
  name: "Mailbox toolbar",
  exact: true,
});
await page.goto("http://127.0.0.1:5174/#inbox");
await page.getByRole("grid", { name: "Messages", exact: true }).waitFor();
const baseline = await page.evaluate(() => ({
  mailbox: localStorage.getItem("gopen.mailbox"),
  filters: localStorage.getItem("gopen.filters"),
}));
try {
  assert(
    (await page.locator(".mail-row").count()) === 50,
    "Inbox paginates to 50 rows",
  );
  assert(
    (
      await page
        .locator(".gmail-navigation")
        .getByRole("button", { name: /^Inbox/ })
        .innerText()
    ).includes("255"),
    "Inbox starts with 255 unread",
  );
  assert(
    (await row("inbox-001").evaluate(
      (el) => el.getBoundingClientRect().height,
    )) === 40,
    "Measured inbox rows are 40px",
  );

  await row("inbox-001").hover();
  assert(
    await row("inbox-001")
      .getByRole("button", { name: "Archive", exact: true })
      .isVisible(),
    "Hover exposes Gmail quick actions",
  );
  await row("inbox-001")
    .getByRole("button", { name: "Star", exact: true })
    .click();
  await page
    .locator(".gmail-navigation")
    .getByRole("button", { name: "Starred", exact: true })
    .click();
  await row("inbox-001").waitFor();
  assert(
    (await row("inbox-001")
      .getByRole("button", { name: "Unstar", exact: true })
      .getAttribute("aria-pressed")) === "true",
    "Star action appears in Starred folder",
  );
  await inbox();

  await row("inbox-001").click({ button: "right" });
  const contextMenu = page.getByRole("menu", {
    name: "Message actions",
    exact: true,
  });
  await contextMenu.waitFor();
  assert(
    (await contextMenu.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )) === "rgb(255, 255, 255)",
    "Context menu is white in the dark theme",
  );
  assert(
    (await row("inbox-001").evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )) === "rgb(23, 78, 166)",
    "Selection uses Gmail blue",
  );
  await contextMenu
    .getByRole("menuitem", { name: "Mark as unread", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector('[data-email-id="inbox-001"]')
      ?.classList.contains("mail-row--unread"),
  );
  assert(
    (await row("inbox-001").getAttribute("aria-label")).startsWith("Unread"),
    "Right-click unread action updates the rendered row",
  );
  await page.locator(".mail-toolbar-range").click();
  await page.keyboard.press("Escape");

  await row("inbox-002").getByRole("checkbox").click();
  await row("inbox-005")
    .getByRole("checkbox")
    .click({ modifiers: ["Shift"] });
  assert(
    (await page.locator(".mail-row--selected").count()) === 4,
    "Shift-click selects a contiguous range",
  );
  await toolbar.getByRole("button", { name: "Labels", exact: true }).click();
  const labels = page.getByRole("menu", { name: "Label menu", exact: true });
  await labels
    .getByRole("menuitemcheckbox", { name: "Work", exact: true })
    .click();
  await labels
    .getByRole("menuitemcheckbox", { name: "Personal", exact: true })
    .click();
  await labels.getByRole("menuitem", { name: "Apply", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.mail-row--selected [title="Work"]').length ===
      4,
  );
  assert(
    (await page.locator('.mail-row--selected [title="Personal"]').count()) ===
      4,
    "Bulk label Apply updates all selected rows",
  );
  await toolbar.getByRole("button", { name: "Archive", exact: true }).click();
  await row("inbox-002").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await row("inbox-002").waitFor();
  assert(
    (await row("inbox-002").locator('[title="Work"]').count()) === 1,
    "Archive Undo restores conversations with their labels",
  );

  await toolbar.getByRole("button", { name: "Older", exact: true }).click();
  await row("inbox-051").waitFor();
  assert(
    (await toolbar.innerText()).includes("51"),
    "Older navigates to the next page",
  );
  await toolbar.getByRole("button", { name: "Newer", exact: true }).click();
  await row("inbox-001").waitFor();

  const search = page.getByRole("combobox", {
    name: "Search mail",
    exact: true,
  });
  await search.fill("from:drafts@example.com");
  await search.press("Enter");
  await page.waitForURL((url) => url.hash.includes("search/"));
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".mail-row-sender")].every((el) =>
      el.textContent.startsWith("crumb"),
    ),
  );
  assert(
    (await page.locator(".mail-row").count()) >= 6,
    "Gmail from: search filters actual rendered messages",
  );
  await search.fill("a-query-that-does-not-match-anything");
  await search.press("Enter");
  await page.getByText("No conversations found.", { exact: true }).waitFor();
  assert(
    (await page.locator(".mail-row").count()) === 0,
    "Search empty state is rendered",
  );
  await inbox();

  await page
    .getByRole("button", { name: "Advanced search options", exact: true })
    .click();
  const advanced = page.getByRole("form", {
    name: "Advanced search",
    exact: true,
  });
  await advanced
    .getByRole("textbox", { name: "From", exact: true })
    .fill("music@example.com");
  await advanced.click({ position: { x: 8, y: 8 } });
  assert(
    await advanced.isVisible(),
    "Advanced search remains open when clicking its padding",
  );
  await advanced.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForURL((url) => url.hash.includes("search/"));
  await page.waitForFunction(
    () => document.querySelectorAll(".mail-row").length === 1,
  );
  await row("inbox-002").waitFor();
  assert(
    (await page.locator(".mail-row").count()) === 1,
    "Advanced criteria submit a working Gmail query",
  );
  await inbox();

  await page
    .getByRole("button", { name: "Create new label", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "New label", exact: true });
  await dialog
    .getByRole("textbox", { name: "Label name", exact: true })
    .fill("Browser verification");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await page
    .getByRole("button", { name: "Browser verification", exact: true })
    .waitFor();
  assert(true, "Label creation dialog creates a navigable label");
  await page.reload();
  await page
    .getByRole("button", { name: "Browser verification", exact: true })
    .waitFor();
  assert(true, "Local mailbox changes survive reload");
} finally {
  await page.evaluate((saved) => {
    localStorage.setItem("gopen.mailbox", saved.mailbox);
    if (saved.filters === null) localStorage.removeItem("gopen.filters");
    else localStorage.setItem("gopen.filters", saved.filters);
  }, baseline);
  await page.goto("http://127.0.0.1:5174/#inbox");
  await page.reload();
}
return { passed: results.length, results };
