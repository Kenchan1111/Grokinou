import React, { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
export const StreamingPane = React.memo(function StreamingPane({ bus }) {
    const [content, setContent] = useState("");
    const [tools, setTools] = useState(null);
    const [toolResults, setToolResults] = useState(null);
    const bufferRef = useRef("");
    const lastFlushRef = useRef(0);
    useEffect(() => {
        const onContent = (text) => {
            bufferRef.current += text;
            const now = Date.now();
            if (now - lastFlushRef.current > 250 || bufferRef.current.length > 1000) {
                setContent((prev) => prev + bufferRef.current);
                bufferRef.current = "";
                lastFlushRef.current = now;
            }
        };
        const onTools = (ts) => setTools(ts);
        const onToolResult = (tr) => setToolResults((prev) => (prev ? [...prev, tr] : [tr]));
        const onTokenCount = (_count) => { };
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
    if (!content && !(tools && tools.length) && !(toolResults && toolResults.length))
        return null;
    return (React.createElement(Box, { flexDirection: "column", marginTop: 1 },
        content && (React.createElement(Box, { flexDirection: "row", alignItems: "flex-start" },
            React.createElement(Text, { color: "white" }, "\u23FA "),
            React.createElement(Box, { flexDirection: "column", flexGrow: 1 },
                React.createElement(Text, { color: "white" }, content),
                React.createElement(Text, { color: "cyan" }, "\u2588")))),
        tools && tools.length > 0 && (React.createElement(Box, { marginLeft: 2, flexDirection: "column" },
            React.createElement(Text, { color: "gray" }, "\u23BF Executing tools..."),
            tools.map((tc, idx) => (React.createElement(Text, { key: tc.id || idx, color: "gray" },
                "\u23BF ",
                tc.function?.name || "tool"))))),
        toolResults && toolResults.length > 0 && (React.createElement(Box, { marginLeft: 2, flexDirection: "column" },
            React.createElement(Text, { color: "gray" }, "\u23BF Tool results:"),
            toolResults.map((tr, idx) => (React.createElement(Text, { key: `tr_${idx}`, color: "gray" },
                "\u23BF ",
                tr.content.split("\n")[0])))))));
});
//# sourceMappingURL=streaming-pane.js.map