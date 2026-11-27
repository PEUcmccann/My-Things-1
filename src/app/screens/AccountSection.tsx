import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  authErrorKind,
  authErrorText,
  codeDigits,
  codeLength,
  isValidEmail,
  resendSeconds,
  type Account,
} from "../authAdapter";
import { Button } from "../components/Button";
import { MenuSheet } from "../components/MenuSheet";
import { useAccount } from "../state";
import { useTheme } from "../theme";

/** Seconds left before another code can be sent, ticking down once a second. */
function useSecondsLeft(sentAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (sentAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sentAt]);
  if (sentAt === null) return 0;
  // Until the first tick, `now` may be from before the code was sent.
  const elapsed = Math.max(0, now - sentAt) / 1000;
  return Math.max(0, Math.ceil(resendSeconds - elapsed));
}

/** Settings → Account: sign in with an email and a 6-digit code, or sign out. */
export function AccountSection() {
  const theme = useTheme();
  const auth = useAccount();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  // When the last code was sent; null while asking for the email.
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askSignOut, setAskSignOut] = useState(false);
  // A right code for an account other than the one whose data is here.
  // Its session is kept until the user answers, then dropped if they don't sign in.
  const [pendingErase, setPendingErase] = useState<Account | null>(null);
  const [eraseAsked, setEraseAsked] = useState(false);
  const secondsLeft = useSecondsLeft(sentAt);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(authErrorText(authErrorKind(e)));
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      if (!isValidEmail(email)) {
        setError(authErrorText("invalidEmail"));
        return;
      }
      await auth.sendCode(email.trim());
      setSentAt(Date.now());
    });

  const signIn = () =>
    run(async () => {
      const result = await auth.signIn(email.trim(), code);
      if (result.kind === "confirmErase") {
        setPendingErase(result.account);
        setEraseAsked(true);
      } else reset();
    });

  /** The user won't replace the other account's data: forget the new session. */
  function cancelPending() {
    if (!pendingErase) return;
    setPendingErase(null);
    run(() => auth.cancelSignIn());
  }

  function reset() {
    setSentAt(null);
    setCode("");
    setError(null);
  }

  function switchEmail() {
    cancelPending();
    reset();
  }

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
  ];
  const errorText = error ? (
    <Text style={[styles.error, { color: theme.danger }]} testID="account-error" role="alert">
      {error}
    </Text>
  ) : null;

  let body;
  if (auth.account) {
    body = (
      <>
        <Text style={[styles.email, { color: theme.text }]} testID="account-email-shown">
          {auth.account.email}
        </Text>
        <Text style={[styles.detail, { color: theme.muted }]} testID="account-status">
          Signed in
        </Text>
        <View style={styles.buttons}>
          <Button
            title="Sign out"
            kind="danger"
            onPress={() => setAskSignOut(true)}
            testID="account-sign-out"
          />
        </View>
      </>
    );
  } else if (sentAt === null) {
    body = (
      <>
        <Text style={[styles.detail, { color: theme.muted }]}>Sign in to sync your data</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.muted}
          keyboardType="email-address"
          inputMode="email"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={sendCode}
          editable={!busy}
          style={inputStyle}
          accessibilityLabel="Email"
          testID="account-email"
        />
        {errorText}
        <View style={styles.buttons}>
          <Button
            title="Send code"
            kind="primary"
            onPress={sendCode}
            disabled={busy || !email.trim()}
            testID="account-send-code"
          />
        </View>
      </>
    );
  } else {
    body = (
      <>
        <Text style={[styles.detail, { color: theme.muted }]} testID="account-code-sent">
          We sent a 6-digit code to {email.trim()}
        </Text>
        <TextInput
          value={code}
          onChangeText={(text) => setCode(codeDigits(text))}
          placeholder="6-digit code"
          placeholderTextColor={theme.muted}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={codeLength}
          returnKeyType="done"
          onSubmitEditing={() => code.length === codeLength && signIn()}
          editable={!busy}
          autoFocus
          style={[inputStyle, styles.code]}
          accessibilityLabel="6-digit code"
          testID="account-code"
        />
        {errorText}
        <View style={styles.buttons}>
          <Button
            title="Sign in"
            kind="primary"
            onPress={signIn}
            disabled={busy || code.length !== codeLength}
            testID="account-sign-in"
          />
          <Button
            title={secondsLeft > 0 ? `Resend code in ${secondsLeft} s` : "Resend code"}
            onPress={sendCode}
            disabled={busy || secondsLeft > 0}
            testID="account-resend"
          />
          <Button
            title="Use a different email"
            onPress={switchEmail}
            disabled={busy}
            testID="account-different-email"
          />
        </View>
      </>
    );
  }

  return (
    <View testID="account-section">
      <Text style={[styles.section, { color: theme.muted }]}>Account</Text>
      <View style={[styles.box, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        {body}
      </View>
      <MenuSheet
        visible={askSignOut}
        title="Sign out?"
        message="This removes your data from this device. It stays in your account."
        onClose={() => setAskSignOut(false)}
        testID="sign-out-sheet"
        options={[
          {
            title: "Sign out",
            danger: true,
            onPress: () => run(() => auth.signOut()),
            testID: "sign-out-confirm",
          },
        ]}
      />
      <MenuSheet
        visible={eraseAsked}
        title="Replace the data on this device?"
        message="This device holds another account's data. Signing in removes it from this device. It stays in that account."
        onClose={() => setEraseAsked(false)}
        testID="sign-in-erase-sheet"
        options={[
          {
            title: "Remove it and sign in",
            danger: true,
            onPress: () => {
              if (pendingErase) auth.finishSignIn(pendingErase);
              setPendingErase(null);
              reset();
            },
            testID: "sign-in-erase-confirm",
          },
          { title: "Don't sign in", onPress: cancelPending, testID: "sign-in-erase-cancel" },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 6,
    marginLeft: 8,
  },
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 8 },
  email: { fontSize: 17, fontWeight: "600" },
  detail: { fontSize: 15 },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 10, padding: 12 },
  code: { letterSpacing: 6 },
  error: { fontSize: 14 },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
});
