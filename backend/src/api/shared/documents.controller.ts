import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@Controller('shared/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: any,
    @Request() req,
  ) {
    return this.documentsService.uploadDocument(req.user.userId, file, metadata);
  }

  @Get(':id')
  async getDocument(@Param('id') id: string, @Request() req) {
    return this.documentsService.getDocument(req.user.userId, id);
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string, @Request() req) {
    return this.documentsService.deleteDocument(req.user.userId, id);
  }
}
