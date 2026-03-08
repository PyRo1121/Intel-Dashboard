import OverviewPage from "~/components/routes/OverviewPage";
import { DASHBOARD_HOME_PATH } from "../../../../packages/shared/auth-next-routes.ts";
import { siteUrl } from "../../../../packages/shared/site-config.ts";

export default function OverviewDashboardRoute() {
  return <OverviewPage canonicalHref={siteUrl(DASHBOARD_HOME_PATH)} />;
}
