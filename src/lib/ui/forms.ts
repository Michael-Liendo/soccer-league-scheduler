import { applyAction, type SubmitFunction } from '$app/forms';
import { refreshAll } from '$app/navigation';
import { toasts } from './toast.svelte.ts';

interface FeedbackOptions {
	/** Clear the form after a successful submission. Off by default, as most forms edit in place. */
	reset?: boolean;
	/** Called while the request is in flight, to disable buttons for instance. */
	pending?: (isPending: boolean) => void;
	onSuccess?: (data: Record<string, unknown> | undefined) => void;
}

function textOf(data: Record<string, unknown> | undefined, key: string): string | undefined {
	const value = data?.[key];
	return typeof value === 'string' && value ? value : undefined;
}

/**
 * For `use:enhance`: shows the `message` or `error` returned by a form action as a toast and
 * reloads the page data.
 *
 * Unlike the default behaviour it leaves keyboard focus where it is, so fields that save on
 * change do not interrupt someone tabbing through a row of inputs.
 */
export function withFeedback(options: FeedbackOptions = {}): SubmitFunction {
	return ({ formElement }) => {
		options.pending?.(true);
		return async ({ result }) => {
			options.pending?.(false);
			if (result.type === 'redirect') {
				await applyAction(result);
			} else if (result.type === 'error') {
				toasts.error('Algo salió mal. Revisa tu conexión e intenta de nuevo.');
			} else if (result.type === 'failure') {
				toasts.error(textOf(result.data, 'error') ?? 'No se pudo guardar. Intenta de nuevo.');
			} else {
				const message = textOf(result.data, 'message');
				if (message) toasts.show(message);
				if (options.reset) formElement.reset();
				await refreshAll();
				options.onSuccess?.(result.data);
			}
		};
	};
}

/** Submits the form a field belongs to. Meant for `onchange`, so edits save themselves. */
export function submitOnChange(event: Event): void {
	const field = event.currentTarget as HTMLInputElement | HTMLSelectElement;
	field.form?.requestSubmit();
}
