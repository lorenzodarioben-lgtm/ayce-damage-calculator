import { RouteLoading } from '@/components/ui/RouteLoading';

export default function HistoryDetailLoading() {
  return (
    <RouteLoading
      label="Opening the file"
      title="Retrieving this session."
      description="The record is being read from this browser only."
    />
  );
}
