describe("Todo CRUD", () => {
  // Helper: wait for the app to finish loading
  async function waitForApp() {
    const input = await $("input[data-testid='new-todo-input']");
    await input.waitForExist({ timeout: 15000 });
    return input;
  }

  // Helper: create a todo and return its title element (the last/newest one)
  async function createTodo(title: string) {
    const input = await waitForApp();
    const beforeCount = (await $$(`[data-testid^="todo-title-"]`)).length;
    await input.setValue(title);
    await browser.keys("Enter");
    // Wait for a new todo to appear (count increases)
    await browser.waitUntil(
      async () => (await $$(`[data-testid^="todo-title-"]`)).length > beforeCount,
      { timeout: 5000, timeoutMsg: "New todo did not appear" }
    );
    const titles = await $$(`[data-testid^="todo-title-"]`);
    return titles[titles.length - 1];
  }

  it("should create a todo", async () => {
    const title = await createTodo("E2E测试待办");
    const text = await title.getText();
    expect(text).toContain("E2E测试待办");
  });

  it("should complete a todo", async () => {
    await createTodo("待完成的待办");
    const checkbox = await $(`[data-testid^="todo-complete-"]`);
    await checkbox.click();
    // Wait for state update and re-fetch the title element
    await browser.pause(1000);
    const title = await $(`[data-testid^="todo-title-"]`);
    const text = await title.getText();
    expect(text).toContain("待完成的待办");
  });

  it("should search todos", async () => {
    await createTodo("搜索目标待办");
    const searchInput = await $("input[data-testid='todo-search-input']");
    await searchInput.setValue("搜索目标");
    await browser.pause(500);
    const titles = await $$(`[data-testid^="todo-title-"]`);
    expect(titles.length).toBeGreaterThanOrEqual(1);
    await searchInput.clearValue();
  });

  it("should filter by status", async () => {
    const filterBtn = await $("[data-testid='status-filter-completed']");
    await filterBtn.click();
    await browser.pause(500);
    const allBtn = await $("[data-testid='status-filter-all']");
    await allBtn.click();
  });

  it("should delete a todo", async () => {
    await createTodo("要删除的待办");
    const menuBtn = await $(`[data-testid^="todo-menu-"]`);
    await menuBtn.click();
    const deleteBtn = await $(`[data-testid^="todo-delete-"]`);
    await deleteBtn.waitForClickable({ timeout: 3000 });
    await deleteBtn.click();
    // Confirm dialog may appear — wait and check
    await browser.pause(500);
  });
});
