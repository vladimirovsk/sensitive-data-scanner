import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as Tesseract from 'tesseract.js';
import * as mammoth from 'mammoth';
import * as heicConvert from 'heic-convert';
import * as sharp from 'sharp';
import { ScanResult } from './scan-documents.interface';
import { patterns } from './sensitive.constants';

export class SensitiveDataScanner {
  private readonly logger = new Logger(SensitiveDataScanner.name);

  constructor(private readonly onSensitiveDataFound?: (filePath: string, matches: Record<string, string[]>) => void) {}

  private scanTextContent(content: string): { hasSensitiveData: boolean; matches: Record<string, string[]> } {
    const matches: Record<string, string[]> = {};

    for (const [type, pattern] of Object.entries(patterns)) {
      const found = content.match(pattern);
      if (found) {
        matches[type] = found;
      }
    }

    const hasSensitiveData = Object.keys(matches).length > 0;
    return { hasSensitiveData, matches };
  }

  private async extractTextFromPdf(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return pdfData.text.trim();
    } catch (error) {
      this.logger.error(`Error extracting text from PDF ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return '';
    }
  }

  private async extractTextFromImage(filePath: string, isHeic: boolean = false): Promise<string> {
    let imagePath = filePath;

    try {
      if (isHeic) {
        const inputBuffer = fs.readFileSync(filePath);
        const outputBuffer = await heicConvert({
          buffer: inputBuffer,
          format: 'JPEG',
          quality: 1,
        });
        imagePath = path.join(path.dirname(filePath), `${path.basename(filePath, '.heic')}_temp.jpg`);
        fs.writeFileSync(imagePath, outputBuffer);
      }

      try {
        await sharp(imagePath).metadata();
      } catch (sharpError) {
        const errorMessage = sharpError instanceof Error ? sharpError.message : 'Unknown sharp error';
        this.logger.error(`Image validation failed for ${imagePath}: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const worker = await Tesseract.createWorker('eng', 1, {
        errorHandler: (error) => this.logger.error(`Tesseract worker error for ${filePath}: ${error?.message || 'Unknown error'}`),
      });

      try {
        const { data: { text } } = await worker.recognize(imagePath);
        await worker.terminate();
        return text.trim();
      } catch (workerError) {
        const errorMessage = workerError instanceof Error ? workerError.message : 'Unknown Tesseract error';
        this.logger.error(`Tesseract processing failed for ${filePath}: ${errorMessage}`);
        throw new Error(errorMessage); // Передаем ошибку дальше
      } finally {
        await worker.terminate();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error extracting text from image';
      this.logger.error(`Unexpected error extracting text from image ${filePath}: ${errorMessage}`);
      throw new Error(errorMessage); // Убедимся, что ошибка передается
    } finally {
      if (isHeic && fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (cleanupError) {
          this.logger.error(`Failed to clean up temporary file ${imagePath}: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`);
        }
      }
    }
  }

  private async extractTextFromDocx(filePath: string): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value.trim();
    } catch (error) {
      this.logger.error(`Error extracting text from DOCX ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return '';
    }
  }

  async scanFile(filePath: string): Promise<ScanResult> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File ${filePath} does not exist`);
      }

      const extension = path.extname(filePath).toLowerCase();
      let textContent = '';
      let hasSensitiveData = false;
      let matches: Record<string, string[]> = {};

      if (extension === '.pdf') {
        textContent = await this.extractTextFromPdf(filePath);
        const textResult = this.scanTextContent(textContent);
        hasSensitiveData = textResult.hasSensitiveData;
        matches = textResult.matches;
      } else if (['.jpg', '.jpeg', '.png'].includes(extension)) {
        textContent = await this.extractTextFromImage(filePath);
        const textResult = this.scanTextContent(textContent);
        hasSensitiveData = textResult.hasSensitiveData;
        matches = textResult.matches;
      } else if (extension === '.heic') {
        textContent = await this.extractTextFromImage(filePath, true);
        const textResult = this.scanTextContent(textContent);
        hasSensitiveData = textResult.hasSensitiveData;
        matches = textResult.matches;
      } else if (extension === '.docx') {
        textContent = await this.extractTextFromDocx(filePath);
        const textResult = this.scanTextContent(textContent);
        hasSensitiveData = textResult.hasSensitiveData;
        matches = textResult.matches;
      } else {
        textContent = fs.readFileSync(filePath, 'utf-8');
        const textResult = this.scanTextContent(textContent);
        hasSensitiveData = textResult.hasSensitiveData;
        matches = textResult.matches;
      }

      if (hasSensitiveData) {
        this.logger.warn(`Sensitive data found in ${filePath}: ${JSON.stringify(matches)}`);
        if (this.onSensitiveDataFound) {
          this.onSensitiveDataFound(filePath, matches);
        }
      }

      return { hasSensitiveData, matches, extractedText: textContent };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error scanning file';
      this.logger.error(`Error scanning file ${filePath}: ${errorMessage}`);
      throw new Error(errorMessage); // Передаем ошибку в сервис
    }
  }
}