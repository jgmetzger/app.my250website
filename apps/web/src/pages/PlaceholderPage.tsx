import { Layout } from "../components/Layout.js";

export function PlaceholderPage({ title, phase }: { title: string; phase: number }) {
  return (
    <Layout>
      <div className="card max-w-xl mx-auto text-center">
        <h1 className="font-serif text-3xl mb-2">
          <span className="italic">{title}</span>
        </h1>
        <p className="text-muted">
          Ships in phase {phase}. The route is reserved so the navigation doesn't 404.
        </p>
      </div>
    </Layout>
  );
}
