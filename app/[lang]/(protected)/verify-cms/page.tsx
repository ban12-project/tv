import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";
import { getApiSources } from "@/lib/actions/cms";
import SourceForm from "./components/source-form";
import SourceRow from "./components/source-row";

export default async function VerifyCmsPage({
  params,
}: PageProps<"/[lang]/verify-cms">) {
  const { lang } = await params;
  const [sources, dictionary] = await Promise.all([
    getApiSources(),
    getDictionary(lang as Locale),
  ]);
  const messages = dictionary["verify-cms"];

  return (
    <div className="container py-8 max-w-7xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{messages.title}</h1>
        <p className="text-muted-foreground">{messages.description}</p>
      </div>

      <div className="space-y-6">
        <SourceForm dictionary={messages} />
        <div className="border rounded-md border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-50">{messages.name}</TableHead>
                <TableHead>{messages.url}</TableHead>
                <TableHead className="w-25">{messages.type}</TableHead>
                <TableHead className="w-25 text-right">
                  {messages.actions}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {messages.empty}
                  </TableCell>
                </TableRow>
              ) : (
                sources.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    dictionary={messages}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
