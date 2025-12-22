import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { getApiSources } from "@/app/actions/cms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SourceForm from "./components/source-form";
import SourceRow from "./components/source-row";

export default function VerifyCmsPage() {
  return (
    <div className="container py-8 max-w-7xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">API Sources</h1>
        <p className="text-muted-foreground">
          Manage MAC CMS API sources for video content.
        </p>
      </div>

      <div className="space-y-6">
        <SourceForm />
        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <Suspended />
        </Suspense>
      </div>
    </div>
  );
}

async function Suspended() {
  const sources = await getApiSources();

  return (
    <div className="border rounded-md border-white/10 overflow-hidden">
      <Table>
        <TableHeader className="bg-white/5">
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="w-50">Name</TableHead>
            <TableHead>URL</TableHead>
            <TableHead className="w-25">Type</TableHead>
            <TableHead className="w-25 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center py-8 text-muted-foreground"
              >
                No API sources found. Add one above.
              </TableCell>
            </TableRow>
          ) : (
            sources.map((source) => (
              <SourceRow key={source.id} source={source} />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
