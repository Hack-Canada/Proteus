import Container from "@/components/Container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReimbursementsLoading() {
  return (
    <Container className="space-y-6 md:space-y-10">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
      </div>
      <Skeleton className="h-64 rounded-3xl" />
    </Container>
  );
}
