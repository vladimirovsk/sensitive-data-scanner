# Sensitive Data Scanner

This project is a Node.js application built with [NestJS](https://nestjs.com/) designed to download files from an Amazon S3 bucket and scan them for sensitive data using optical character recognition (OCR) and text analysis. It consists of two main modules:

- **S3 Downloader**: Downloads all files from an S3 bucket to a local directory.
- **Sensitive Data Scanner**: Scans the local directory for sensitive information such as emails, phone numbers, or other predefined patterns.

## Features

### S3 Downloader
The `S3Service.downloadAllFiles()` module connects to an Amazon S3 bucket and retrieves all files, storing them in a configurable local directory (`LOCAL_DIR`). This allows for offline processing and analysis of S3-stored content.

### Sensitive Data Scanner
The `ScanDocService.analyzeAllFiles()` module scans the local directory recursively to detect sensitive data. It leverages the [Tesseract.js](https://github.com/naptha/tesseract.js) library for OCR to extract text from images and supports a variety of file types. The scanner identifies sensitive data based on predefined regular expression patterns (e.g., emails, phone numbers) and logs the results.

#### Supported File Types
The scanner processes the following file formats:
- **Images**:
  - `.jpg`, `.jpeg` (JPEG images)
  - `.png` (PNG images)
  - `.heic` (High-Efficiency Image Container, converted to JPEG for processing)
- **Documents**:
  - `.pdf` (Portable Document Format)
  - `.docx` (Microsoft Word documents)
- **Text**:
  - Plain text files (e.g., `.txt`)

#### Output
- **Sensitive Data**: Files containing sensitive information are logged and saved to `sensitive-files.json`.
- **Errors**: Files that fail to process (e.g., corrupted images or unsupported formats) are logged and saved to `error-files.json`.
- **Progress Tracking**: The scanning process resumes from the last processed file (tracked in `last-processed.txt`) after interruption.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/sensitive-data-scanner.git
   cd sensitive-data-scanner