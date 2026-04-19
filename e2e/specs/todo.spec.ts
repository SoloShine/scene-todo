describe("Todo CRUD", () => {
  // Helper: wait for the app to finish loading
  async function waitForApp() {
    const input = await $("input[data-testid='new-todo-input']");
    await input.waitForExist({ timeout: 15000 });
    return input;
  }

  // Helper: create a todo and return its title element
  async function createTodo(title: string) {
    const input = await waitForApp();
    await input.setValue(title);
    await browser.keys("Enter");
    // Wait for the new todo to appear
    const todoTitle = await $(`[data-testid^="todo-title-"]`);
    await todoTitle.waitForExist({ timeout: 5000 });
    return todoTitle;
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
    // Wait for state update
    await browser.pause(500);
    // Verify the title shows completed styling
    const title = await $(`[data-testid^="todo-title-"]`);
    const span = await title.$("span");
    const className = await span.getAttribute("class");
    expect(className).toContain("line-through");
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
