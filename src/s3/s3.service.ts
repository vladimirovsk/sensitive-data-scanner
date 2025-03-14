import { Injectable, Logger } from '@nestjs/common'
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { ConfigService } from '@nestjs/config'
import { Readable } from 'stream'
import * as fs from 'fs'
import * as path from 'path'
import * as cliProgress from 'cli-progress'

@Injectable()
export class S3Service {
  private s3Client: S3Client
  private bucketName: string
  private localDir: string
  private logger = new Logger(S3Service.name)

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('S3_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('S3_KEY'),
        secretAccessKey: this.configService.get<string>('S3_SECRET')
      }
    })
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME')
    this.localDir = this.configService.get<string>('LOCAL_DIR')
  }

  async listAllFiles(): Promise<string[]> {
    const files: string[] = []
    let continuationToken: string | undefined
    this.logger.log('Listing all files in S3 bucket...')

    try {
      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: this.bucketName,
          ContinuationToken: continuationToken
        })

        const listResponse = await this.s3Client.send(listCommand)
        if (listResponse.Contents) {
          for (const obj of listResponse.Contents) {
            if (obj.Key) {
              files.push(obj.Key)
            }
          }
        }
        continuationToken = listResponse.NextContinuationToken
      } while (continuationToken)

      return files
    } catch (error) {
      throw new Error(`Failed to list files: ${error}`)
    }
  }

  async downloadFile(fileKey: string): Promise<string> {
    try {
      if (fileKey.endsWith('/')) {
        throw new Error(`${fileKey} is a directory, not a file`)
      }

      const localFilePath = path.join(this.localDir, fileKey)
      fs.mkdirSync(path.dirname(localFilePath), { recursive: true })

      const getCommand = new GetObjectCommand({ Bucket: this.bucketName, Key: fileKey })
      const getResponse = await this.s3Client.send(getCommand)

      const fileStream = fs.createWriteStream(localFilePath)
      const body = getResponse.Body as Readable
      body.pipe(fileStream)

      await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', () => resolve())
        fileStream.on('error', reject)
      })

      return localFilePath
    } catch (error) {
      if (error instanceof Error && error.message.includes('NoSuchKey')) {
        throw new Error(`Failed to download ${fileKey}: ${error?.stack}`)
      }
    }
  }

  async downloadAllFiles(): Promise<{ downloadedFiles: string[]; errorDownloadFiles: string[] }> {
    this.logger.log(`Start looking for files`)
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
    const files = await this.listAllFiles()
    this.logger.log(`Found ${files.length} files`)
    progressBar.start(files.length, 0)

    const downloadedFiles: string[] = []
    const errorDownloadFiles: string[] = []

    if (!fs.existsSync(this.localDir)) {
      fs.mkdirSync(this.localDir, { recursive: true })
    }

    for (const fileKey of files) {
      try {
        const localFilePath = path.join(this.localDir, fileKey)
        // console.log(localFilePath)
        progressBar.increment()
        //Skip if directory
        if (fileKey.endsWith('/')) {
          this.logger.log(`Skipping ${fileKey} as it is a directory`)
          continue
        }

        //Skip if exist
        if (fs.existsSync(localFilePath) && fs.lstatSync(localFilePath).isFile()) {
          // this.logger.log(`File ${localFilePath} already exists, skipping...`)
          downloadedFiles.push(localFilePath)
          continue
        }

        const downloadedFilePath = await this.downloadFile(fileKey)
        downloadedFiles.push(downloadedFilePath)
      } catch (error) {
        if (error instanceof Error) {
          this.logger.error(`Failed to download ${fileKey}: ${error?.stack}`)
          errorDownloadFiles.push(fileKey)
        }
      }
    }

    this.logger.log(
      `Download completed. Successfully downloaded: ${downloadedFiles.length}, Failed: ${errorDownloadFiles.length}`
    )
    progressBar.stop()

    return { downloadedFiles, errorDownloadFiles }
  }
}
