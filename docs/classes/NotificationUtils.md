---
title: docs/class/NotificationUtils
group: docs
---

# NotificationUtils

Public facade for notification operations.

Automatically calls waitForInit on each userspace method call.
Provides simplified access to notification instance methods.

## Constructor

```ts
constructor();
```

## Properties

### _instance

```ts
_instance: any
```

Internal instance containing business logic

## Methods

### getData

```ts
getData(): Promise<NotificationModel[]>;
```

Returns all notifications in chronological order (newest first).

### clear

```ts
clear(): Promise<void>;
```

Clears all notification history.
