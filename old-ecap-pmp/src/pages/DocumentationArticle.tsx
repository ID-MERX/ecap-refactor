import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Book } from "lucide-react";
import { articles } from "@/data/documentationArticles";

const DocumentationArticle = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const article = articles.find(a => a.slug === slug);

  if (!article) {
    return (
      <DashboardLayout subtitle="Article not found">
        <div className="py-20 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-50 text-slate-300 mb-4">
            <Book className="h-10 w-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Article not found</h3>
          <p className="text-slate-500">The documentation article you're looking for doesn't exist.</p>
          <Button variant="outline" onClick={() => navigate("/documentation")} className="font-bold">
            Back to documentation
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout subtitle={article.title}>
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
        <Button
          variant="ghost"
          onClick={() => navigate("/documentation")}
          className="group flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-bold transition-all p-0 hover:bg-transparent"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 group-hover:bg-emerald-50 transition-all">
            <ArrowLeft className="h-4 w-4" />
          </div>
          Back to documentation
        </Button>

        <div className="space-y-3">
          <Badge variant="outline" className="px-3 py-1 text-emerald-600 border-emerald-200 bg-emerald-50 font-medium">
            {article.category}
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{article.title}</h1>
        </div>

        <div className="prose prose-slate max-w-none">
          {article.content.split("\n\n").map((paragraph, idx) => {
            if (paragraph.startsWith("- ")) {
              const items = paragraph.split("\n").filter(l => l.startsWith("- "));
              return (
                <ul key={idx} className="space-y-2 my-4">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span dangerouslySetInnerHTML={{ __html: item.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    </li>
                  ))}
                </ul>
              );
            }
            if (paragraph.includes("|")) {
              const rows = paragraph.split("\n").filter(r => r.trim() && !r.trim().startsWith("|--"));
              const headers = rows[0]?.split("|").filter(Boolean).map(h => h.trim());
              const dataRows = rows.slice(1).map(r => r.split("|").filter(Boolean).map(c => c.trim()));
              return (
                <div key={idx} className="overflow-x-auto my-4">
                  <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50">
                      <tr>
                        {headers?.map((h, i) => (
                          <th key={i} className="px-4 py-2 text-left font-bold text-slate-700 border-b">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataRows.map((row, ri) => (
                        <tr key={ri} className="border-b border-slate-100">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-4 py-2 text-slate-600">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
            return (
              <p key={idx} className="text-sm text-slate-600 leading-relaxed my-3" dangerouslySetInnerHTML={{ __html: paragraph.replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900">$1</strong>') }} />
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DocumentationArticle;
