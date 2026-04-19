describe("TC-03 Search & Filter", () => {
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

  async function clearSearch() {
    const searchInput = await $("input[data-testid='todo-search-input']");
    await searchInput.click();
    const val = await searchInput.getValue();
    for (let i = 0; i < (val as string).length; i++) {
      await browser.keys("Backspace");
    }
    await browser.pause(300);
  }

  // TC-03.01
  it("should filter todos by search text", async () => {
    await waitForApp();
    const title1 = await createTodo("tc0301-unique-xyz");
    const title2 = await createTodo("tc0301-other");

    const searchInput = await $("input[data-testid='todo-search-input']");
    await searchInput.click();
    await browser.keys("tc0301-unique-xyz");
    await browser.pause(500);

    // Only the matching todo should be visible
    const titles = await $$(`[data-testid^="todo-title-"]`);
    let matchCount = 0;
    for (const el of titles) {
      const text = await el.getText();
      if (text.includes("tc0301-unique-xyz")) matchCount++;
    }
    expect(matchCount).toBeGreaterThan(0);

    await clearSearch();
  });

  // TC-03.02
  it("should show empty state for no results", async () => {
    await waitForApp();

    const searchInput = await $("input[data-testid='todo-search-input']");
    await searchInput.click();
    await browser.keys("nonexistent-xyz-12345");
    await browser.pause(500);

    const emptyState = await $("[data-testid='empty-state']");
    await emptyState.waitForExist({ timeout: 5000 });
    const text = await emptyState.getText();
    expect(text).toContain("没有找到匹配的待办");

    await clearSearch();
  });

  // TC-03.03
  it("should filter by priority", async () => {
    await waitForApp();

    const highFilter = await $("[data-testid='priority-filter-high']");
    await highFilter.click();
    await browser.pause(500);

    // Verify filter is active (button has bg-theme class)
    const cls = await highFilter.getAttribute("class");
    expect(cls).toContain("bg-theme");

    // Reset to all
    const allFilter = await $("[data-testid='priority-filter-all']");
    await allFilter.click();
    await browser.pause(300);
  });

  // TC-03.04
  it("should filter by status", async () => {
    await waitForApp();

    const completedFilter = await $("[data-testid='status-filter-completed']");
    await completedFilter.click();
    await browser.pause(500);

    // Verify filter is active
    const cls = await completedFilter.getAttribute("class");
    expect(cls).toContain("bg-theme");

    // Reset to all
    const allFilter = await $("[data-testid='status-filter-all']");
    await allFilter.click();
    await browser.pause(300);
  });

  // TC-03.05
  it("should apply combined filters", async () => {
    await waitForApp();
    const title = await createTodo("tc0305-combo");

    // Set search + priority filter
    const searchInput = await $("input[data-testid='todo-search-input']");
    await searchInput.click();
    await browser.keys("tc0305-combo");
    await browser.pause(300);

    const highFilter = await $("[data-testid='priority-filter-high']");
    await highFilter.click();
    await browser.pause(500);

    // Both filters are active — the search matches but priority doesn't (default is medium)
    // So the todo should NOT be visible
    const titles = await $$(`[data-testid^="todo-title-"]`);
    let found = false;
    for (const el of titles) {
      const text = await el.getText();
      if (text.includes("tc0305-combo")) found = true;
    }
    expect(found).toBe(false);

    // Reset both filters
    await clearSearch();
    const allFilter = await $("[data-testid='priority-filter-all']");
    await allFilter.click();
    await browser.pause(300);
  });
});
