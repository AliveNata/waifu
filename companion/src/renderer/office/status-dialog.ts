import { rowDetail, type StatusRow, statusLabels, statusSummary } from "./status-board.js";

/**
 * The team status board, opened large: the same rows as the screen on the back wall, as a page
 * table that stays readable at any window size. It refreshes while open and closes with its
 * close button, Escape, or a click outside it.
 */
export class StatusDialog {
  private shown = "";

  constructor(
    private readonly dialog: HTMLDialogElement,
    private readonly summary: HTMLElement,
    private readonly body: HTMLTableSectionElement,
    closeButton: HTMLButtonElement,
    private readonly source: () => { rows: StatusRow[]; now: number },
  ) {
    closeButton.addEventListener("click", () => this.dialog.close());
    // The dialog's own box is only its backdrop edge: its content fills a wrapper inside, so a
    // click that lands on the dialog itself was outside the content.
    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog) {
        this.dialog.close();
      }
    });
    this.dialog.addEventListener("close", () => {
      this.shown = "";
    });
  }

  open(): void {
    if (!this.dialog.open) {
      this.dialog.showModal();
    }
    this.render();
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  /** Called every tick; only redraws when something it shows has changed. */
  render(): void {
    if (!this.dialog.open) {
      return;
    }
    const { rows, now } = this.source();
    const details = rows.map((row) => rowDetail(row, now));
    const signature = rows.map((row, index) => `${row.memberId}:${row.status}:${details[index]}`).join("|");
    if (signature === this.shown) {
      return;
    }
    this.shown = signature;
    this.summary.textContent = statusSummary(rows);
    this.body.replaceChildren(
      ...rows.map((row, index) => {
        const tr = document.createElement("tr");
        tr.dataset.status = row.status;
        const name = document.createElement("th");
        name.scope = "row";
        name.textContent = row.name;
        const role = document.createElement("td");
        role.textContent = row.role;
        const status = document.createElement("td");
        const dot = document.createElement("span");
        dot.className = "status-dot";
        dot.setAttribute("aria-hidden", "true");
        status.append(dot, statusLabels[row.status]);
        const detail = document.createElement("td");
        detail.textContent = details[index] === "" ? "" : (details[index] ?? "");
        tr.append(name, role, status, detail);
        return tr;
      }),
    );
  }
}
