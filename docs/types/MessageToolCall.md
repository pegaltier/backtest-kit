---
title: docs/type/MessageToolCall
group: docs
---

# MessageToolCall

```ts
type MessageToolCall = {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: {
            [key: string]: any;
        };
    };
};
```

A tool call requested by the assistant.
Represents a single function invocation emitted in an assistant message.
