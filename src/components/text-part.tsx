"use client";

import type { TextUIPart } from "ai";

import { MessageResponse } from "@/components/ai-elements/message";

interface TextPartProps {
  part: TextUIPart;
}

export const TextPart = ({ part }: TextPartProps) => {
  return (
    <MessageResponse isAnimating={part.state === "streaming"}>{part.text}</MessageResponse>
  );
};
