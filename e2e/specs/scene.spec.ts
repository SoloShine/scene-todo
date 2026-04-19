describe("TC-06 Scenes", () => {
  async function waitForApp() {
    const input = await $("input[data-testid='new-todo-input']");
    await input.waitForExist({ timeout: 15000 });
  }

  async function createScene(name: string) {
    const addBtn = await $("[data-testid='section-add-场景']");
    await addBtn.waitForClickable({ timeout: 5000 });
    await addBtn.click();

    const sceneInput = await $("input[data-testid='new-scene-input']");
    await sceneInput.waitForExist({ timeout: 5000 });
    await sceneInput.setValue(name);
    await browser.keys("Enter");

    const sceneItem = await $(`[data-testid^="scene-item-"]`);
    await sceneItem.waitForExist({ timeout: 5000 });
    return sceneItem;
  }

  // TC-06.01
  it("should create a scene", async () => {
    await waitForApp();
    const uid = Date.now().toString(36);
    const scene = await createScene(`${uid}-tc06-test`);
    const text = await scene.getText();
    expect(text).toContain("tc06-test");
  });

  // TC-06.02
  it("should edit a scene via dialog", async () => {
    await waitForApp();
    const uid = Date.now().toString(36);
    await createScene(`${uid}-tc06-edit`);

    const sceneItem = await $(`[data-testid^="scene-item-"]`);
    // Right-click to open editor
    await sceneItem.click({ button: 2 });
    await browser.pause(500);

    const nameInput = await $("[data-testid='scene-name-input']");
    await nameInput.waitForExist({ timeout: 5000 });
    await nameInput.clearValue();
    await nameInput.setValue(`${uid}-tc06-edited`);

    const saveBtn = await $("[data-testid='scene-save-btn']");
    await saveBtn.click();
    await browser.pause(500);
  });

  // TC-06.03
  it("should delete a scene with confirmation", async () => {
    await waitForApp();
    const uid = Date.now().toString(36);
    await createScene(`${uid}-tc06-delete`);

    const sceneItem = await $(`[data-testid^="scene-item-"]`);
    // Right-click to open editor
    await sceneItem.click({ button: 2 });
    await browser.pause(500);

    const deleteBtn = await $("[data-testid='scene-delete-btn']");
    await deleteBtn.waitForExist({ timeout: 5000 });
    await deleteBtn.click();
    await browser.pause(300);

    // Confirm deletion (second click)
    const confirmDeleteBtn = await $("[data-testid='scene-delete-btn']");
    await confirmDeleteBtn.click();
    await browser.pause(500);
  });

  // TC-06.04
  it("should show empty state when no scenes exist", async () => {
    await waitForApp();

    // Delete all existing scenes
    let sceneItems = await $$(`[data-testid^="scene-item-"]`);
    for (const item of sceneItems) {
      await item.click({ button: 2 });
      await browser.pause(500);

      const deleteBtn = await $("[data-testid='scene-delete-btn']");
      try {
        await deleteBtn.waitForExist({ timeout: 2000 });
        await deleteBtn.click();
        await browser.pause(300);
        await deleteBtn.click();
        await browser.pause(500);
      } catch {
        // Scene might already be deleted
      }
    }

    sceneItems = await $$(`[data-testid^="scene-item-"]`);
    expect(sceneItems.length).toBe(0);
  });
});
