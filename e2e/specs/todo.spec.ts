describe("Todo CRUD", () => {
  // Unique prefix to avoid collision with persisted data
  const uid = Date.now().toString(36);

  async function waitForApp() {
    const input = await $("input[data-testid='new-todo-input']");
    await input.waitForExist({ timeout: 15000 });
    return input;
  }

  // Create a todo with a unique title, verify it appears in the list
  async function createTodo(label: string) {
    const title = `${uid}-${label}`;
    const input = await waitForApp();
    await input.click();
    await browser.keys(title);
    await browser.keys("Enter");
    await browser.pause(800);
    return title;
  }

  // Find a todo by its exact title text content
  async function findTodoByTitle(title: string) {
    const titles = await $$(`[data-testid^="todo-title-"]`);
    for (const el of titles) {
      const text = await el.getText();
      if (text.includes(title)) return el;
    }
    return null;
  }

  it("should create a todo", async () => {
    const title = await createTodo("create");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
  });

  it("should complete a todo", async () => {
    const title = await createTodo("complete");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    // Click the checkbox inside the same todo item
    const parent = await el.parentElement();
    const checkbox = await parent.$(`[data-testid^="todo-complete-"]`);
    await checkbox.click();
    await browser.pause(500);
  });

  it("should search todos", async () => {
    const title = await createTodo("search-target");
    const searchInput = await $("input[data-testid='todo-search-input']");
    await searchInput.click();
    await browser.keys("search-target");
    await browser.pause(500);
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    // Clear search
    const val = await searchInput.getValue();
    for (let i = 0; i < (val as string).length; i++) {
      await browser.keys("Backspace");
    }
  });

  it("should filter by status", async () => {
    const filterBtn = await $("[data-testid='status-filter-completed']");
    await filterBtn.click();
    await browser.pause(500);
    const allBtn = await $("[data-testid='status-filter-all']");
    await allBtn.click();
  });

  it("should delete a todo", async () => {
    const title = await createTodo("delete-me");
    const el = await findTodoByTitle(title);
    expect(el).not.toBeNull();
    const parent = await el.parentElement();
    const menuBtn = await parent.$(`[data-testid^="todo-menu-"]`);
    await menuBtn.click();
    const deleteBtn = await $(`[data-testid^="todo-delete-"]`);
    await deleteBtn.waitForClickable({ timeout: 3000 });
    await deleteBtn.click();
    await browser.pause(500);
  });
});
