# Grok Video Downloader

Chrome extension for downloading your authenticated Grok `video/mp4` assets.

The popup UI supports English by default and Russian as an optional language.

## Install

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder: `grok-video-downloader-extension`.

## Use

1. Open `https://grok.com/files?fileType=video` and log in.
2. Open the extension popup.
3. Click `Scan`.
4. Click `Download`.

Files are saved under Chrome's default Downloads folder, inside the configured subfolder.
The default subfolder is `grok-videos`.

The extension uses:

- `https://grok.com/rest/assets?includeImagineFiles=true&mimeTypes=video%2Fmp4`
- `nextPageToken` via the `pageToken` query parameter
- `chrome.downloads.download`

It does not delete files and does not upload anything.
