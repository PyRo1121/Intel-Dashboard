import OverviewPage from "~/components/routes/OverviewPage";
import { siteUrl } from "../../../../packages/shared/site-config.ts";

export default function OverviewRoute() {
  return <OverviewPage canonicalHref={siteUrl("/")} />;
}
