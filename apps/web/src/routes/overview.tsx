import OverviewPage from "~/components/routes/OverviewPage";
import { DASHBOARD_HOME_PATH } from "@intel-dashboard/shared/auth-next-routes.ts";
import { siteUrl } from "@intel-dashboard/shared/site-config.ts";

export default function OverviewDashboardRoute() {
  return <OverviewPage canonicalHref={siteUrl(DASHBOARD_HOME_PATH)} />;
}
