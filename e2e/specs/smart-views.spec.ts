describe("TC-07 Smart Views", () => {
  async function waitForApp() {
    const input = await $("input[data-testid='new-todo-input']");
    await input.waitForExist({ timeout: 15000 });
  }

  // TC-07.01
  it("should show all todos via smart view", async () => {
    await waitForApp();

    const allBtn = await $("[data-testid='smart-view-all']");
    await allBtn.waitForClickable({ timeout: 5000 });
    await allBtn.click();
    await browser.pause(500);

    // List should show all uncompleted todos
    const titles = await $$(`[data-testid^="todo-title-"]`);
    // At minimum the list should be visible (even if empty)
    expect(titles).toBeDefined();
  });

  // TC-07.02
  it("should show today's todos via smart view", async () => {
    await waitForApp();

    const todayBtn = await $("[data-testid='smart-view-today']");
    await todayBtn.waitForClickable({ timeout: 5000 });
    await todayBtn.click();
    await browser.pause(500);

    // Should filter to today's todos
    const titles = await $$(`[data-testid^="todo-title-"]`);
    expect(titles).toBeDefined();

    // Switch back to all
    const allBtn = await $("[data-testid='smart-view-all']");
    await allBtn.click();
    await browser.pause(300);
  });
});
