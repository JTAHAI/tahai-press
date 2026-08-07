# Local-first collaboration

The publication works without this optional service. Portable JSON review records carry comments, suggestions, decisions, revision snapshots, and signed handoff packages; an explicit editor promotion remains a normal repository action.

The isolated package uses pinned MIT-licensed Yjs only for editor-side shared draft state. It is never bundled into public reader pages, never required to publish, and does not configure a provider. If a provider is added by a deployment owner, it must use `wss://`, keep credentials out of the URL, remain editor-only, expose explicit conflict resolution, and support export, retention, and session deletion.
