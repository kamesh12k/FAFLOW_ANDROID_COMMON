/**
 * LoginPage.ts – Page Object Model for the FAFLOW login screen.
 *
 * Adapts to the actual FAFLOW login form selectors.
 * Role-based selectors preferred; falls back to accessible attributes.
 */
import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly roleSelector: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('#identifier-input');
    this.emailInput = page.locator('#identifier-input');
    this.passwordInput = page.locator('#password-input');
    this.submitButton = page.getByRole('button', { name: /sign in/i });
    this.errorMessage = page.getByRole('alert').or(page.locator('[data-testid="login-error"]'));
    this.roleSelector = page.getByLabel(/role/i).or(page.getByRole('combobox'));
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload();
  }

  async loginWithUsername(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginWithEmail(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
