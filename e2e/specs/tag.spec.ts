describe("TC-05 Tags", () => {
  async function waitForApp() {
    const input = await $("input[data-testid='new-todo-input']");
    await input.waitForExist({ timeout: 15000 });
  }

  async function createTag(name: string) {
    const addBtn = await $("[data-testid='section-add-标签']");
    await addBtn.waitForClickable({ timeout: 5000 });
    await addBtn.click();

    const tagInput = await $("input[data-testid='new-tag-input']");
    await tagInput.waitForExist({ timeout: 5000 });
    await tagInput.setValue(name);
    await browser.keys("Enter");
    await browser.pause(800);
  }

  // TC-05.01
  it("should create a tag", async () => {
    await waitForApp();
    const uid = Date.now().toString(36);
    await createTag(`${uid}-tc05-important`);

    const tagItems = await $$(`[data-testid^="tag-item-"]`);
    expect(tagItems.length).toBeGreaterThan(0);
  });

  // TC-05.02
  it("should filter by tag", async () => {
    await waitForApp();
    const uid = Date.now().toString(36);
    await createTag(`${uid}-tc05-filter`);

    // Click the tag to filter
    const tagItems = await $$(`[data-testid^="tag-item-"]`);
    if (tagItems.length > 0) {
      await tagItems[tagItems.length - 1].click();
      await browser.pause(500);
    }
  });

  // TC-05.03
  it("should delete a tag with confirmation", async () => {
    await waitForApp();
    const uid = Date.now().toString(36);
    await createTag(`${uid}-tc05-delete`);

    // Find the tag and hover to reveal delete button
    const tagItems = await $$(`[data-testid^="tag-item-"]`);
    const lastTag = tagItems[tagItems.length - 1];
    await lastTag.moveTo();
    await browser.pause(300);

    // Click the ✕ button inside the tag span
    const deleteBtn = await lastTag.$("button");
    await deleteBtn.click();
    await browser.pause(500);

    // Confirm dialog should contain expected text
    const confirmBtn = await $("button=删除");
    await confirmBtn.waitForClickable({ timeout: 3000 });
    await confirmBtn.click();
    await browser.pause(800);
  });

  // TC-05.04
  it("should show empty state when no tags exist", async () => {
    await waitForApp();

    // Delete all existing tags
    let tagItems = await $$(`[data-testid^="tag-item-"]`);
    for (const item of tagItems) {
      await item.moveTo();
      await browser.pause(200);

      const deleteBtn = await item.$("button");
      try {
        await deleteBtn.click();
        await browser.pause(300);

        const confirmBtn = await $("button=删除");
        await confirmBtn.waitForClickable({ timeout: 2000 });
        await confirmBtn.click();
        await browser.pause(500);
      } catch {
        // Tag might already be deleted
      }
    }

    tagItems = await $$(`[data-testid^="tag-item-"]`);
    expect(tagItems.length).toBe(0);
  });
});
