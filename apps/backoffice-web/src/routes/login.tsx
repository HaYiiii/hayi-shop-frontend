import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { meQuery, rememberIdentifier } from "../features/identity/api/session";
import { SignIn } from "../features/identity/components/sign-in";
import { useApi } from "../lib/api";

export const Route = createFileRoute("/login")({ component: LoginScreen });

function LoginScreen() {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (
    <SignIn
      onSignedIn={(identifier) => {
        rememberIdentifier(queryClient, identifier);
        void queryClient.invalidateQueries({ queryKey: meQuery(api).queryKey }).then(() => navigate({ to: "/" }));
      }}
    />
  );
}
