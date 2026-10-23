export type AchDef = {id: string; title: string; desc: string};

export const ACHIEVEMENTS: AchDef[] = [
  {id: 'first-wq', title: 'First :wq', desc: 'Write and quit like you mean it.'},
  {id: 'colon-50', title: 'Colon dweller', desc: 'Run 50 ex commands.'},
  {id: 'x-1000', title: 'Patient eraser', desc: 'Delete 1000 chars with x.'},
  {id: 'no-mouse-100', title: 'Hands on home row', desc: '100 keystrokes without touching the mouse.'},
  {id: 'surgical', title: 'Surgical', desc: 'Confirm 10 substitutes with gc.'},
  {id: 'night-owl', title: 'Night owl', desc: ':w after midnight.'},
  {id: 'golf-80', title: 'Vim golf pro', desc: 'Score 80+ on a write.'},
];

export function checkAchievements(state: {
  unlocked: string[];
  colonCommands: number;
  xDeletes: number;
  mouseFreeStreak: number;
  gcConfirms: number;
  golfBest: number;
  hour: number;
}): string[] {
  const has = (id: string) => state.unlocked.includes(id);
  const fresh: string[] = [];
  if (!has('colon-50') && state.colonCommands >= 50) fresh.push('colon-50');
  if (!has('x-1000') && state.xDeletes >= 1000) fresh.push('x-1000');
  if (!has('no-mouse-100') && state.mouseFreeStreak >= 100) fresh.push('no-mouse-100');
  if (!has('surgical') && state.gcConfirms >= 10) fresh.push('surgical');
  if (!has('night-owl') && (state.hour === 0 || state.hour >= 22 || state.hour < 5)) fresh.push('night-owl');
  if (!has('golf-80') && state.golfBest >= 80) fresh.push('golf-80');
  return fresh;
}
