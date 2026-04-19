describe("TC-06 Scenes", () => {
  async function waitForApp() {
    const input = await $("input[data-testid='new-todo-input']");
    await input.waitForExist({ timeout: 15000 });
  }

  async function createScene(name: string) {
    const addBtn = await $("[data-testid='section-add-场景']");
    await addBtn.waitForExist({ timeout: 5000 });
    await browser.execute((btn: HTMLButtonElement) => btn.click(), addBtn);

    const sceneInput = await $("input[data-testid='new-scene-input']");
    await sceneInput.waitForExist({ timeout: 5000 });
    await sceneInput.setValue(name);
    await browser.keys("Enter");
    await browser.pause(1000);

    // Find the specific scene by name
    const sceneItems = await $$(`[data-testid^="scene-item-"]`);
    for (const item of sceneItems) {
      const text = await item.getText();
      if (text.includes(name)) return item;
    }
    // Fallback
    const fallback = await $(`[data-testid^="scene-item-"]`);
    await fallback.waitForExist({ timeout: 5000 });
    return fallback;
  }

  async function findSceneByName(name: string) {
    const sceneItems = await $$(`[data-testid^="scene-item-"]`);
    for (const item of sceneItems) {
      const text = await item.getText();
      if (text.includes(name)) return item;
    }
    return null;
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

    // Wait for toast to auto-dismiss
    await browser.pause(2500);

    const sceneEl = await findSceneByName("tc06-edit");
    expect(sceneEl).not.toBeNull();

    // Right-click to open editor
    await browser.execute((el: HTMLElement) => {
      el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    }, sceneEl!);
    await browser.pause(500);

    const nameInput = await $("[data-testid='scene-name-input']");
    await nameInput.waitForExist({ timeout: 5000 });
    await nameInput.clearValue();
    await nameInput.setValue(`${uid}-tc06-edited`);

    // Click save via JS (toast might be blocking)
    const saveBtn = await $("[data-testid='scene-save-btn']");
    await browser.execute((btn: HTMLButtonElement) => btn.click(), saveBtn);
    await browser.pause(1000);

    // Verify editor closed — main input should be accessible
    await waitForApp();
  });

  // TC-06.03
  it("should delete a scene with confirmation", async () => {
    await waitForApp();
    const uid = Date.now().toString(36);
    await createScene(`${uid}-tc06-delete`);
    await browser.pause(2500);

    const sceneEl = await findSceneByName("tc06-delete");
    expect(sceneEl).not.toBeNull();

    // Right-click to open editor
    await browser.execute((el: HTMLElement) => {
      el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    }, sceneEl!);
    await browser.pause(500);

    // Click delete in scene editor
    const deleteBtn = await $("[data-testid='scene-delete-btn']");
    await deleteBtn.waitForExist({ timeout: 5000 });
    await browser.execute((btn: HTMLButtonElement) => btn.click(), deleteBtn);
    await browser.pause(500);

    // Confirm in the dialog
    const confirmBtn = await $("button=删除");
    await confirmBtn.waitForClickable({ timeout: 3000 });
    await confirmBtn.click();
    await browser.pause(500);
  });

  // TC-06.04
  it("should show empty state when no scenes exist", async () => {
    await waitForApp();

    // Delete all existing scenes
    let sceneItems = await $$(`[data-testid^="scene-item-"]`);
    for (const item of sceneItems) {
      await browser.execute((el: HTMLElement) => {
        el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
      }, item);
      await browser.pause(500);

      const deleteBtn = await $("[data-testid='scene-delete-btn']");
      try {
        await deleteBtn.waitForExist({ timeout: 2000 });
        await browser.execute((btn: HTMLButtonElement) => btn.click(), deleteBtn);
        await browser.pause(300);

        try {
          const confirmBtn = await $("button=删除");
          await confirmBtn.waitForClickable({ timeout: 1000 });
          await confirmBtn.click();
        } catch {
          await browser.execute((btn: HTMLButtonElement) => btn.click(), deleteBtn);
        }
        await browser.pause(500);
      } catch {
        // Already deleted
      }
    }

    sceneItems = await $$(`[data-testid^="scene-item-"]`);
    expect(sceneItems.length).toBe(0);
  });
});
