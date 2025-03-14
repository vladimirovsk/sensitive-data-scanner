import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { S3Service } from './s3/s3.service'
import { ConfigService } from '@nestjs/config'
import { ScanDocumentsService } from './scan-documents/scan-documents.service';
import * as console from 'node:console';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name)
  constructor(
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    private scanDocService: ScanDocumentsService
  ) {}

  async onModuleInit() {
    this.logger.log('AppService initialized')
    await this.scanDocService.analyzeAllFiles()
    // await this.s3Service.downloadAllFiles()
  }
}
