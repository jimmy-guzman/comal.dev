import Image from "next/image";
import Link from "next/link";

import { AGENTS } from "@/agents";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-12 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <Image src="/mascot.svg" alt="comal.dev mascot" width={80} height={80} priority />
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">comal.dev</h1>
          <p className="text-muted-foreground max-w-sm text-sm">
            A playground to play with AI agents, built by{" "}
            <a
              href="https://jimmy.codes"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              jimmy.codes
            </a>
            .
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {AGENTS.map((agent) => (
          <Card key={agent.id}>
            <CardHeader>
              <CardTitle>{agent.name}</CardTitle>
              <CardDescription>{agent.description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href={`/agents/${agent.id}`}>Start chatting</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
