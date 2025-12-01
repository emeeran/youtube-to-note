# API Reference (Canonical Location)

The detailed API surface—covering plugin lifecycle hooks, service contracts, provider adapters, event emitters, and configuration schemas—now lives exclusively in [`docs/API.md`](docs/API.md).

That file includes:
- Public classes (`YouTubeProcessor`, `ServiceContainer`, modal managers) and their extension hooks
- Service interfaces (`AIService`, `PromptService`, `FileService`, `VideoDataService`, `EncryptionService`, retry/cache helpers)
- Provider adapter contracts for Gemini, Groq, and optional Ollama/local engines with init options and error semantics
- Settings schemas, manifest segments, and CLI overrides for automation environments
- Event + command registration examples for Obsidian integrations
- End-to-end code samples for adding new providers, output modes, or UI surfaces

-> Update `docs/API.md` whenever the contract changes to keep downstream extension authors and automation tooling in sync.
