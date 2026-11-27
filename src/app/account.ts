import type { MyThings } from "../core";
import type { Account, Auth } from "./authAdapter";

// Signing in and out, between the auth adapter and the core's Owner (plan.md: "Every
// record carries an owner"). A device holds one account's data at a time.

/**
 * At start-up: the account of the kept session, which becomes the Owner. A session
 * whose account doesn't own the data here (the app stopped before the user answered
 * whether to erase it) is signed out, so nothing is lost.
 */
export async function restoreAccount(app: MyThings, auth: Auth): Promise<Account | null> {
  const account = await auth.currentAccount();
  if (!account) return null;
  if (app.holdsAnotherAccount(account.id)) {
    await auth.signOut();
    return null;
  }
  app.changeOwner(account.id);
  return account;
}

export type SignInResult =
  /** Signed in: the records here now belong to the account. */
  | { kind: "signedIn"; account: Account }
  /**
   * The code was right, but this device holds another account's records. Ask, then
   * `finishSignIn` to erase them, or `cancelSignIn`.
   */
  | { kind: "confirmErase"; account: Account };

/** Checks the code; throws an AuthError when it is wrong. */
export async function signIn(
  app: MyThings,
  auth: Auth,
  email: string,
  code: string,
): Promise<SignInResult> {
  const account = await auth.verifyCode(email, code);
  if (app.holdsAnotherAccount(account.id)) return { kind: "confirmErase", account };
  app.changeOwner(account.id);
  return { kind: "signedIn", account };
}

/** After the user agreed: erases another account's records here, then signs in. */
export function finishSignIn(app: MyThings, account: Account): void {
  if (app.holdsAnotherAccount(account.id)) app.eraseDevice();
  app.changeOwner(account.id);
}

/** The user kept the other account's records: forget the new session. */
export async function cancelSignIn(auth: Auth): Promise<void> {
  await auth.signOut();
}

/** Signs out and erases this device's data; it stays in the account. */
export async function signOut(app: MyThings, auth: Auth): Promise<void> {
  await auth.signOut();
  app.eraseDevice();
}
