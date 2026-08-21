import codecs
with codecs.open('meeting-bot/src/tasks/CaptionTask.ts', 'r', 'utf-8') as f:
    c = f.read()
start_idx = c.find('          const settingsOption = this.page.locator')
end_idx = c.find('    } catch (err) {')
code = '''          const settingsOption = this.page.locator('li, [role="menuitem"]').filter({ hasText: /onfiguraci|ettings/i }).first();
          if (await settingsOption.count() > 0) {
              await settingsOption.click({ timeout: 5000, force: true });
              await this.page.waitForTimeout(1500);

              // 1. Click "Subtitulos" tab safely
              const clickedTab = await this.page.evaluate(() => {
                  const els = Array.from(document.querySelectorAll('*'));
                  for (const el of els) {
                      if (el.children.length === 0 && (el.textContent?.trim() === 'Subtítulos' || el.textContent?.trim() === 'Captions')) {
                          const clickable = el.closest('div[role="tab"], li, button, div.VfPpkd-V67aGc, div.Gk2izd');
                          if (clickable) {
                              (clickable as HTMLElement).click();
                              return true;
                          }
                      }
                  }
                  return false;
              });

              if (clickedTab) {
                  await this.page.waitForTimeout(1000);

                  // 2. Click the language combobox (the first visible combobox)
                  const clickedCombo = await this.page.evaluate(() => {
                      const combos = document.querySelectorAll('div[role="combobox"]');
                      for (const combo of Array.from(combos)) {
                          if (combo.getBoundingClientRect().width > 0) {
                              (combo as HTMLElement).click();
                              return true;
                          }
                      }
                      return false;
                  });

                  if (clickedCombo) {
                      await this.page.waitForTimeout(1500);

                      // 3. Click "Espanol (Mexico)" option
                      const clickedLang = await this.page.evaluate(() => {
                          const options = document.querySelectorAll('[role="option"]');
                          for (const opt of Array.from(options)) {
                              if (opt.textContent && (opt.textContent.includes('México') || opt.textContent.includes('Mexico'))) {
                                  (opt as HTMLElement).click();
                                  return true;
                              }
                          }
                          return false;
                      });
                  }
              }
              await this.page.keyboard.press('Escape');
          }
'''
with codecs.open('meeting-bot/src/tasks/CaptionTask.ts', 'w', 'utf-8') as f:
    f.write(c[:start_idx] + code + c[end_idx:])
