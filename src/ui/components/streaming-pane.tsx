import React, { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { StreamingBus, StreamingToolCall, StreamingToolResult } from "../streaming-bus.js";

interface StreamingPaneProps {
  bus: StreamingBus;
}

export const StreamingPane = React.memo(function StreamingPane({ bus }: StreamingPaneProps) {
  const [content, setContent] = useState("");
  const [tools, setTools] = useState<StreamingToolCall[] | null>(null);
  const [toolResults, setToolResults] = useState<StreamingToolResult[] | null>(null);
  const bufferRef = useRef("");
  const lastFlushRef = useRef(0);

  useEffect(() => {
    const onContent = (text: string) => {
      bufferRef.current += text;
      const now = Date.now();
      if (now - lastFlushRef.current > 250 || bufferRef.current.length > 1000) {
        setContent((prev) => prev + bufferRef.current);
        bufferRef.current = "";
        lastFlushRef.current = now;
      }
    };
    const onTools = (ts: StreamingToolCall[]) => setTools(ts);
    const onToolResult = (tr: StreamingToolResult) => setToolResults((prev) => (prev ? [...prev, tr] : [tr]));
    const onTokenCount = (_count: number) => {};
    const onDone = () => {
      if (bufferRef.current) {
        setContent((prev) => prev + bufferRef.current);
        bufferRef.current = "";
      }
      // Do not clear content here; parent will finalize and push. Just keep shown until next start.
      setTools(null);
      setToolResults(null);
    };

    bus.on("content", onContent);
    bus.on("tools", onTools);
    bus.on("tool_result", onToolResult);
    bus.on("token_count", onTokenCount);
    bus.on("done", onDone);
    return () => {
      bus.off("content", onContent);
      bus.off("tools", onTools);
      bus.off("tool_result", onToolResult);
      bus.off("token_count", onTokenCount);
      bus.off("done", onDone);
    };
  }, [bus]);

  if (!content && !(tools && tools.length) && !(toolResults && toolResults.length)) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      {content && (
        <Box flexDirection="row" alignItems="flex-start">
          <Text color="white">⏺ </Text>
          <Box flexDirection="column" flexGrow={1}>
            <Text color="white">{content}</Text>
            <Text color="cyan">█</Text>
          </Box>
        </Box>
      )}
      {tools && tools.length > 0 && (
        <Box marginLeft={2} flexDirection="column">
          <Text color="gray">⎿ Executing tools...</Text>
          {tools.map((tc, idx) => (
            <Text key={tc.id || idx} color="gray">⎿ {tc.function?.name || "tool"}</Text>
          ))}
        </Box>
      )}
      {toolResults && toolResults.length > 0 && (
        <Box marginLeft={2} flexDirection="column">
          <Text color="gray">⎿ Tool results:</Text>
          {toolResults.map((tr, idx) => (
            <Text key={`tr_${idx}`} color="gray">⎿ {tr.content.split("\n")[0]}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
});

