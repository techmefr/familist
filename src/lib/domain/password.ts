export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordRule {
	id: 'length';
	isMet: boolean;
}

export function passwordRules(password: string): PasswordRule[] {
	return [{ id: 'length', isMet: password.length >= MIN_PASSWORD_LENGTH }];
}

export function isValidPassword(password: string): boolean {
	return passwordRules(password).every(rule => rule.isMet);
}
