describe("Scene Management", () => {
  async function waitForApp() {
    const input = await $("input[data-testid='new-todo-input']");
    await input.waitForExist({ timeout: 15000 });
  }

  async function createScene(name: string) {
    // Click the scene section add button to show input
    const addBtn = await $("[data-testid='section-add-场景']");
    await addBtn.waitForClickable({ timeout: 5000 });
    await addBtn.click();

    const sceneInput = await $("input[data-testid='new-scene-input']");
    await sceneInput.waitForExist({ timeout: 5000 });
    await sceneInput.setValue(name);
    await browser.keys("Enter");

    // Wait for scene to appear
    const sceneItem = await $(`[data-testid^="scene-item-"]`);
    await sceneItem.waitForExist({ timeout: 5000 });
    return sceneItem;
  }

  it("should create a scene", async () => {
    await waitForApp();
    const scene = await createScene("测试场景");
    const text = await scene.getText();
    expect(text).toContain("测试场景");
  });

  it("should select a scene", async () => {
    await waitForApp();
    await createScene("选择场景");
    const sceneItem = await $(`[data-testid^="scene-item-"]`);
    await sceneItem.click();
    await browser.pause(500);
  });

  it("should toggle scene section collapse", async () => {
    await waitForApp();
    const toggle = await $("[data-testid='section-toggle-场景']");
    await toggle.click();
    await browser.pause(300);
    // Toggle back
    await toggle.click();
  });

  it("should open scene editor and modify name", async () => {
    await waitForApp();
    await createScene("编辑场景");

    const sceneItem = await $(`[data-testid^="scene-item-"]`);
    await sceneItem.click();
    await browser.pause(300);

    const nameInput = await $("[data-testid='scene-name-input']");
    await nameInput.waitForExist({ timeout: 5000 });
    await nameInput.clearValue();
    await nameInput.setValue("编辑后场景");

    const saveBtn = await $("[data-testid='scene-save-btn']");
    await saveBtn.click();
    await browser.pause(300);
  });

  it("should cancel scene editing", async () => {
    await waitForApp();
    await createScene("取消场景");

    const sceneItem = await $(`[data-testid^="scene-item-"]`);
    await sceneItem.click();
    await browser.pause(300);

    const nameInput = await $("[data-testid='scene-name-input']");
    await nameInput.waitForExist({ timeout: 5000 });
    await nameInput.setValue("不应保存");

    const cancelBtn = await $("[data-testid='scene-cancel-btn']");
    await cancelBtn.click();
    await browser.pause(300);
  });

  it("should delete a scene", async () => {
    await waitForApp();
    await createScene("删除场景");

    const sceneItem = await $(`[data-testid^="scene-item-"]`);
    await sceneItem.click();
    await browser.pause(300);

    const deleteBtn = await $("[data-testid='scene-delete-btn']");
    await deleteBtn.waitForExist({ timeout: 5000 });
    await deleteBtn.click();
    await browser.pause(300);

    // Confirm deletion (the button text changes to confirm after first click)
    const confirmDeleteBtn = await $("[data-testid='scene-delete-btn']");
    await confirmDeleteBtn.click();
    await browser.pause(300);
  });
});
