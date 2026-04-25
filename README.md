# Grok Video Downloader

Chrome extension for downloading all of your generated Grok/Imagine videos in one batch.

If you have been generating videos in Grok, you may end up with dozens, hundreds, or thousands of
`generated_video.mp4` files in `https://grok.com/files?fileType=video`. Grok's UI does not provide a
simple "download everything" button, so saving them one by one is slow. This extension scans your
authenticated Grok video library and sends every `video/mp4` asset to Chrome's download manager.

It is meant for your own generated videos. It uses the Grok session already open in your browser and
only downloads the files returned by your account's assets API.

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
