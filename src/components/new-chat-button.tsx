import Link from "next/link";

import { SidebarMenuButton } from "@/components/ui/sidebar";

interface Props {
  agentId: null | string;
}

export const NewChatButton = ({ agentId }: Props) => {
  const href =
    agentId === null ? ("/agents/new" as const) : (`/chats/new?agent=${agentId}` as const);

  return (
    <SidebarMenuButton asChild>
      <Link href={href}>
        <span>new chat</span>
      </Link>
    </SidebarMenuButton>
  );
};
