import { describe, expect, it } from 'vitest';
import { keyboardAction } from './keyboard';

const key = (overrides: Partial<KeyboardEvent> = {}) => ({
 key: '', code: '', ctrlKey: false, metaKey: false, altKey: false,
 shiftKey: false, repeat: false, isComposing: false, ...overrides
});

describe('keyboardAction', () => {
 it('opens search with Control or Command even from an input', () => {
  expect(keyboardAction(key({key:'k',ctrlKey:true}),true)).toBe('search');
  expect(keyboardAction(key({key:'K',metaKey:true}),false)).toBe('search');
 });
 it('uses physical number keys on French and English keyboards', () => {
  expect(keyboardAction(key({key:'&',code:'Digit1',altKey:true}),false)).toBe('/');
  expect(keyboardAction(key({key:'2',code:'Digit2',altKey:true}),false)).toBe('/recipes');
  expect(keyboardAction(key({code:'Digit6',altKey:true}),false)).toBe('/household');
 });
 it('creates only outside editable fields', () => {
  expect(keyboardAction(key({code:'KeyN',altKey:true}),false)).toBe('create');
  expect(keyboardAction(key({code:'KeyN',altKey:true}),true)).toBeUndefined();
  expect(keyboardAction(key({code:'Digit1',altKey:true}),true)).toBeUndefined();
 });
 it('ignores typing, composition, repeats and AltGr', () => {
  expect(keyboardAction(key({key:'n',code:'KeyN'}),false)).toBeUndefined();
  expect(keyboardAction(key({code:'KeyN',altKey:true,ctrlKey:true}),false)).toBeUndefined();
  expect(keyboardAction(key({key:'k',ctrlKey:true,isComposing:true}),false)).toBeUndefined();
  expect(keyboardAction(key({code:'Digit1',altKey:true,repeat:true}),false)).toBeUndefined();
 });
});
