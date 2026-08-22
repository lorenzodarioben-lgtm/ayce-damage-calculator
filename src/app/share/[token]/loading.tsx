import { RouteLoading } from '@/components/ui/RouteLoading';

export default function SharedReportLoading() {
  return (
    <RouteLoading
      label="Reading the shared report"
      title="Setting the table."
      description="The report is being reconstructed from the link. Nothing on this device is changed."
    />
  );
}
