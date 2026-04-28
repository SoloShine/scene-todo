describe("Recurrence & Reminders", () => {
  const uid = Date.now().toString(36);

  async function waitForApp() {
    const input = await $("input[data-testid='new-todo-input']");
    await input.waitForExist({ timeout: 15000 });
    return input;
  }

  async function createTodo(label: string) {
    const title = `${uid}-${label}`;
    const input = await waitForApp();
    await input.click();
    await browser.keys(title);
    await browser.keys("Enter");
    await browser.pause(800);
    return title;
  }

  async function findTodoByTitle(title: string) {
    const titles = await $$(`[data-testid^="todo-title-"]`);
    for (const el of titles) {
      const text = await el.getText();
      if (text.includes(title)) return el;
    }
    return null;
  }

  async function getTodoId(el: WebdriverIO.Element): Promise<string | null> {
    const testid = await el.getAttribute("data-testid");
    const match = testid?.match(/todo-title-(\d+)/);
    return match ? match[1] : null;
  }

  async function openDetailEditor(id: string) {
    const menuBtn = await $(`button[data-testid='todo-menu-${id}']`);
    await browser.execute((btn: HTMLButtonElement) => {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }, menuBtn);
    await menuBtn.click();
    await browser.pause(300);

    const detailBtn = await $("button=分组/标签");
    await detailBtn.waitForClickable({ timeout: 3000 });
    await detailBtn.click();
    await browser.pause(500);
  }

  // Click the new-todo-input at the very top of the page to close the popover
  async function closeDetailEditor() {
    const input = await $("input[data-testid='new-todo-input']");
    await input.click();
    await browser.pause(800);
  }

  async function resetFilters() {
    try { await $("[data-testid='status-filter-all']").click(); } catch {}
    try { await $("[data-testid='priority-filter-all']").click(); } catch {}
    const searchInput = await $("input[data-testid='todo-search-input']");
    try {
      const val = await searchInput.getValue();
      if (val) {
        await searchInput.click();
        for (let i = 0; i < (val as string).length; i++) await browser.keys("Backspace");
      }
    } catch {}
    await browser.pause(300);
  }

  async function setDailyRecurrence(id: string) {
    await openDetailEditor(id!);
    const simplifiedBtn = await $("[data-testid='recurrence-mode-simplified']");
    await simplifiedBtn.click();
    await browser.pause(300);
    const saveBtn = await $("[data-testid='recurrence-save']");
    await saveBtn.click();
    await browser.pause(3000);
    await closeDetailEditor();
    await browser.pause(2000);
  }

  async function addDefaultReminder(id: string) {
    await openDetailEditor(id!);
    const addBtn = await $("[data-testid='reminder-add-btn']");
    await addBtn.click();
    await browser.pause(500);
    const saveBtn = await $("[data-testid='reminder-save']");
    await saveBtn.click();
    await browser.pause(2000);
    await closeDetailEditor();
    await browser.pause(500);
  }

  // --- Recurrence Tests ---

  it("should set daily recurrence via simplified mode", async () => {
    await resetFilters();
    const title = await createTodo("rec-daily");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    await setDailyRecurrence(id!);

    const indicator = await $(`[data-testid='recurrence-indicator-${id}']`);
    await indicator.waitForExist({ timeout: 10000 });
  });

  it("should set weekly recurrence with specific days", async () => {
    await resetFilters();
    const title = await createTodo("rec-weekly");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    await openDetailEditor(id!);

    const simplifiedBtn = await $("[data-testid='recurrence-mode-simplified']");
    await simplifiedBtn.click();
    await browser.pause(300);

    const weeklyBtn = await $("button=每周");
    await weeklyBtn.click();
    await browser.pause(300);

    // Click Monday checkbox via its label
    const labels = await $$("label");
    for (const label of labels) {
      const text = (await label.getText()).trim();
      if (text === "一") {
        await label.click();
        break;
      }
    }
    await browser.pause(300);

    const saveBtn = await $("[data-testid='recurrence-save']");
    await saveBtn.click();
    await browser.pause(3000);

    await closeDetailEditor();
    await browser.pause(2000);

    const indicator = await $(`[data-testid='recurrence-indicator-${id}']`);
    await indicator.waitForExist({ timeout: 10000 });
  });

  it("should set recurrence via RRULE mode with validation", async () => {
    await resetFilters();
    const title = await createTodo("rec-rrule");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    await openDetailEditor(id!);

    const rruleBtn = await $("[data-testid='recurrence-mode-rrule']");
    await rruleBtn.click();
    await browser.pause(300);

    const input = await $("[data-testid='recurrence-rrule-input']");
    await input.click();
    await browser.keys("FREQ=DAILY;INTERVAL=2");
    await browser.pause(1500);

    // Verify validation result shows green description
    const validText = await $("p.text-green-600");
    await validText.waitForExist({ timeout: 5000 });

    const saveBtn = await $("[data-testid='recurrence-rrule-save']");
    await saveBtn.click();
    await browser.pause(3000);

    await closeDetailEditor();
    await browser.pause(2000);

    const indicator = await $(`[data-testid='recurrence-indicator-${id}']`);
    await indicator.waitForExist({ timeout: 10000 });
  });

  it("should reject invalid RRULE input", async () => {
    await resetFilters();
    const title = await createTodo("rec-invalid");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    await openDetailEditor(id!);

    const rruleBtn = await $("[data-testid='recurrence-mode-rrule']");
    await rruleBtn.click();
    await browser.pause(300);

    const input = await $("[data-testid='recurrence-rrule-input']");
    await input.click();
    await browser.keys("INVALID_RULE");
    await browser.pause(1500);

    // Verify error appears
    const errorText = await $("p.text-destructive");
    await errorText.waitForExist({ timeout: 5000 });

    // Save button should be disabled
    const saveBtn = await $("[data-testid='recurrence-rrule-save']");
    const disabled = await saveBtn.getAttribute("disabled");
    expect(disabled).not.toBeNull();

    await closeDetailEditor();
  });

  it("should complete recurring todo and generate next instance", async () => {
    await resetFilters();
    const title = await createTodo("rec-complete");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    // Set daily recurrence
    await setDailyRecurrence(id!);

    // Verify indicator before completing
    const indicator = await $(`[data-testid='recurrence-indicator-${id}']`);
    await indicator.waitForExist({ timeout: 10000 });

    // Complete the todo
    const checkbox = await $(`button[data-testid='todo-complete-${id}']`);
    await checkbox.click();
    await browser.pause(2000);

    // Search for the title to find both completed and new instance
    const searchInput = await $("input[data-testid='todo-search-input']");
    await searchInput.click();
    await browser.keys("rec-complete");
    await browser.pause(1000);

    // Should find at least two todos with the title (completed + new instance)
    const titles = await $$(`[data-testid^="todo-title-"]`);
    let foundCount = 0;
    for (const t of titles) {
      const text = await t.getText();
      if (text.includes("rec-complete")) foundCount++;
    }
    expect(foundCount).toBeGreaterThanOrEqual(2);

    // Clear search
    const val = await searchInput.getValue();
    for (let i = 0; i < (val as string).length; i++) await browser.keys("Backspace");
    await browser.pause(300);
  });

  it("should remove recurrence from a todo", async () => {
    await resetFilters();
    const title = await createTodo("rec-remove");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    // Set recurrence first
    await setDailyRecurrence(id!);

    // Verify indicator exists
    let indicator = await $(`[data-testid='recurrence-indicator-${id}']`);
    await indicator.waitForExist({ timeout: 10000 });

    // Open detail and remove
    await openDetailEditor(id!);
    const offBtn = await $("[data-testid='recurrence-mode-off']");
    await offBtn.click();
    await browser.pause(300);

    const removeBtn = await $("[data-testid='recurrence-remove']");
    await removeBtn.waitForExist({ timeout: 5000 });
    // Use Actions API for a reliable click through React's event delegation
    await browser.action("pointer")
      .move({ origin: removeBtn })
      .down()
      .up()
      .perform();
    await browser.pause(3000);

    await closeDetailEditor();
    await browser.pause(2000);

    // Verify indicator gone
    indicator = await $(`[data-testid='recurrence-indicator-${id}']`);
    const exists = await indicator.isExisting();
    expect(exists).toBe(false);
  });

  // --- Reminder Tests ---

  it("should add a relative reminder with preset", async () => {
    await resetFilters();
    const title = await createTodo("rem-relative");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    await openDetailEditor(id!);

    const addBtn = await $("[data-testid='reminder-add-btn']");
    await addBtn.click();
    await browser.pause(500);

    // Relative type is default — click "30分钟" preset
    const preset30 = await $("button=30分钟");
    await preset30.click();
    await browser.pause(300);

    const saveBtn = await $("[data-testid='reminder-save']");
    await saveBtn.click();
    await browser.pause(2000);

    // Verify reminder appears in list
    const items = await $$("[data-testid^='reminder-item-']");
    expect(items.length).toBeGreaterThan(0);

    await closeDetailEditor();
  });

  it("should add an absolute reminder", async () => {
    await resetFilters();
    const title = await createTodo("rem-absolute");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    await openDetailEditor(id!);

    const addBtn = await $("[data-testid='reminder-add-btn']");
    await addBtn.click();
    await browser.pause(500);

    // Switch to absolute type
    const absoluteBtn = await $("button=固定时间");
    await absoluteBtn.click();
    await browser.pause(300);

    // Set datetime via JS (datetime-local inputs don't accept keyboard input well)
    const timeInput = await $("input[type='datetime-local']");
    await browser.execute((el: HTMLInputElement) => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      )?.set;
      nativeInputValueSetter?.call(el, "2026-12-31T09:00");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, timeInput);
    await browser.pause(300);

    const saveBtn = await $("[data-testid='reminder-save']");
    await saveBtn.click();
    await browser.pause(2000);

    // Verify reminder appears
    const items = await $$("[data-testid^='reminder-item-']");
    expect(items.length).toBeGreaterThan(0);

    await closeDetailEditor();
  });

  it("should delete a reminder", async () => {
    await resetFilters();
    const title = await createTodo("rem-delete");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    // Add a reminder first
    await openDetailEditor(id!);
    const addBtn = await $("[data-testid='reminder-add-btn']");
    await addBtn.click();
    await browser.pause(500);
    const saveBtn = await $("[data-testid='reminder-save']");
    await saveBtn.click();
    await browser.pause(2000);

    let items = await $$("[data-testid^='reminder-item-']");
    const countBefore = items.length;
    expect(countBefore).toBeGreaterThan(0);

    // Delete the first reminder
    const deleteBtn = await $("[data-testid^='reminder-delete-']");
    await deleteBtn.click();
    await browser.pause(1000);

    items = await $$("[data-testid^='reminder-item-']");
    expect(items.length).toBe(countBefore - 1);

    await closeDetailEditor();
  });

  it("should toggle reminder enabled state", async () => {
    await resetFilters();
    const title = await createTodo("rem-toggle");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    // Add a reminder
    await openDetailEditor(id!);
    const addBtn = await $("[data-testid='reminder-add-btn']");
    await addBtn.click();
    await browser.pause(500);
    const saveBtn = await $("[data-testid='reminder-save']");
    await saveBtn.click();
    await browser.pause(2000);

    // Toggle — uncheck the reminder
    const toggleBtn = await $("[data-testid^='reminder-toggle-']");
    await toggleBtn.click();
    await browser.pause(500);

    // Verify strikethrough appears on the reminder label
    const strikeSpan = await $("span.line-through");
    await strikeSpan.waitForExist({ timeout: 5000 });

    // Toggle back — re-enable
    await toggleBtn.click();
    await browser.pause(500);

    await closeDetailEditor();
  });

  // --- Abandoned Status Test ---

  it("should show abandoned status filter option", async () => {
    await resetFilters();
    const abandonedBtn = await $("[data-testid='status-filter-abandoned']");
    await abandonedBtn.waitForExist({ timeout: 5000 });
    const text = await abandonedBtn.getText();
    expect(text).toBe("已放弃");

    // Click the filter — should not throw
    await abandonedBtn.click();
    await browser.pause(300);

    // Reset
    await $("[data-testid='status-filter-all']").click();
    await browser.pause(300);
  });
});
