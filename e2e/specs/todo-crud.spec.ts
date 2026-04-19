describe("TC-01 Todo CRUD", () => {
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

  // TC-01.01
  it("should create a todo", async () => {
    const title = await createTodo("tc0101-create");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
  });

  // TC-01.02
  it("should edit a todo title", async () => {
    const title = await createTodo("tc0102-edit");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();

    // Double-click to enter edit mode
    await el.doubleClick();
    await browser.pause(500);

    const id = await getTodoId(el);
    const editInput = await $(`input[data-testid='todo-edit-title-${id}']`);
    await editInput.waitForExist({ timeout: 3000 });

    // Clear and type new title
    const currentVal = await editInput.getValue();
    for (let i = 0; i < (currentVal as string).length; i++) {
      await browser.keys("Backspace");
    }
    await browser.keys(`${uid}-tc0102-edited`);

    // Click outside to save
    const header = await $("header");
    if (header) await header.click();
    await browser.pause(800);

    const editedEl = await findTodoByTitle(`${uid}-tc0102-edited`);
    expect(editedEl).not.toBeNull();
  });

  // TC-01.03
  it("should set priority and due date", async () => {
    const title = await createTodo("tc0103-prio");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();

    // Double-click to enter edit mode
    await el.doubleClick();
    await browser.pause(500);

    const id = await getTodoId(el);
    const highBtn = await $(`button[data-testid='todo-priority-high-${id}']`);
    await highBtn.waitForClickable({ timeout: 3000 });
    await highBtn.click();
    await browser.pause(300);

    // Set due date
    const dueInput = await $(`input[data-testid='todo-due-date-${id}']`);
    await dueInput.waitForExist({ timeout: 3000 });
    // Set a date value (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}T23:59`;
    await dueInput.setValue(dateStr);
    await browser.pause(300);

    // Click outside to save
    const header = await $("header");
    if (header) await header.click();
    await browser.pause(800);

    // Verify priority label "高" is visible in the item
    const updatedEl = await findTodoByTitle("tc0103-prio");
    expect(updatedEl).not.toBeNull();
    const parent = await updatedEl.parentElement();
    const text = await parent.getText();
    expect(text).toContain("高");
  });

  // TC-01.04
  it("should complete a todo", async () => {
    const title = await createTodo("tc0104-complete");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();

    const id = await getTodoId(el);
    const checkbox = await $(`button[data-testid='todo-complete-${id}']`);
    await checkbox.click();
    await browser.pause(500);

    // Verify line-through style
    const titleSpan = await el.$("span");
    const cls = await titleSpan.getAttribute("class");
    expect(cls).toContain("line-through");
  });

  // TC-01.05
  it("should uncomplete a todo", async () => {
    const title = await createTodo("tc0105-uncomplete");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();

    const id = await getTodoId(el);
    const checkbox = await $(`button[data-testid='todo-complete-${id}']`);

    // Complete first
    await checkbox.click();
    await browser.pause(500);

    // Uncomplete
    await checkbox.click();
    await browser.pause(500);

    // Verify line-through is gone
    const titleSpan = await el.$("span");
    const cls = await titleSpan.getAttribute("class");
    expect(cls).not.toContain("line-through");
  });

  // TC-01.06
  it("should create a subtask", async () => {
    const title = await createTodo("tc0106-parent");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();

    const id = await getTodoId(el);
    const parent = await el.parentElement();

    // Hover over the todo item to reveal the + button
    await parent.moveTo();
    await browser.pause(300);

    const addSubBtn = await $(`button[data-testid='todo-add-subtask-${id}']`);
    await addSubBtn.waitForClickable({ timeout: 3000 });
    await addSubBtn.click();
    await browser.pause(500);

    // Type subtask title
    const subInput = await $(`input[data-testid='todo-subtask-input-${id}']`);
    await subInput.waitForExist({ timeout: 3000 });
    await subInput.click();
    await browser.keys(`${uid}-tc0106-subtask1`);
    await browser.keys("Enter");
    await browser.pause(800);

    // Verify subtask appears
    const subEl = await findTodoByTitle(`${uid}-tc0106-subtask1`);
    expect(subEl).not.toBeNull();
  });

  // TC-01.07
  it("should delete a todo with confirmation", async () => {
    const title = await createTodo("tc0107-delete");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();

    const id = await getTodoId(el);
    const parent = await el.parentElement();

    // Open menu
    const menuBtn = await parent.$(`button[data-testid='todo-menu-${id}']`);
    await menuBtn.click();
    await browser.pause(300);

    // Click delete
    const deleteBtn = await $(`button[data-testid='todo-delete-${id}']`);
    await deleteBtn.waitForClickable({ timeout: 3000 });
    await deleteBtn.click();
    await browser.pause(500);

    // Confirm dialog should appear — click Cancel
    const cancelBtn = await $("button=取消");
    await cancelBtn.waitForClickable({ timeout: 3000 });
    await cancelBtn.click();
    await browser.pause(500);

    // Todo should still exist
    const elAfterCancel = await findTodoByTitle(title);
    expect(elAfterCancel).not.toBeNull();

    // Delete again and confirm
    const menuBtn2 = await parent.$(`button[data-testid='todo-menu-${id}']`);
    await menuBtn2.click();
    await browser.pause(300);

    const deleteBtn2 = await $(`button[data-testid='todo-delete-${id}']`);
    await deleteBtn2.waitForClickable({ timeout: 3000 });
    await deleteBtn2.click();
    await browser.pause(500);

    const confirmBtn = await $("button=删除");
    await confirmBtn.waitForClickable({ timeout: 3000 });
    await confirmBtn.click();
    await browser.pause(800);

    // Todo should be gone
    const elAfterDelete = await findTodoByTitle(title);
    expect(elAfterDelete).toBeNull();
  });
});
