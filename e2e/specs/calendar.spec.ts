describe("TC-02 Calendar View", () => {
  async function waitForApp() {
    const input = await $("input[data-testid='new-todo-input']");
    await input.waitForExist({ timeout: 15000 });
  }

  // TC-02.01
  it("should switch to calendar view", async () => {
    await waitForApp();

    const calBtn = await $("[data-testid='view-toggle-calendar']");
    await calBtn.waitForClickable({ timeout: 5000 });
    await calBtn.click();
    await browser.pause(500);

    // Calendar month label should be visible
    const monthLabel = await $("[data-testid='cal-month-label']");
    await monthLabel.waitForExist({ timeout: 3000 });
    const text = await monthLabel.getText();
    expect(text).toMatch(/^\d{4}\/\d{2}$/);
  });

  // TC-02.02
  it("should navigate months", async () => {
    await waitForApp();

    const calBtn = await $("[data-testid='view-toggle-calendar']");
    await calBtn.waitForClickable({ timeout: 5000 });
    await calBtn.click();
    await browser.pause(500);

    const monthLabel = await $("[data-testid='cal-month-label']");
    await monthLabel.waitForExist({ timeout: 3000 });
    const originalText = await monthLabel.getText();

    // Go to previous month
    const prevBtn = await $("[data-testid='cal-prev-month']");
    await prevBtn.click();
    await browser.pause(300);
    const prevText = await monthLabel.getText();
    expect(prevText).not.toBe(originalText);

    // Go back to current month
    const nextBtn = await $("[data-testid='cal-next-month']");
    await nextBtn.click();
    await browser.pause(300);
    const nextText = await monthLabel.getText();
    expect(nextText).toBe(originalText);

    // Go to next month
    await nextBtn.click();
    await browser.pause(300);
    const futureText = await monthLabel.getText();
    expect(futureText).not.toBe(originalText);
  });

  // TC-02.03
  it("should filter todos by date", async () => {
    await waitForApp();

    // Create a todo first (will have today's date)
    const uid = Date.now().toString(36);
    const input = await $("input[data-testid='new-todo-input']");
    await input.click();
    await browser.keys(`${uid}-tc0203-cal`);
    await browser.keys("Enter");
    await browser.pause(800);

    // Switch to calendar view
    const calBtn = await $("[data-testid='view-toggle-calendar']");
    await calBtn.click();
    await browser.pause(500);

    // Navigate back to current month (TC-02.02 may have left it on next month)
    const monthLabel = await $("[data-testid='cal-month-label']");
    await monthLabel.waitForExist({ timeout: 3000 });
    const now = new Date();
    const currentMonthLabel = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
    let monthText = await monthLabel.getText();
    const prevBtn = await $("[data-testid='cal-prev-month']");
    // Navigate back until we reach current month
    while (monthText !== currentMonthLabel) {
      await prevBtn.click();
      await browser.pause(200);
      monthText = await monthLabel.getText();
    }

    // Click today's date cell
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayCell = await $(`[data-testid='cal-date-${todayKey}']`);
    await todayCell.waitForExist({ timeout: 5000 });
    await todayCell.click();
    await browser.pause(500);

    // Should show filtered todos section with the date label
    const dateLabel = await $(`span=${todayKey} 的待办`);
    await dateLabel.waitForExist({ timeout: 3000 });

    // Click clear filter
    const clearBtn = await $("[data-testid='cal-clear-filter']");
    await clearBtn.waitForClickable({ timeout: 3000 });
    await clearBtn.click();
    await browser.pause(300);

    // Calendar grid should be visible again without date filter
    expect(await monthLabel.isExisting()).toBe(true);

    // Switch back to list view
    const listBtn = await $("[data-testid='view-toggle-list']");
    await listBtn.click();
  });
});
