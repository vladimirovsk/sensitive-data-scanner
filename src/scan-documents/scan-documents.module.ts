import { Module } from '@nestjs/common';
import { ScanDocumentsService } from './scan-documents.service';
import { SensitiveDataScanner } from './sensitive-data-scanner';

@Module({
  providers: [ScanDocumentsService, SensitiveDataScanner],
  exports: [ScanDocumentsService],
})
export class ScanDocumentsModule {}
