export function StudioShell() {
  return (
    <div className="bg-border grid min-h-0 flex-1 grid-cols-1 gap-px md:grid-cols-3">
      <section aria-label="Chat" className="bg-background flex min-h-48 flex-col p-4 md:min-h-0">
        <h2 className="text-foreground mb-2 text-sm font-medium">Chat</h2>
        <p className="text-muted-foreground text-xs">Build and refine your spec in conversation.</p>
      </section>
      <section
        aria-label="Spec editor"
        className="bg-background flex min-h-48 flex-col p-4 md:min-h-0"
      >
        <h2 className="text-foreground mb-2 text-sm font-medium">Spec editor</h2>
        <p className="text-muted-foreground text-xs">OpenAPI YAML with live validation.</p>
      </section>
      <section
        aria-label="Playground"
        className="bg-background flex min-h-48 flex-col p-4 md:min-h-0"
      >
        <h2 className="text-foreground mb-2 text-sm font-medium">Playground</h2>
        <p className="text-muted-foreground text-xs">Mock server and generated request UI.</p>
      </section>
    </div>
  );
}
