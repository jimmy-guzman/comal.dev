export default function AgentLayout({
  conversation,
  detail,
}: {
  conversation: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <>
      {detail}
      {conversation}
    </>
  );
}
