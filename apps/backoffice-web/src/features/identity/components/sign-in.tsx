import type { BackofficeComponents } from "@hayi/api-client";
import { useState } from "react";
import { FirstPasswordForm } from "./first-password-form";
import { LoginForm, type LoginNotice } from "./login-form";
import { MfaEnroll } from "./mfa-enroll";
import { MfaVerifyForm } from "./mfa-verify-form";
import { RecoveryCodes } from "./recovery-codes";

type LoginResponse = BackofficeComponents["schemas"]["LoginResponse"];

/**
 * Sign-in steps (API 01-security §6.2, Decision K3, L8). Step tokens stay in memory only — never in the
 * URL, history or storage — so a reload starts again at the password step.
 */
type Step =
  | { kind: "login"; notice?: LoginNotice | undefined }
  | { kind: "password"; changeToken: string }
  | { kind: "enroll"; enrollmentToken: string }
  | { kind: "mfa"; challengeId: string }
  | { kind: "recovery"; codes: string[] };

/**
 * Password change comes first, then MFA (Decision L8). Signed in only when every flag is false; a flag
 * without its token is a broken answer, never a sign-in.
 */
function nextStep(result: LoginResponse): Step | "signed-in" {
  if (result.passwordChangeRequired) {
    return result.changeToken ? { kind: "password", changeToken: result.changeToken } : { kind: "login", notice: "unexpected" };
  }
  if (result.mfaEnrollmentRequired) {
    return result.enrollmentToken
      ? { kind: "enroll", enrollmentToken: result.enrollmentToken }
      : { kind: "login", notice: "unexpected" };
  }
  if (result.mfaRequired) {
    return result.mfaChallengeId ? { kind: "mfa", challengeId: result.mfaChallengeId } : { kind: "login", notice: "unexpected" };
  }
  return "signed-in";
}

export function SignIn({ onSignedIn }: { onSignedIn: (identifier: string) => void }) {
  const [step, setStep] = useState<Step>({ kind: "login" });
  const [identifier, setIdentifier] = useState("");
  const restart = (notice?: LoginNotice) => setStep({ kind: "login", notice });

  switch (step.kind) {
    case "login":
      return (
        <LoginForm
          key={step.notice ?? "login"}
          defaultIdentifier={identifier}
          notice={step.notice}
          onResult={(result, id) => {
            setIdentifier(id);
            const next = nextStep(result);
            if (next === "signed-in") onSignedIn(id);
            else setStep(next);
          }}
        />
      );
    case "password":
      return (
        <FirstPasswordForm
          changeToken={step.changeToken}
          identifier={identifier}
          onChanged={() => restart("password-changed")}
          onRestart={restart}
        />
      );
    case "enroll":
      return (
        <MfaEnroll
          enrollmentToken={step.enrollmentToken}
          onEnrolled={(codes) => setStep({ kind: "recovery", codes })}
          onRestart={restart}
        />
      );
    case "mfa":
      return (
        <MfaVerifyForm challengeId={step.challengeId} identifier={identifier} onVerified={() => onSignedIn(identifier)} onRestart={restart} />
      );
    case "recovery":
      return <RecoveryCodes codes={step.codes} onContinue={() => onSignedIn(identifier)} />;
  }
}
