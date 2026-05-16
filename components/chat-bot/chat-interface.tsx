"use client";

import { useChat } from "@ai-sdk/react";
import {
  ChevronsRightIcon,
  CopyIcon,
  GlobeIcon,
  RefreshCcwIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Messages } from "@/get-dictionary";
import { useChatStore } from "@/lib/store/chat-store";
import HoverPrefetchLink from "../hover-prefetch-link";

export function ChatInterface({
  isDesktop,
  dictionary,
}: {
  isDesktop: boolean;
  dictionary: Messages;
}) {
  const [input, setInput] = React.useState("");
  const [webSearch, setWebSearch] = React.useState(false);
  const { messages, sendMessage, status, regenerate, setMessages } = useChat();
  const { toggle } = useChatStore();
  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments)) {
      return;
    }
    sendMessage(
      {
        text: message.text || dictionary.chat["sent-with-attachments"],
        files: message.files,
      },
      {
        body: {
          webSearch: webSearch,
        },
      },
    );
    setInput("");
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between pl-3.5 pr-2 py-2 sticky top-0 bg-background-100 h-16 z-10">
        <h2 className="font-semibold text-sm">{dictionary.chat.title}</h2>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" onClick={() => setMessages([])}>
                <TrashIcon />
                <span className="sr-only">{dictionary.chat.clear}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="z-100">
              {dictionary.chat.clear}
            </TooltipContent>
          </Tooltip>
          <Button variant="ghost" onClick={toggle}>
            {isDesktop ? <ChevronsRightIcon /> : <XIcon />}
            <span className="sr-only">{dictionary.common.close}</span>
          </Button>
        </div>
      </div>
      <Conversation className="h-full overflow-hidden">
        <ConversationContent>
          {messages.map((message) => (
            <div key={message.id}>
              {message.role === "assistant" &&
                message.parts.filter((part) => part.type === "source-url")
                  .length > 0 && (
                  <Sources>
                    <SourcesTrigger
                      count={
                        message.parts.filter(
                          (part) => part.type === "source-url",
                        ).length
                      }
                    >
                      <span className="font-medium">
                        {dictionary.chat["sources-used"].replace(
                          "{count}",
                          String(
                            message.parts.filter(
                              (part) => part.type === "source-url",
                            ).length,
                          ),
                        )}
                      </span>
                    </SourcesTrigger>
                    {message.parts
                      .filter((part) => part.type === "source-url")
                      .map((part, i) => (
                        <SourcesContent key={`${message.id}-${i}`}>
                          <Source
                            key={`${message.id}-${i}`}
                            href={part.url}
                            title={part.url}
                          />
                        </SourcesContent>
                      ))}
                  </Sources>
                )}
              {message.parts.map((part, i) => {
                switch (part.type) {
                  case "text":
                    return (
                      <Message key={`${message.id}-${i}`} from={message.role}>
                        <MessageContent>
                          <MessageResponse
                            components={{
                              a: ({ href, children, ...props }) =>
                                !href || href.startsWith("http") ? (
                                  <a {...props}>{children}</a>
                                ) : (
                                  <HoverPrefetchLink
                                    href={href}
                                    className="animated-underline"
                                  >
                                    {children}
                                  </HoverPrefetchLink>
                                ),
                            }}
                          >
                            {part.text}
                          </MessageResponse>
                        </MessageContent>
                        {message.role === "assistant" &&
                          i === messages.length - 1 && (
                            <MessageActions>
                              <MessageAction
                                onClick={() => regenerate()}
                                label={dictionary.common.retry}
                              >
                                <RefreshCcwIcon className="size-3" />
                              </MessageAction>
                              <MessageAction
                                onClick={() =>
                                  navigator.clipboard.writeText(part.text)
                                }
                                label={dictionary.common.copy}
                              >
                                <CopyIcon className="size-3" />
                              </MessageAction>
                            </MessageActions>
                          )}
                      </Message>
                    );
                  case "reasoning":
                    return (
                      <Reasoning
                        key={`${message.id}-${i}`}
                        className="w-full"
                        isStreaming={
                          status === "streaming" &&
                          i === message.parts.length - 1 &&
                          message.id === messages.at(-1)?.id
                        }
                      >
                        <ReasoningTrigger
                          getThinkingMessage={(isStreaming, duration) => {
                            if (isStreaming || duration === 0) {
                              return dictionary.chat.thinking;
                            }
                            if (duration === undefined) {
                              return dictionary.chat["thought-few"];
                            }
                            return dictionary.chat["thought-seconds"].replace(
                              "{seconds}",
                              String(duration),
                            );
                          }}
                        />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    );
                  default:
                    return null;
                }
              })}
            </div>
          ))}
          {status === "submitted" && <Loader />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="p-4 border-t border-border">
        <PromptInput
          onSubmit={handleSubmit}
          className=""
          globalDrop
          multiple
          uploadLabel={dictionary.common["upload-files"]}
        >
          <PromptInputHeader>
            <PromptInputAttachments>
              {(attachment) => (
                <PromptInputAttachment
                  data={attachment}
                  attachmentLabel={dictionary.chat.attachment}
                  imageLabel={dictionary.chat.image}
                  removeLabel={dictionary.common.remove}
                />
              )}
            </PromptInputAttachments>
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              placeholder={dictionary.chat.placeholder}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments
                    label={dictionary.chat["add-attachments"]}
                  />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputButton
                variant={webSearch ? "default" : "ghost"}
                onClick={() => setWebSearch(!webSearch)}
              >
                <GlobeIcon size={16} />
                <span>{dictionary.chat["web-search"]}</span>
              </PromptInputButton>
            </PromptInputTools>
            <PromptInputSubmit
              aria-label={dictionary.common.submit}
              disabled={!input && !status}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
