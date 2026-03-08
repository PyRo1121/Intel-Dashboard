import { Meta, Title } from "@solidjs/meta";
import { useLocation } from "@solidjs/router";
import AuthAccessCard from "~/components/auth/AuthAccessCard";
import { normalizeClientPostAuthPath } from "~/lib/auth-next";
import { SIGNUP_DESCRIPTION, SIGNUP_TITLE } from "../../shared/route-meta.ts";

export default function SignupRoute() {
  const location = useLocation();
  const nextPath = normalizeClientPostAuthPath(new URLSearchParams(location.search).get("next"));
  return (
    <>
      <Title>{SIGNUP_TITLE}</Title>
      <Meta name="description" content={SIGNUP_DESCRIPTION} />
      <AuthAccessCard mode="signup" nextPath={nextPath} />
    </>
  );
}
