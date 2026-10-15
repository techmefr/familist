export type KeyboardAction = 'search' | 'create' | '/' | '/recipes' | '/meal-plan' | '/chat' | '/cards' | '/household';

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat' | 'isComposing'>;

const destinations: Record<string, KeyboardAction> = {
 Digit1: '/', Digit2: '/recipes', Digit3: '/meal-plan',
 Digit4: '/chat', Digit5: '/cards', Digit6: '/household'
};

export function keyboardAction(event: ShortcutEvent, editing: boolean): KeyboardAction | undefined {
 if (event.repeat || event.isComposing) return;
 if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') return 'search';
 if (editing || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
 if (event.code === 'KeyN') return 'create';
 return destinations[event.code];
}
