import test from "node:test";
import assert from "node:assert";

// Function simulating the error classification and formatting logic used in server actions
function formatAuthError(err: any): string {
  if (err?.message?.includes("duplicate") || err?.code === "23505" || err?.message?.includes("unique")) {
    return "כתובת אימייל זו כבר רשומה במערכת.";
  }
  if (err?.message?.includes("DATABASE_URL")) {
    return "חיבור מסד הנתונים אינו מוגדר או שאינו זמין כרגע. אנא ודאו ש-DATABASE_URL מוגדר בשרת.";
  }
  if (err?.message) {
    return `שגיאה בהרשמה: ${err.message}`;
  }
  return "אירעה שגיאה בעת ההרשמה. אנא נסו שוב.";
}

function validateRegistrationInput(input: { email?: string; password?: string; name?: string }): { valid: boolean; error?: string } {
  const email = (input.email || "").trim().toLowerCase();
  const password = input.password || "";
  const name = (input.name || "").trim();

  if (!email || !email.includes("@")) {
    return { valid: false, error: "כתובת אימייל אינה תקינה." };
  }
  if (!password || password.length < 6) {
    return { valid: false, error: "הסיסמה חייבת להכיל לפחות 6 תווים." };
  }
  if (!name) {
    return { valid: false, error: "נא להזין שם הורה מלא." };
  }
  return { valid: true };
}

function isNextRedirect(err: any): boolean {
  return Boolean(
    err &&
      (err.digest?.startsWith?.("NEXT_REDIRECT") ||
        err.message === "NEXT_REDIRECT" ||
        err.__proto__?.constructor?.name === "RedirectError")
  );
}

test("Validation Error Handling: rejects invalid inputs with clear Hebrew feedback", () => {
  // Invalid email
  const badEmail1 = validateRegistrationInput({ email: "invalid-email", password: "password123", name: "יוסי" });
  assert.strictEqual(badEmail1.valid, false);
  assert.strictEqual(badEmail1.error, "כתובת אימייל אינה תקינה.");

  const badEmail2 = validateRegistrationInput({ email: "", password: "password123", name: "יוסי" });
  assert.strictEqual(badEmail2.valid, false);
  assert.strictEqual(badEmail2.error, "כתובת אימייל אינה תקינה.");

  // Password too short
  const shortPass = validateRegistrationInput({ email: "test@example.com", password: "123", name: "יוסי" });
  assert.strictEqual(shortPass.valid, false);
  assert.strictEqual(shortPass.error, "הסיסמה חייבת להכיל לפחות 6 תווים.");

  // Missing name
  const missingName = validateRegistrationInput({ email: "test@example.com", password: "password123", name: "   " });
  assert.strictEqual(missingName.valid, false);
  assert.strictEqual(missingName.error, "נא להזין שם הורה מלא.");

  // Valid input
  const valid = validateRegistrationInput({ email: "valid@example.com", password: "password123", name: "איתי לוי" });
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.error, undefined);
});

test("Database Error Handling: translates raw DB failures into friendly Hebrew explanations", () => {
  // Simulated DATABASE_URL missing error
  const dbMissingError = new Error("DATABASE_URL is not configured.");
  const formattedMissing = formatAuthError(dbMissingError);
  assert.ok(formattedMissing.includes("חיבור מסד הנתונים אינו מוגדר"), "Must inform user about database configuration");

  // Simulated Postgres unique constraint violation
  const duplicateKeyError = { code: "23505", message: 'duplicate key value violates unique constraint "users_email_key"' };
  const formattedDuplicate = formatAuthError(duplicateKeyError);
  assert.strictEqual(formattedDuplicate, "כתובת אימייל זו כבר רשומה במערכת.");

  // Simulated connection timeout or network error
  const networkError = new Error("Connection terminated unexpectedly");
  const formattedNetwork = formatAuthError(networkError);
  assert.ok(formattedNetwork.includes("שגיאה בהרשמה: Connection terminated unexpectedly"));
});

test("Next.js Redirect Error Preservation: Never swallows NEXT_REDIRECT exceptions", () => {
  const redirectException = { digest: "NEXT_REDIRECT;replace;/dashboard;307;" };
  assert.strictEqual(isNextRedirect(redirectException), true, "Must detect NEXT_REDIRECT digest");

  const regularError = new Error("Something broke");
  assert.strictEqual(isNextRedirect(regularError), false, "Standard error must not be identified as redirect");

  const nullError = null;
  assert.strictEqual(isNextRedirect(nullError), false, "Null must be handled safely");
});
