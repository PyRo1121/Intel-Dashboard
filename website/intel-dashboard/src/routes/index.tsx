import OverviewPage from "~/components/routes/OverviewPage";
import { siteUrl } from "../../shared/site-config.ts";

export default function OverviewRoute() {
  return <OverviewPage canonicalHref={siteUrl("/")} />;
}
