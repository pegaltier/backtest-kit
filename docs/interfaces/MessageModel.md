---
title: docs/api-reference/interface/MessageModel
group: docs
---

# MessageModel

Message model for LLM conversation history.
Used in Optimizer to build prompts and maintain conversation context.

## Properties

### role

```ts
role: MessageRole
```

The sender of the message.
- "system": System instructions and context
- "user": User input and questions
- "assistant": LLM responses

### content

```ts
content: string
```

The text content of the message.
Contains the actual message text sent or received.
