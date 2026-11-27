import type { Context } from "./context";
import { collectionNames, type CollectionName, type Collections } from "./store";

/** The Owner of records made while signed out. */
export const localOwner = "me";

/**
 * The Owner of records (plan.md: "Every record carries an owner"): "me" while signed
 * out, the account's user id once signed in. A device holds one account's data at a
 * time, so it never mixes two accounts' records.
 */
export function ownerActions(ctx: Context, eraseEverything: () => void) {
  const { store } = ctx;

  function* records() {
    for (const name of collectionNames) {
      for (const record of store.all(name)) yield { name, record };
    }
  }

  function holdsAnotherAccount(account: string): boolean {
    for (const { record } of records()) {
      if (record.owner !== localOwner && record.owner !== account) return true;
    }
    return false;
  }

  return {
    /** The Owner new records get: the account if signed in, else "me". */
    owner(): string {
      return ctx.owner;
    },

    /** Whether this device holds records of an account other than `account`. */
    holdsAnotherAccount,

    /**
     * Signs the core in as `account`: records owned by "me" become the account's, and
     * so do records created from now on. Doing it again changes nothing. Throws if the
     * device holds another account's records; erase the device first.
     */
    changeOwner(account: string): void {
      if (holdsAnotherAccount(account)) {
        throw new Error("This device holds another account's records");
      }
      ctx.owner = account;
      if (account === localOwner) return;
      for (const { name, record } of [...records()]) {
        if (record.owner !== localOwner) continue;
        store.put(
          name as CollectionName,
          {
            ...record,
            owner: account,
          } as Collections[CollectionName],
        );
      }
    },

    /**
     * Empties this device for signing out: no records, default settings, owned by "me"
     * again. The erase is not sent anywhere, so the account keeps its data.
     */
    eraseDevice(): void {
      eraseEverything();
      ctx.owner = localOwner;
    },
  };
}
