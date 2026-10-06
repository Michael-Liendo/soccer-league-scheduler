export type ToastKind = 'info' | 'error';

export interface Toast {
	id: number;
	text: string;
	kind: ToastKind;
}

const VISIBLE_MS = 3200;

/** Short-lived messages confirming what just happened. Only ever used in the browser. */
class Toasts {
	items = $state<Toast[]>([]);
	#nextId = 1;

	show(text: string, kind: ToastKind = 'info'): void {
		const id = this.#nextId++;
		// One message at a time keeps the latest news readable on a phone.
		this.items = [{ id, text, kind }];
		setTimeout(() => this.dismiss(id), kind === 'error' ? VISIBLE_MS * 1.5 : VISIBLE_MS);
	}

	error(text: string): void {
		this.show(text, 'error');
	}

	dismiss(id: number): void {
		this.items = this.items.filter((toast) => toast.id !== id);
	}
}

export const toasts = new Toasts();
