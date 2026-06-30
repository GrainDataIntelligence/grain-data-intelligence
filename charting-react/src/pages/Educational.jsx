import { useEffect, useMemo, useState } from "react";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function ArticleBlock({ block }) {
  if (block.type === "heading") {
    return <h2 className="mt-8 text-xl font-bold text-slate-950">{block.text}</h2>;
  }

  if (block.type === "subtitle") {
    return <p className="text-base font-semibold text-slate-600">{block.text}</p>;
  }

  return <p className="text-[15px] leading-7 text-slate-700">{block.text}</p>;
}

export default function Educational() {
  const [payload, setPayload] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch(`/data/education/articles.json?t=${Date.now()}`)
      .then((response) => {
        if (!response.ok) throw new Error("Education content is not available yet.");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setSelectedId(data.articles?.[0]?.id || "");
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const articles = payload?.articles || [];
  const selectedArticle = useMemo(
    () => articles.find((article) => article.id === selectedId) || articles[0],
    [articles, selectedId],
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-8 py-7">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Education</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">Education Hub</h1>
      </div>

      <div className="grid gap-5 px-6 py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-950">Articles</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Word documents dropped into the education folder will appear here after conversion.
            </p>
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="space-y-2">
            {articles.map((article) => (
              <button
                key={article.id}
                type="button"
                onClick={() => setSelectedId(article.id)}
                className={`w-full rounded border px-3 py-3 text-left text-sm transition ${
                  article.id === selectedArticle?.id
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
                }`}
              >
                <span className="block font-bold">{article.title}</span>
                {article.updatedAt ? (
                  <span className="mt-1 block text-xs opacity-75">Updated {formatDate(article.updatedAt)}</span>
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        <main className="rounded-md border border-slate-200 bg-white shadow-sm">
          {selectedArticle ? (
            <article className="mx-auto max-w-4xl px-8 py-8">
              <div className="border-b border-slate-200 pb-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">GDI Education</p>
                <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950">{selectedArticle.title}</h2>
                {selectedArticle.subtitle ? (
                  <p className="mt-3 text-base leading-7 text-slate-600">{selectedArticle.subtitle}</p>
                ) : null}
              </div>

              <div className="mt-6 space-y-4">
                {selectedArticle.blocks.map((block, index) => (
                  <ArticleBlock key={`${block.type}-${index}`} block={block} />
                ))}
              </div>
            </article>
          ) : (
            <div className="p-8 text-sm text-slate-600">No education articles converted yet.</div>
          )}
        </main>
      </div>
    </div>
  );
}
