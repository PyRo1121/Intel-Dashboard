import {
  buildAuthModeSwitchHref,
  buildAuthProviderHref,
} from "@intel-dashboard/shared/auth-flow.ts";
import { getAuthCopy } from "@intel-dashboard/shared/auth-copy.ts";
import { SITE_NAME } from "@intel-dashboard/shared/site-config.ts";

type AuthAccessCardProps = {
  mode: "login" | "signup";
  nextPath?: string | null;
};

export default function AuthAccessCard(props: AuthAccessCardProps) {
  const copy = () => getAuthCopy(props.mode);
  const surfaceTestId = () => `auth-access-${props.mode}`;
  const titleTestId = () => `${surfaceTestId()}-title`;
  const xLinkTestId = () => `${surfaceTestId()}-x`;
  const githubLinkTestId = () => `${surfaceTestId()}-github`;
  const switchLinkTestId = () => `${surfaceTestId()}-switch`;
  const backLinkTestId = () => `${surfaceTestId()}-back`;

  return (
    <main class="intel-app-bg flex items-center px-4 py-8 text-zinc-100" data-testid={surfaceTestId()}>
      <div class="intel-panel relative mx-auto w-full max-w-md p-8">
        <div class="mb-5 intel-badge">
          <span class="h-2 w-2 rounded-full bg-emerald-400" />
          {SITE_NAME} Access
        </div>

        <h1 class="text-3xl font-bold leading-tight tracking-tight text-white" data-testid={titleTestId()}>
          {copy().title}
        </h1>
        <p class="mt-3 text-sm leading-6 text-zinc-400">{copy().description}</p>

        <div class="mt-6 space-y-3">
          <a
            href={buildAuthProviderHref("x", props.mode, props.nextPath ?? null)}
            data-testid={xLinkTestId()}
            class="intel-btn intel-btn-primary w-full"
          >
            {copy().xLabel}
          </a>
          <a
            href={buildAuthProviderHref("github", props.mode, props.nextPath ?? null)}
            data-testid={githubLinkTestId()}
            class="intel-btn intel-btn-ghost w-full"
          >
            {copy().githubLabel}
          </a>
        </div>

        <div class="mt-6 flex items-center justify-between gap-3 text-xs text-zinc-500">
          <span>Secured by Cloudflare Workers</span>
          <a
            class="font-medium text-cyan-300 hover:text-cyan-200"
            href={buildAuthModeSwitchHref(props.mode, props.nextPath ?? null)}
            data-testid={switchLinkTestId()}
          >
            {copy().switchLabel}
          </a>
        </div>

        <a
          class="mt-6 inline-flex text-xs font-medium text-zinc-500 hover:text-zinc-300"
          href="/"
          data-testid={backLinkTestId()}
        >
          {`Back to ${SITE_NAME}`}
        </a>
      </div>
    </main>
  );
}
