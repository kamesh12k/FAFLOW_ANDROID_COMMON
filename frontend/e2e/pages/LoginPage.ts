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
    // Support both username and email login forms
    this.usernameInput = page.getByLabel(/username/i).or(page.getByPlaceholder(/username/i));
    this.emailInput = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    this.passwordInput = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
    this.submitButton = page
      .getByRole('button', { name: /sign in|login|submit/i })
      .or(page.getByRole('button', { name: /log in/i }));
    this.errorMessage = page.getByRole('alert').or(page.locator('[data-testid="login-error"]'));
    this.roleSelector = page.getByLabel(/role/i).or(page.getByRole('combobox'));
  }

  async goto() {
    await this.page.goto('/login');
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
