import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { SensitiveDataScanner } from './sensitive-data-scanner';
import * as cliProgress from 'cli-progress';
import { ScanResult } from './scan-documents.interface';

@Injectable()
export class ScanDocumentsService {
  private readonly logger = new Logger(ScanDocumentsService.name);
  private readonly localDir: string;
  private readonly scanner: SensitiveDataScanner;
  private readonly sensitiveDataFile = path.resolve('./sensitive-files.json');
  private readonly errorDataFile = path.resolve('./error-files.json');
  private readonly lastProcessedFile = path.resolve('./last-processed.txt');
  private readonly excludedExtensions = ['.csv', '.xls'];

  constructor(private configService: ConfigService) {
    this.localDir = this.configService.get<string>('LOCAL_DIR');
    if (!this.localDir) {
      throw new Error('LOCAL_DIR is not defined in configuration');
    }
    this.scanner = new SensitiveDataScanner(this.saveSensitiveData.bind(this));
  }

  private saveSensitiveData(filePath: string, matches: Record<string, string[]>) {
    let sensitiveData: { filePath: string; matches: Record<string, string[]> }[] = [];

    if (fs.existsSync(this.sensitiveDataFile)) {
      try {
        const fileContent = fs.readFileSync(this.sensitiveDataFile, 'utf-8');
        sensitiveData = JSON.parse(fileContent);
      } catch (error) {
        this.logger.error(`Error reading sensitive-files.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    sensitiveData.push({ filePath, matches });
    try {
      fs.writeFileSync(this.sensitiveDataFile, JSON.stringify(sensitiveData, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error(`Error writing to sensitive-files.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private saveErrorData(filePath: string, errorMessage: string) {
    let errorData: { filePath: string; error: string }[] = [];

    if (fs.existsSync(this.errorDataFile)) {
      try {
        const fileContent = fs.readFileSync(this.errorDataFile, 'utf-8');
        errorData = JSON.parse(fileContent);
      } catch (error) {
        this.logger.error(`Error reading error-files.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    errorData.push({ filePath, error: errorMessage });
    try {
      fs.writeFileSync(this.errorDataFile, JSON.stringify(errorData, null, 2), 'utf-8');
      this.logger.debug(`Saved error for ${filePath} to error-files.json: ${errorMessage}`);
    } catch (error) {
      this.logger.error(`Error writing to error-files.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getLastProcessedFile(): string | null {
    if (fs.existsSync(this.lastProcessedFile)) {
      try {
        return fs.readFileSync(this.lastProcessedFile, 'utf-8').trim();
      } catch (error) {
        this.logger.error(`Error reading last-processed.txt: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
      }
    }
    return null;
  }

  private saveLastProcessedFile(filePath: string) {
    try {
      fs.writeFileSync(this.lastProcessedFile, filePath, 'utf-8');
    } catch (error) {
      this.logger.error(`Error writing to last-processed.txt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeFile(filePath: string): Promise<ScanResult> {
    try {
      const fullPath = path.join(this.localDir, filePath);

      if (!fullPath.startsWith(this.localDir)) {
        throw new Error(`Invalid file path: ${filePath} is outside of allowed directory`);
      }
      return await this.scanner.scanFile(fullPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error analyzing file ${filePath}: ${errorMessage}`);
      this.saveErrorData(path.join(this.localDir, filePath), errorMessage);
      throw error;
    }
  }

  async analyzeAllFiles(): Promise<{
    analyzedFiles: { filePath: string; result: ScanResult }[];
    errors: { filePath: string; error: string }[];
  }> {
    const analyzedFiles: { filePath: string; result: ScanResult }[] = [];
    const errors: { filePath: string; error: string }[] = [];
    const allFiles: string[] = [];

    const collectFiles = (dirPath: string) => {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          collectFiles(fullPath);
        } else if (stats.isFile()) {
          const extension = path.extname(fullPath).toLowerCase();
          if (!this.excludedExtensions.includes(extension)) {
            allFiles.push(fullPath);
          }
        }
      }
    };

    try {
      collectFiles(this.localDir);
      allFiles.sort(); 
    } catch (error) {
      this.logger.error(`Error collecting files from ${this.localDir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { analyzedFiles: [], errors: [{ filePath: this.localDir, error: error instanceof Error ? error.message : 'Unknown error' }] };
    }

    const lastProcessed = this.getLastProcessedFile();
    const startIndex = lastProcessed && allFiles.includes(lastProcessed) ? allFiles.indexOf(lastProcessed) + 1 : 0;

    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(allFiles.length, startIndex);

    for (let i = startIndex; i < allFiles.length; i++) {
      const fullPath = allFiles[i];
      const relativePath = path.relative(this.localDir, fullPath);
      progressBar.increment();

      try {
        const result = await this.analyzeFile(relativePath);
        analyzedFiles.push({ filePath: relativePath, result });
        this.saveLastProcessedFile(fullPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ filePath: relativePath, error: errorMessage });
        this.saveLastProcessedFile(fullPath);
      }
    }

    progressBar.stop();
    this.logger.log(`Scan completed: ${analyzedFiles.length} files analyzed, ${errors.length} errors`);

    return { analyzedFiles, errors };
  }
}