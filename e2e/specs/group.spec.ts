describe("TC-04 Groups", () => {
  async function waitForApp() {
    const input = await $("input[data-testid='new-todo-input']");
    await input.waitForExist({ timeout: 15000 });
  }

  async function createGroup(name: string) {
    const addBtn = await $("[data-testid='section-add-分组']");
    await addBtn.waitForExist({ timeout: 5000 });
    await browser.execute((btn: HTMLButtonElement) => btn.click(), addBtn);

    const groupInput = await $("input[data-testid='new-group-input']");
    await groupInput.waitForExist({ timeout: 5000 });
    await groupInput.setValue(name);
    await browser.keys("Enter");
    await browser.pause(800);
  }

  // TC-04.01
  it("should create a group", async () => {
    await waitForApp();
    const uid = Date.now().toString(36);
    await createGroup(`${uid}-tc04-work`);

    // Group should appear in sidebar
    const groupItems = await $$(`[data-testid^="group-item-"]`);
    expect(groupItems.length).toBeGreaterThan(0);
  });

  // TC-04.02
  it("should filter by group", async () => {
    await waitForApp();
    const uid = Date.now().toString(36);
    await createGroup(`${uid}-tc04-filter`);

    // Click the group to filter
    const groupItems = await $$(`[data-testid^="group-item-"]`);
    if (groupItems.length > 0) {
      await groupItems[groupItems.length - 1].click();
      await browser.pause(500);
    }

    // Click "全部待办" to reset
    const allBtn = await $("[data-testid='group-all']");
    await allBtn.waitForClickable({ timeout: 5000 });
    await allBtn.click();
    await browser.pause(300);
  });

  // TC-04.03
  it("should delete a group with confirmation", async () => {
    await waitForApp();
    const uid = Date.now().toString(36);
    await createGroup(`${uid}-tc04-delete`);

    // Find the group and hover to reveal delete button
    const groupItems = await $$(`[data-testid^="group-item-"]`);
    const lastGroup = groupItems[groupItems.length - 1];
    const groupId = await lastGroup.getAttribute("data-testid");
    const id = groupId?.replace("group-item-", "");

    await lastGroup.moveTo();
    await browser.pause(300);

    const deleteBtn = await $(`button[data-testid='group-delete-${id}']`);
    await deleteBtn.waitForClickable({ timeout: 3000 });
    await deleteBtn.click();
    await browser.pause(500);

    // Confirm dialog should appear
    const desc = await $("p");
    const dialogTexts = await $$("//p[contains(text(), '组内待办将变为未分组')]");
    expect(dialogTexts.length).toBeGreaterThan(0);

    // Confirm deletion
    const confirmBtn = await $("button=删除");
    await confirmBtn.waitForClickable({ timeout: 3000 });
    await confirmBtn.click();
    await browser.pause(800);
  });

  // TC-04.04
  it("should show empty state when no groups exist", async () => {
    await waitForApp();

    // Delete all existing groups first
    let groupItems = await $$(`[data-testid^="group-item-"]`);
    for (const item of groupItems) {
      const groupId = await item.getAttribute("data-testid");
      const id = groupId?.replace("group-item-", "");

      await item.moveTo();
      await browser.pause(200);

      const deleteBtn = await $(`button[data-testid='group-delete-${id}']`);
      try {
        await deleteBtn.waitForClickable({ timeout: 1000 });
        await deleteBtn.click();
        await browser.pause(300);

        const confirmBtn = await $("button=删除");
        await confirmBtn.waitForClickable({ timeout: 2000 });
        await confirmBtn.click();
        await browser.pause(500);
      } catch {
        // Group might already be deleted
      }
    }

    // Check for empty state — look for the FolderOpen icon area
    // The EmptyState is rendered when groups.length === 0
    groupItems = await $$(`[data-testid^="group-item-"]`);
    expect(groupItems.length).toBe(0);
  });
});
