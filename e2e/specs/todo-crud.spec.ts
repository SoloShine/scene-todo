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

  async function enterEditMode(id: string) {
    const menuBtn = await $(`button[data-testid='todo-menu-${id}']`);
    await browser.execute((btn: HTMLButtonElement) => {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }, menuBtn);
    await menuBtn.click();
    await browser.pause(300);

    const editBtn = await $("button=编辑");
    await editBtn.waitForClickable({ timeout: 3000 });
    await editBtn.click();
    await browser.pause(500);

    const editInput = await $(`input[data-testid='todo-edit-title-${id}']`);
    await editInput.waitForExist({ timeout: 3000 });
    return editInput;
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

  // Expand collapsed group by label text
  async function expandGroup(label: string) {
    await browser.execute((lbl: string) => {
      const btns = document.querySelectorAll("button");
      for (const btn of btns) {
        if (btn.textContent?.includes(lbl)) { btn.click(); break; }
      }
    }, label);
    await browser.pause(300);
  }

  // TC-01.01
  it("should create a todo", async () => {
    await resetFilters();
    const title = await createTodo("tc0101-create");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
  });

  // TC-01.02
  it("should edit a todo title", async () => {
    await resetFilters();
    const title = await createTodo("tc0102-edit");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    const editInput = await enterEditMode(id!);

    const currentVal = await editInput.getValue();
    for (let i = 0; i < (currentVal as string).length; i++) {
      await browser.keys("Backspace");
    }
    await browser.keys(`${uid}-tc0102-edited`);

    const searchInput = await $("input[data-testid='todo-search-input']");
    await searchInput.click();
    await browser.pause(1000);

    const editedEl = await findTodoByTitle(`${uid}-tc0102-edited`);
    expect(editedEl).not.toBeNull();
  });

  // TC-01.03 — priority only (date tested separately)
  it("should set priority", async () => {
    await resetFilters();
    const title = await createTodo("tc0103-prio");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    await enterEditMode(id!);

    // Verify the edit mode priority buttons exist and click "高"
    const highBtn = await $(`button[data-testid='todo-priority-high-${id}']`);
    await highBtn.waitForClickable({ timeout: 3000 });
    await highBtn.click();
    await browser.pause(500);

    // Verify button got the active style
    const cls = await highBtn.getAttribute("class");
    expect(cls).toContain("font-medium");

    // Save by clicking outside
    const searchInput = await $("input[data-testid='todo-search-input']");
    await searchInput.click();
    await browser.pause(1500);

    // Re-query and verify
    const updatedEl = await findTodoByTitle("tc0103-prio");
    expect(updatedEl).not.toBeNull();
    const text = await updatedEl!.getText();
    expect(text).toContain("高");
  });

  // TC-01.04
  it("should complete a todo", async () => {
    await resetFilters();
    const title = await createTodo("tc0104-complete");
    let el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    const checkbox = await $(`button[data-testid='todo-complete-${id}']`);
    await checkbox.click();
    await browser.pause(1000);

    // Show completed + expand group
    await $("[data-testid='status-filter-completed']").click();
    await browser.pause(500);
    await expandGroup("已结束");

    el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const spanEl = await el!.$("span");
    const cls = await spanEl.getAttribute("class");
    expect(cls).toContain("line-through");
  });

  // TC-01.05
  it("should uncomplete a todo", async () => {
    await resetFilters();
    const title = await createTodo("tc0105-uncomplete");
    let el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    // Complete
    let checkbox = await $(`button[data-testid='todo-complete-${id}']`);
    await checkbox.click();
    await browser.pause(1000);

    // The todo moved to collapsed "已结束" group — click checkbox via JS
    // First make sure the completed group toggle is clicked to expand
    await browser.execute(() => {
      const btns = document.querySelectorAll("button");
      for (const btn of btns) {
        const spans = btn.querySelectorAll("span");
        for (const s of spans) {
          if (s.textContent?.includes("已结束") || s.textContent?.includes("已结束")) {
            // Check if this is a group toggle (has chevron icon)
            if (btn.querySelector("svg")) {
              btn.click();
              return true;
            }
          }
        }
      }
      return false;
    });
    await browser.pause(500);

    // Find checkbox — may need to retry
    let found = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        checkbox = await $(`button[data-testid='todo-complete-${id}']`);
        await checkbox.waitForExist({ timeout: 2000 });
        found = true;
        break;
      } catch {
        // Try expanding again
        await browser.execute(() => {
          const btns = document.querySelectorAll("button");
          for (const btn of btns) {
            if (btn.textContent?.includes("已结束") && btn.querySelector("svg")) {
              btn.click();
              break;
            }
          }
        });
        await browser.pause(300);
      }
    }

    if (!found) {
      // Fallback: use status filter
      await $("[data-testid='status-filter-completed']").click();
      await browser.pause(500);
      checkbox = await $(`button[data-testid='todo-complete-${id}']`);
    }

    await checkbox.click();
    await browser.pause(1500);

    // Reset and verify
    await resetFilters();
    el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const spanEl = await el!.$("span");
    const cls = await spanEl.getAttribute("class");
    expect(cls).not.toContain("line-through");
  });

  // TC-01.06
  it("should create a subtask", async () => {
    await resetFilters();
    const title = await createTodo("tc0106-parent");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    const addSubBtn = await $(`button[data-testid='todo-add-subtask-${id}']`);
    await browser.execute((btn: HTMLButtonElement) => {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }, addSubBtn);
    await browser.pause(200);
    await addSubBtn.click();
    await browser.pause(500);

    const subInput = await $(`input[data-testid='todo-subtask-input-${id}']`);
    await subInput.waitForExist({ timeout: 3000 });
    await subInput.click();
    await browser.keys(`${uid}-tc0106-subtask1`);
    await browser.keys("Enter");
    await browser.pause(800);

    const subEl = await findTodoByTitle(`${uid}-tc0106-subtask1`);
    expect(subEl).not.toBeNull();
  });

  // TC-01.07
  it("should delete a todo with confirmation", async () => {
    await resetFilters();
    const title = await createTodo("tc0107-delete");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const id = await getTodoId(el!);

    const menuBtn = await $(`button[data-testid='todo-menu-${id}']`);
    await browser.execute((btn: HTMLButtonElement) => {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }, menuBtn);
    await menuBtn.click();
    await browser.pause(300);

    const deleteBtn = await $(`button[data-testid='todo-delete-${id}']`);
    await deleteBtn.waitForClickable({ timeout: 3000 });
    await deleteBtn.click();
    await browser.pause(500);

    // Cancel first
    const cancelBtn = await $("button=取消");
    await cancelBtn.waitForClickable({ timeout: 3000 });
    await cancelBtn.click();
    await browser.pause(500);

    const elAfterCancel = await findTodoByTitle(title);
    expect(elAfterCancel).not.toBeNull();

    // Delete and confirm
    await browser.execute((btn: HTMLButtonElement) => {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }, menuBtn);
    await menuBtn.click();
    await browser.pause(300);

    const deleteBtn2 = await $(`button[data-testid='todo-delete-${id}']`);
    await deleteBtn2.waitForClickable({ timeout: 3000 });
    await deleteBtn2.click();
    await browser.pause(500);

    const confirmBtn = await $("button=删除");
    await confirmBtn.waitForClickable({ timeout: 3000 });
    await confirmBtn.click();
    await browser.pause(800);

    const elAfterDelete = await findTodoByTitle(title);
    expect(elAfterDelete).toBeNull();
  });
});
