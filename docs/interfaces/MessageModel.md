---
title: docs/interface/MessageModel
group: docs
---

# MessageModel

A single message in an LLM chat history.
Covers all roles: system instructions, user input, assistant responses, and tool results.

## Properties

### role

```ts
role: Role
```

Sender role — determines how the message is interpreted by the model.

### content

```ts
content: string
```

Text content of the message. Empty string for assistant messages that only contain tool_calls.

### reasoning_content

```ts
reasoning_content: string
```

Chain-of-thought / reasoning exposed by some providers (e.g. DeepSeek).

### tool_calls

```ts
tool_calls: MessageToolCall[]
```

Tool calls emitted by the assistant. Present only on assistant messages.

### images

```ts
images: string[] | Blob[] | Uint8Array<ArrayBufferLike>[]
```

Images attached to the message. Supported as Blob, raw bytes, or base64 strings.

### tool_call_id

```ts
tool_call_id: string
```

ID of the tool call this message is responding to. Present only on tool messages.
