import { drinkKinds, type FoodKind, foodKinds, foodNames, mealKinds } from "./office-food.js";

const storageKey = "office.foodChoice";

export type PickerTab = "meal" | "drink";

export const pickerTabs: Record<PickerTab, { label: string; kinds: readonly FoodKind[] }> = {
  meal: { label: "Makanan", kinds: mealKinds },
  drink: { label: "Minuman", kinds: drinkKinds },
};

/** Which tab is showing and which entry on it is highlighted. */
export interface PickerState {
  tab: PickerTab;
  selected: number;
}

/** What a key did: the new state, and an order or a close when it made one. */
export interface PickerStep {
  state: PickerState;
  order?: FoodKind;
  close?: boolean;
}

/** Opens on the tab of the last thing ordered, with it highlighted. */
export function pickerStart(last: FoodKind): PickerState {
  const tab: PickerTab = drinkKinds.includes(last) ? "drink" : "meal";
  return { tab, selected: Math.max(0, pickerTabs[tab].kinds.indexOf(last)) };
}

/** The highlighted entry. */
export function pickedKind(state: PickerState): FoodKind {
  const kinds = pickerTabs[state.tab].kinds;
  return kinds[Math.min(state.selected, kinds.length - 1)] ?? "pizza";
}

/**
 * One key on the open list: a number orders that entry on the tab, up and down move the highlight,
 * left, right or Tab switch tabs, Enter orders the highlighted one, Escape or I closes.
 */
export function pickerKey(state: PickerState, key: string): PickerStep | null {
  const kinds = pickerTabs[state.tab].kinds;
  if (key === "Escape" || key === "i" || key === "I") {
    return { state, close: true };
  }
  if (key === "Tab" || key === "ArrowLeft" || key === "ArrowRight") {
    const tab: PickerTab = state.tab === "meal" ? "drink" : "meal";
    return { state: { tab, selected: 0 } };
  }
  if (key === "ArrowUp" || key === "ArrowDown") {
    const step = key === "ArrowUp" ? -1 : 1;
    return { state: { ...state, selected: (state.selected + step + kinds.length) % kinds.length } };
  }
  if (key === "Enter") {
    return { state, order: pickedKind(state) };
  }
  if (/^[1-9]$/.test(key)) {
    const index = Number(key) - 1;
    const kind = kinds[index];
    return kind === undefined ? null : { state: { ...state, selected: index }, order: kind };
  }
  return null;
}

/** The last food ordered on this computer, so the list opens on it; pizza the first time. */
export function rememberedFood(storage: Pick<Storage, "getItem"> | null): FoodKind {
  let stored: string | null = null;
  try {
    stored = storage?.getItem(storageKey) ?? null;
  } catch (error) {
    // Storage can be blocked (a private window); the picker still works, it just forgets.
    console.warn("[office] last food order could not be read", error);
  }
  return foodKinds.find((kind) => kind === stored) ?? "pizza";
}

function rememberFood(storage: Pick<Storage, "setItem"> | null, kind: FoodKind): void {
  try {
    storage?.setItem(storageKey, kind);
  } catch (error) {
    console.warn("[office] food order could not be remembered", error);
  }
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch (error) {
    console.warn("[office] local storage is not available", error);
    return null;
  }
}

/** What the phone screen and the page show: the list, or the order's progress while one is out. */
export interface PickerView {
  open: boolean;
  state: PickerState;
  /** The order's progress, or null while choosing. */
  status: string | null;
}

/**
 * I in Alyx mode: the food delivery app on Alyx's phone, worked with the keyboard since the mouse
 * is busy looking around. The same list is kept on the page out of sight for screen readers.
 */
export class FoodPicker {
  private state: PickerState;
  private open = false;

  constructor(
    private readonly list: HTMLElement,
    private readonly order: (kind: FoodKind) => void,
    private readonly orderState: () => string | null,
  ) {
    this.state = pickerStart(rememberedFood(browserStorage()));
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** For the phone screen. */
  view(): PickerView {
    return { open: this.open, state: this.state, status: this.orderState() };
  }

  toggle(): void {
    this.open = !this.open;
    this.render();
  }

  close(): void {
    this.open = false;
    this.render();
  }

  /** Keeps the page's copy of the list current. */
  render(): void {
    this.list.hidden = !this.open;
    if (!this.open) {
      return;
    }
    const status = this.orderState();
    const tab = pickerTabs[this.state.tab];
    const text =
      status ??
      `${tab.label}: ${tab.kinds.map((kind, index) => `${index + 1} ${foodNames[kind]}`).join(", ")}. Pilihan: ${foodNames[pickedKind(this.state)]}`;
    if (this.list.textContent !== text) {
      this.list.textContent = text;
    }
  }

  /** Keys while the phone is out. True when it used the key. */
  handleKey(event: KeyboardEvent): boolean {
    if (!this.open) {
      return false;
    }
    const busy = this.orderState() !== null;
    const step = pickerKey(this.state, event.code === "KeyI" ? "I" : event.key);
    if (step === null || (busy && step.close !== true)) {
      return false;
    }
    this.state = step.state;
    if (step.close === true) {
      this.close();
      return true;
    }
    if (step.order !== undefined) {
      rememberFood(browserStorage(), step.order);
      this.order(step.order);
    }
    this.render();
    return true;
  }
}
