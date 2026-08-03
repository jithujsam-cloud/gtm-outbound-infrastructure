import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project } from "@/types";

export function ProjectCard({ project }: { project: Project & { lead_count: number } }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer h-full">
        <CardHeader>
          <CardTitle className="text-base">{project.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {project.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {project.lead_count} lead{project.lead_count !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}
