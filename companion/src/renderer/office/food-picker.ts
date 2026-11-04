import { type FoodKind, foodKinds, foodNames } from "./office-food.js";

const storageKey = "office.foodChoice";

/** The food a number key picks: 1 for the first on the list, and so on. */
export function foodForKey(key: string): FoodKind | null {
  if (!/^[1-9]$/.test(key)) {
    return null;
  }
  return foodKinds[Number(key) - 1] ?? null;
}

/** The last food ordered on this computer, so Enter orders it again; pizza the first time. */
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

/**
 * I in Alyx mode: the list of food to order in, numbered for the keyboard since the mouse is
 * busy looking around. While an order is out it shows how far along it is instead.
 */
export class FoodPicker {
  private selected: FoodKind;

  constructor(
    private readonly panel: HTMLElement,
    private readonly list: HTMLOListElement,
    private readonly status: HTMLElement,
    private readonly order: (kind: FoodKind) => void,
    private readonly orderState: () => string | null,
  ) {
    this.selected = rememberedFood(browserStorage());
    this.list.replaceChildren(
      ...foodKinds.map((kind, index) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.food = kind;
        const key = document.createElement("kbd");
        key.textContent = String(index + 1);
        button.append(key, ` ${foodNames[kind]}`);
        button.addEventListener("click", () => this.pick(kind));
        item.append(button);
        return item;
      }),
    );
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.panel.hidden = false;
    this.render();
  }

  close(): void {
    this.panel.hidden = true;
  }

  /** Keeps the order's progress current while the list is up. */
  render(): void {
    if (!this.isOpen) {
      return;
    }
    const state = this.orderState();
    this.list.hidden = state !== null;
    const text = state ?? "Pilih makanan, kurir antar ke depan pintu";
    if (this.status.textContent !== text) {
      this.status.textContent = text;
    }
    for (const button of this.list.querySelectorAll<HTMLButtonElement>("button")) {
      button.setAttribute("aria-current", String(button.dataset.food === this.selected));
    }
  }

  /** Number keys order, Enter orders the last choice, Escape or I closes. True when it used the key. */
  handleKey(event: KeyboardEvent): boolean {
    if (!this.isOpen) {
      return false;
    }
    if (event.key === "Escape" || event.code === "KeyI") {
      this.close();
      return true;
    }
    if (this.orderState() !== null) {
      return false;
    }
    if (event.key === "Enter") {
      this.pick(this.selected);
      return true;
    }
    const kind = foodForKey(event.key);
    if (kind !== null) {
      this.pick(kind);
      return true;
    }
    return false;
  }

  private pick(kind: FoodKind): void {
    if (this.orderState() !== null) {
      return;
    }
    this.selected = kind;
    rememberFood(browserStorage(), kind);
    this.order(kind);
    this.render();
  }
}
