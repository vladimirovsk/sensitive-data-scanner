import { Module } from '@nestjs/common'
import { AppService } from './app.service'
import { ConfigModule } from '@nestjs/config'
import { S3Module } from './s3/s3.module'
import { ScanDocumentsModule } from './scan-documents/scan-documents.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    S3Module,
    ScanDocumentsModule,
    ScanDocumentsModule
  ],
  controllers: [],
  providers: [AppService]
})
export class AppModule {}
