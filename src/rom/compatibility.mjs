import { labelLayout } from './team-labels.mjs';
import { readScenarioDescription } from './scenario-text.mjs';
import { readScenarioSummary } from './scenario-summary.mjs';
import { MENU_SCREENS, readMenuText, menuTextPreview } from './menu-text.mjs';
import { mainMenuPreview } from './main-menu.mjs';

// Recognition identifies the engine. Feature checks identify structures the
// editor actually understands, so relocated data does not crash a whole panel.
export function editorCompatibility(rom) {
  const check = read => { try { read(); return { supported: true, reason: '' }; } catch (error) { return { supported: false, reason: error.message }; } };
  return {
    largeNames: check(() => labelLayout(rom)),
    scenarios: check(() => { for (let i=0; i<12; i++) { readScenarioDescription(rom,i); readScenarioSummary(rom,i); } }),
    menus: check(() => {
      mainMenuPreview(rom);
      for (const screen of MENU_SCREENS) for (const field of screen.fields) {
        readMenuText(rom,screen.id,field.key); menuTextPreview(rom,screen.id,field.key);
      }
    }),
  };
}
