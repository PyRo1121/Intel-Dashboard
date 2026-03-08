import { Meta, Title } from "@solidjs/meta";
import { useLocation } from "@solidjs/router";
import AuthAccessCard from "~/components/auth/AuthAccessCard";
import { normalizeClientPostAuthPath } from "~/lib/auth-next";
import { LOGIN_DESCRIPTION, LOGIN_TITLE } from "../../shared/route-meta.ts";

export default function LoginRoute() {
  const location = useLocation();
  const nextPath = normalizeClientPostAuthPath(new URLSearchParams(location.search).get("next"));
  return (
    <>
      <Title>{LOGIN_TITLE}</Title>
      <Meta name="description" content={LOGIN_DESCRIPTION} />
      <AuthAccessCard mode="login" nextPath={nextPath} />
    </>
  );
}
