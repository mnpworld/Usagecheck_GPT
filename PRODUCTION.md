# Usagecheck GPT Production V1

Production V1 uses the browser collector as the source of truth. The GitHub Pages dashboard does not generate demo data.

## Realtime flow

1. Collector detects a real prompt submission on chatgpt.com.
2. Usage is stored in chrome.storage.local by category.
3. chrome.storage.onChanged pushes the updated state to the GitHub Pages dashboard immediately.
4. Dashboard recalculates percentage from the configured category limit.

Categories: chat, image, code, research.

The percentage is an internal usage percentage based on configured limits, not a live remaining quota returned by ChatGPT/OpenAI.
