"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

interface Props {
  email: string;
  image: null | string;
  isAnonymous: boolean;
  name: string;
}

const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

export const AccountPanel = ({ email, image, isAnonymous, name }: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (isAnonymous) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          you&apos;re using an anonymous session. sign in to save your chats and settings across
          devices.
        </p>
        <div>
          <Button asChild size="sm">
            <Link href="/sign-in">sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    setPending(true);

    try {
      await authClient.signOut();
      router.push("/sign-in");
    } catch {
      toast.error("couldn't sign out. please try again.");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar size="lg">
          {image === null ? null : <AvatarImage alt={name} src={image} />}
          <AvatarFallback>{initialOf(name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-muted-foreground truncate text-xs">{email}</p>
        </div>
      </div>
      <div>
        <Button disabled={pending} onClick={handleSignOut} size="sm" variant="outline">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          sign out
        </Button>
      </div>
    </div>
  );
};
