import { MaintenanceMessage } from "@/components/maintenance-message";

export const metadata = {
  title: "SuicaoDex đang bảo trì",
  description: "SuicaoDex tạm thời bảo trì để nâng cấp trải nghiệm",
};

export default function MaintenancePage() {
  return <MaintenanceMessage />;
}
