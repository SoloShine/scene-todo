describe("Settings", () => {
  async function openSettings() {
    const menuToggle = await $("[data-testid='sidebar-menu-toggle']");
    await menuToggle.waitForClickable({ timeout: 10000 });
    await menuToggle.click();
    const settingsBtn = await $("[data-testid='sidebar-menu-settings']");
    await settingsBtn.waitForClickable({ timeout: 5000 });
    await settingsBtn.click();
    await browser.pause(1000);
  }

  it("should switch theme mode", async () => {
    await openSettings();
    const darkBtn = await $("[data-testid='theme-mode-dark']");
    await darkBtn.waitForClickable({ timeout: 5000 });
    await darkBtn.click();
    await browser.pause(500);
    const lightBtn = await $("[data-testid='theme-mode-light']");
    await lightBtn.click();
  });

  it("should switch accent color", async () => {
    await openSettings();
    const emeraldBtn = await $("[data-testid='theme-accent-emerald']");
    await emeraldBtn.waitForClickable({ timeout: 5000 });
    await emeraldBtn.click();
    await browser.pause(500);
    const indigoBtn = await $("[data-testid='theme-accent-indigo']");
    await indigoBtn.click();
  });

  it("should toggle autostart", async () => {
    await openSettings();
    const checkbox = await $("[data-testid='setting-autostart']");
    await checkbox.waitForClickable({ timeout: 5000 });
    await checkbox.click();
    await browser.pause(500);
    // Toggle back
    await checkbox.click();
  });

  it("should export data", async () => {
    await openSettings();
    const exportBtn = await $("[data-testid='setting-export']");
    await exportBtn.waitForClickable({ timeout: 5000 });
    await exportBtn.click();
    await browser.pause(1000);
  });
});
