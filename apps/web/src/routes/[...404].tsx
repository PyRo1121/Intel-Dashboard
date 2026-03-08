import { A } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { Title, Meta } from "@solidjs/meta";
import { NOT_FOUND_DESCRIPTION, NOT_FOUND_TITLE } from "../../shared/route-meta.ts";
export default function NotFound() {
  return (
    <>
      <HttpStatusCode code={404} />
      <Title>{NOT_FOUND_TITLE}</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <main class="intel-app-bg flex flex-col items-center justify-center text-center mx-auto p-4">
        <div class="space-y-6 max-w-md">
          <div class="space-y-2">
            <h1 class="text-7xl font-bold text-white tracking-tight">404</h1>
            <p class="text-xl text-zinc-400">Page Not Found</p>
          </div>
          <p class="text-sm text-zinc-500 leading-relaxed">
            {NOT_FOUND_DESCRIPTION}
          </p>
          <div class="pt-4">
            <A href="/" class="intel-btn intel-btn-primary px-6">
              Return Home
            </A>
          </div>
        </div>
      </main>
    </>
  );
}
